function createSinkHunters(execlib) {
  'use strict';

  var lib = execlib.lib,
      q = lib.q,
      execSuite = execlib.execSuite,
      registry = execSuite.registry,
      taskRegistry = execSuite.taskRegistry,
      sshid = 0;

  function SinkChainListener () {
    this.listeners = [];
    this.sinks = [];
  };
  SinkChainListener.prototype.destroy = function () {
    if (!this.listeners) {
      return;
    }
    lib.arryDestroyAll(this.listeners);
    this.listeners = null;
    lib.arryDestroyAll(this.sinks);
    this.sinks = null;
  };
  SinkChainListener.prototype.sinkDown = function (index) {
    if (!this.listeners) {
      return;
    }
    var l = this.listeners[index];
    this.sinks[index] = null;
    this.listeners[index] = null;
    if (l) {
      l.destroy();
    }
    this.destroy();
  };
  SinkChainListener.prototype.add = function (sink) {
    var ind = this.listeners.length;
    this.sinks.push(sink);
    this.listeners.push(sink.destroyed.attach(this.sinkDown.bind(this, ind)));
  };

  function SubSinkHunter(findsinktask, sink, level) {
    //this.id = ++sshid;
    if (!sink) {
      console.error('SubSinkHunter cannot start on a null sink');
    }
    this.task = findsinktask;
    this.level = level;
    this.chainListener = new SinkChainListener();
    this.destroyListeners = [ ];
    this.goOn(sink, 0);
  }
  SubSinkHunter.prototype.destroy = function () {
    //console.log(this.id, 'dying');
    var l = this.level;
    if (this.destroyListeners) {
      lib.arryDestroyAll(this.destroyListeners);
    }
    this.destroyListeners = null;
    if (this.chainListener) {
      this.chainListener.destroy();
    }
    this.chainListener = null;
    this.level = null;
    this.task = null;
  };
  SubSinkHunter.prototype.abort = function () {
    this.task.forgetSink(this.level);
  };
  SubSinkHunter.prototype.goOn = function (sink, acquired) {
    acquired = acquired || 0;
    var foundit, ims;
    if (!this.task) {
      return;
    }
    if (!sink) {
      return;
    }
    this.destroyListeners.push(sink.destroyed.attach(this.abort.bind(this)));
    this.chainListener.add(sink);
    if (acquired+1 === this.task.sinkname.length) {
      //console.log('SubSinkHunter got it!,',acquired+1,'===', this.task.sinkname.length, this.task.getSinkName(acquired), 'will call onSink with', sink ? 'sink' :  'no sink');
      this.task.reportSink(sink, this.level);
    } else {
      //console.log('SubSinkHunter still has to go,',acquired+1,'<', this.task.sinkname.length, 'will call acquireSubSinks for', this.task.sinkname[acquired+1]);
      taskRegistry.run('acquireSubSinks',{
        state:taskRegistry.run('materializeState',{
          sink: sink
        }),
        subinits:[{
          name: this.task.getSinkName(acquired+1),
          identity: this.task.getIdentity(acquired+1),
          propertyhash: this.task.getPropertyHash(acquired+1),
          cb: this.onSubSink.bind(this, acquired+1)
        }]
      });
    }
  };
  SubSinkHunter.prototype.onSubSink = function (acquired, sink) {
    //console.log('SubSinkHunter got subsink');
    this.goOn(sink, acquired);
  };

  function SinkHunter(task,level){
    this.task = task;
    this.level = level;
  }
  SinkHunter.prototype.destroy = function () {
    this.level = null;
    this.task = null;
  };
  SinkHunter.prototype.go = function () {
    throw new lib.Error('NOT_IMPLEMENTED','Basic SinkHunter does not implement go');
  };
  SinkHunter.prototype.rego = function(){
    if(!this.task){
      return;
    }
    this.task.reportSink(null,this.level);
    lib.runNext(this.safego.bind(this),1000);
  };
  SinkHunter.prototype.safego = function () {
    if(!this.task){
      return;
    }
    this.go();
  };

  function RegistrySinkHunter(task,level){
    SinkHunter.call(this,task,level);
    this.supersink = registry.getSuperSink(this.task.getSinkName());
    this.superSinkEventListener = registry.onSuperSink.attach(this.onSuperSink.bind(this));
  }
  lib.inherit(RegistrySinkHunter,SinkHunter);
  RegistrySinkHunter.prototype.destroy = function(){
    if(this.superSinkEventListener){
      this.superSinkEventListener.destroy();
    }
    this.superSinkEventListener = null;
    this.supersink = null;
    SinkHunter.prototype.destroy.call(this);
  };
  RegistrySinkHunter.prototype.go = function(){
    this.handleSuperSink();
  };
  RegistrySinkHunter.prototype.handleSuperSink = function(supersink){
    if(!this.supersink){
      return;
    }
    //console.log('will say subConnect with ident', this.task.getIdentity(), 'with prophash', this.task.getPropertyHash());
    this.supersink.subConnect('.',this.task.getIdentity(),this.task.getPropertyHash()).done(
      this.reportSink.bind(this),
      this.onFail.bind(this)
    );
  };
  RegistrySinkHunter.prototype.onSuperSinkDown = function(){
    this.supersink = null;
    lib.runNext(this.rego.bind(this));
  };
  RegistrySinkHunter.prototype.onSuperSink = function(name,supersink){
    if(name!==this.task.getSinkName()){
      return;
    }
    this.supersink = supersink;
    this.handleSuperSink();
  };
  RegistrySinkHunter.prototype.reportSink = function (sink) {
    this.task.reportSink(sink,this.level);
  };
  RegistrySinkHunter.prototype.onFail = function(){
    this.supersink = null;
  };

  function RemoteSinkHunter(task,level){
    SinkHunter.call(this,task,level);
    this.baseAcquireSinkTask = null;
    this.datasourcesink = null;
    this.materializeQueryTask = null;
    this.acquireSinkTask = null;
  }
  lib.inherit(RemoteSinkHunter,SinkHunter);
  RemoteSinkHunter.prototype.destroy = function () {
    if(this.acquireSinkTask){
      this.acquireSinkTask.destroy();
    }
    this.acquireSinkTask = null;
    if(this.materializeQueryTask){
      this.materializeQueryTask.destroy();
    }
    this.materializeQueryTask = null;
    if(this.datasourcesink){
      //console.log(process.pid, 'destroying datasourcesink');
      this.datasourcesink.destroy();
    }
    this.datasourcesink = null;
    if(this.baseAcquireSinkTask){
      //console.log(process.pid, 'destroying baseAcquireSinkTask');
      this.baseAcquireSinkTask.destroy();
    }
    this.baseAcquireSinkTask = null;
    SinkHunter.prototype.destroy.call(this);
  };
  RemoteSinkHunter.prototype.go = function(){
    if(this.baseAcquireSinkTask){
      return;
    }
    this.baseAcquireSinkTask = taskRegistry.run('acquireSink',{
      connectionString:'socket:///tmp/'+this.dataSourceSinkName()+'.'+this.task.masterpid,
      identity:{
        samemachineprocess:{
          pid: process.pid,
          role: 'service'
        }
      },
      onSink: this.onDataSourceSink.bind(this),
      singleshot: true
    });
  };
  RemoteSinkHunter.prototype.getAcquireSinkFilter = function () {
    throw new lib.Error('NOT_IMPLEMENTED','Basic RemoteSinkHunter does not implement getAcquireSinkFilter');
  };
  RemoteSinkHunter.prototype.dataSourceSinkName = function (defer) {
    defer.reject(new lib.Error('NOT_IMPLEMENTED','Basic RemoteSinkHunter does not implement dataSourceSinkName'));
  };
  RemoteSinkHunter.prototype.onDataSourceSink = function(datasourcesink){
    this.datasourcesink = datasourcesink;
    if(datasourcesink){
      this.materializeQueryTask = taskRegistry.run('materializeQuery',{
        sink: datasourcesink,
        continuous: true,
        filter: this.getAcquireSinkFilter(),
        data: [],
        onRecordCreation: this.onSinkRecordFound.bind(this),
        onRecordDeletion: this.onSinkRecordDeleted.bind(this)
      });
    }else{
      if(this.materializeQueryTask){
        this.materializeQueryTask.destroy();
      }
      this.materializeQueryTask = null;
    }
  };
  RemoteSinkHunter.prototype.onSinkRecordFound = function(sinkrecord){
    try{
    var prophash = this.createAcquireSinkPropHash(sinkrecord);
    if(!prophash){
      return;
    }
    prophash.singleshot = true;
    prophash.onSink = this.reportSink.bind(this,sinkrecord);
    if(this.acquireSinkTask){
      //should I throw or should I no?
      return;
    }
    //console.log(process.pid, this.task.id, 'starting acquireSink on level', this.level);
    this.acquireSinkTask = taskRegistry.run('acquireSink',prophash);
    }
    catch(e){
      console.error(e.stack);
      console.error(e);
    }
  };
  RemoteSinkHunter.prototype.onSinkRecordDeleted = function(sinkrecord){
    if(this.acquireSinkTask){
      this.acquireSinkTask.destroy();
      this.acquireSinkTask = null;
    }
  };
  RemoteSinkHunter.prototype.reportSink = function(sinkrecord,sink){
    try {
    this.materializeQueryTask.destroy();
    this.materializeQueryTask = null;
    this.datasourcesink.destroy();
    this.datasourcesink = null;
    this.acquireSinkTask.destroy();
    this.acquireSinkTask = null;
    this.task.reportSink(sink,this.level,sinkrecord);
    } catch (e) {
      console.error(e.stack);
      console.error(e);
    }
  };

  function MachineRecordSinkHunter(task,level){
    RemoteSinkHunter.call(this,task,level);
  }
  lib.inherit(MachineRecordSinkHunter,RemoteSinkHunter);
  MachineRecordSinkHunter.prototype.dataSourceSinkName = function(){
    return 'allexmachinemanager';
  };
  MachineRecordSinkHunter.prototype.createAcquireSinkPropHash = function(sinkrecord){
    var smi = {pid:process.pid};
    var idnt = this.task.getIdentity();
    for(var i in idnt){
      smi[i] = idnt[i];
    }
    return {
      connectionString: 'socket:///tmp/allexprocess.'+sinkrecord.pid,
      identity: {samemachineprocess:smi}
    };
  };

  function LanSinkHunter(task,level){
    RemoteSinkHunter.call(this,task,level);
  }
  lib.inherit(LanSinkHunter,RemoteSinkHunter);
  LanSinkHunter.prototype.dataSourceSinkName = function(){
    return 'availablelanservices';
  };
  LanSinkHunter.prototype.createAcquireSinkPropHash = function(sinkrecord){
    var connectionString;
    if(sinkrecord.wsport){
      connectionString = 'ws://'+sinkrecord.ipaddress+':'+sinkrecord.wsport;
    }else{
    }
    if(!connectionString){
      console.error('Could not make the connectionString out of lansinkrecord',sinkrecord);
      return null;
    }
    var strategiesimplemented = Object.keys(sinkrecord.strategies), myidentity = this.task.getIdentity(), identity;
    if(strategiesimplemented.length){
      identity = {};
      strategiesimplemented.forEach(function(strat){
        identity[strat] = myidentity;
      });
    }else{
      identity = {
        ip: myidentity
      };
    }
    //console.log(connectionString, '=> OUTGOING IDENT ', identity, 'because', myidentity, '(', this.task.identity, ')');
    return {
      connectionString: connectionString,
      identity: identity
    };
  };

  return {
    RegistrySinkHunter: RegistrySinkHunter,
    MachineRecordSinkHunter: MachineRecordSinkHunter,
    LanSinkHunter: LanSinkHunter,
    SubSinkHunter: SubSinkHunter
  };
}

module.exports = createSinkHunters;
