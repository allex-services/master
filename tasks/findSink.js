function createFindSinkTask(execlib){
  'use strict';
  var lib = execlib.lib,
      q = lib.q,
      execSuite = execlib.execSuite,
      registry = execSuite.registry,
      taskRegistry = execSuite.taskRegistry,
      Task = execSuite.Task,
      sshid = 0;

  function SubSinkHunter(findsinktask, sink, level) {
    //this.id = ++sshid;
    if (!sink) {
      console.error('SubSinkHunter cannot start on a null sink');
    }
    this.task = findsinktask;
    this.level = level;
    this.intermediateSink = null;
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
    if (this.intermediateSink) {
      this.intermediateSink.destroy();
    }
    this.intermediateSink = null;
    this.level = null;
    this.task = null;
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
    this.destroyListeners.push(sink.destroyed.attach(this.destroy.bind(this)));
    this.linkIntermediate(sink, acquired);
    if (acquired+1 === this.task.sinkname.length) {
      //console.log('SubSinkHunter got it!,',acquired+1,'===', this.task.sinkname.length, this.task.getSinkName(acquired), 'will call onSink with', sink ? 'sink' :  'no sink');
      this.task.reportSink(sink, this.level);
    } else {
      //console.log(process.pid, this.id, 'got intermediate');
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
  SubSinkHunter.prototype.linkIntermediate = function (sink, acquired) {
    var ims = this.intermediateSink,
      id = this.id,
      slen = this.task.sinkname.length,
      isintermediate = acquired+1 !== slen,
      indextokill,
      currentname;
    //console.log(process.pid, this.id, 'should linkIntermediate?', acquired, slen);
    if (ims) {
      indextokill = acquired-1;
      currentname = this.task.sinkname[indextokill];
      if(currentname.name) {
        currentname = currentname.name;
      }
      /*
      console.log(process.pid, this.id, 'linking intermediate', indextokill, 'of', slen);
      //ims.deathLink = this.id+':'+currentname;
      sink.destroyed.attachForSingleShot(function () {
        console.log(id, 'destroying intermediate', currentname, indextokill, 'of', slen);
        ims.destroy();
      });
      */
      sink.destroyed.attachForSingleShot(ims.destroy.bind(ims));
    }/* else {
      console.log('NO');
    }*/
    if (isintermediate) {
      //console.log('but setting intermediateSink');
      this.intermediateSink = sink;
    } else {
      //console.log('and removing intermediateSink');
      this.intermediateSink = null;
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
    this.materializeDataTask = null;
    this.acquireSinkTask = null;
  }
  lib.inherit(RemoteSinkHunter,SinkHunter);
  RemoteSinkHunter.prototype.destroy = function () {
    if(this.acquireSinkTask){
      this.acquireSinkTask.destroy();
    }
    this.acquireSinkTask = null;
    if(this.materializeDataTask){
      this.materializeDataTask.destroy();
    }
    this.materializeDataTask = null;
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
          role: 'service',
          filter: {
            op: 'eq',
            field: 'instancename',
            value: this.task.getSinkName()
          }
        }
      },
      onSink: this.onDataSourceSink.bind(this),
      singleshot: true
    });
  };
  RemoteSinkHunter.prototype.dataSourceSinkName = function (defer) {
    defer.reject(new lib.Error('NOT_IMPLEMENTED','Basic RemoteSinkHunter does not implement dataSourceSinkName'));
  };
  RemoteSinkHunter.prototype.onDataSourceSink = function(datasourcesink){
    this.datasourcesink = datasourcesink;
    if(datasourcesink){
      this.materializeDataTask = taskRegistry.run('materializeData',{
        sink: datasourcesink,
        data: [],
        onRecordCreation: this.onSinkRecordFound.bind(this),
        onRecordDeletion: this.onSinkRecordDeleted.bind(this)
      });
    }else{
      if(this.materializeDataTask){
        this.materializeDataTask.destroy();
      }
      this.materializeDataTask = null;
    }
  };
  RemoteSinkHunter.prototype.onSinkRecordFound = function(sinkrecord){
    try{
    var prophash = this.createAcquireSinkPropHash(sinkrecord);
    if(!prophash){
      return;
    }
    prophash.onSink = this.reportSink.bind(this,sinkrecord);
    prophash.singleshot = true;
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
    this.materializeDataTask.destroy();
    this.materializeDataTask = null;
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

  var _fstid = 0;
  function FindSinkTask(prophash){
    //this.id = ++_fstid;
    Task.call(this,prophash);
    this.masterpid = prophash.masterpid || global.ALLEX_PROCESS_DESCRIPTOR.get('masterpid');
    if(!this.masterpid){
      throw new lib.Error('NO_MASTER_PID','Property hash for FindSinkTask misses the masterpid property');
    }
    this.sinkname = prophash.sinkname;
    this.identity = prophash.identity;
    this.prophash = prophash.propertyhash;
    this.onSink = prophash.onSink;
    this.addressinfo = prophash.addressinfo;
    this.sink = null;
    this.sinkrecord = null;
    this.foundatlevel = null;
    this.hunters = null;
    this.sinkDestroyedListener = null;
    this.subSinkHunter = null;
  }
  lib.inherit(FindSinkTask,Task);
  FindSinkTask.prototype.destroy = function(){
    /*
    console.trace();
    console.log('FindSinkTask', this.sinkname, 'destroying');
    */
    if (this.subSinkHunter) {
      this.subSinkHunter.destroy();
    }
    this.subSinkHunter = null;
    if(this.sinkDestroyedListener){
      this.sinkDestroyedListener.destroy();
    }
    this.sinkDestroyedListener = null;
    if (this.hunters) {
      lib.arryDestroyAll(this.hunters);
    }
    this.hunters = null;
    this.foundatlevel = null;
    this.sinkrecord = null;
    this.sink = null;
    this.addressinfo = null;
    this.onSink = null;
    this.prophash = null;
    this.identity = null;
    this.sinkname = null;
    this.masterpid = null;
    Task.prototype.destroy.call(this);
  };
  FindSinkTask.prototype.go = function(){
    if(!this.onSink){
      return;
    }
    //console.log(process.pid, 'FindSinkTask go for', this.sinkname, 'with', this.identity);
    if (this.hunters) {
      lib.arryDestroyAll(this.hunters);
    }
    this.hunters = [
      new RegistrySinkHunter(this,0),
      new MachineRecordSinkHunter(this,1),
      new LanSinkHunter(this,2)
    ];
    this.hunters.forEach(function(h){
      h.go();
    });
  };
  FindSinkTask.prototype.getSinkName = function (index) {
    if (lib.isArray(this.sinkname)) {
      var s = this.sinkname[index||0];
      if (!s) {
        console.log('What the #! is in this.sinkname?', this.sinkname, 'for index', index);
        this.destroy();
        return null;
      }
      return this.sinkname[index||0].name || this.sinkname[index||0];
    }
    return this.sinkname;
  };
  FindSinkTask.prototype.getIdentity = function (index) {
    index = index || 0;
    if (lib.isArray(this.sinkname)) {
      if (index===this.sinkname.length-1) {
        return this.identity;
      }
      return this.sinkname[index||0].identity || {};
    } else {
      return this.identity;
    }
  };
  FindSinkTask.prototype.getPropertyHash = function (index) {
    if (lib.isArray(this.sinkname)) {
      if (index===this.sinkname.length-1) {
        return this.prophash;
      }
      return this.sinkname[index||0].propertyhash || {};
    } else {
      return this.prophash;
    }
  };
  FindSinkTask.prototype.reportSink = function(sink,level,record){
    this.log('FindSinkTask got a sink',arguments);
    //console.log(process.pid, 'FindSinkTask', this.id, sink ? 'got' : 'got no', 'sink at level', level, record);
    if(!sink){
      //console.log('forgetting');
      this.forgetSink(level);
      return;
    }
    //console.log('talker', sink.clientuser.client.talker.type);
    if(this.addressinfo){
      if(this.addressinfo==='global'){
        if(level===2){
          //console.log('accepting');
          this.acceptSink(sink,level,record);
          return;
        }
      }else{
        if(level>0){
          //console.log('accepting');
          this.acceptSink(sink,level,record);
          return;
        }
      }
    }else{
      //console.log('accepting');
      this.acceptSink(sink,level,record);
      return;
    }
    //console.log('rejecting');
    sink.destroy();
  };
  FindSinkTask.prototype.acceptSink = function (sink,level,record){
    if(this.sink){
      return;
    }
    if(this.sinkDestroyedListener){
      console.trace();
      console.error('cannot reattach to sink destroyed',sink);
      return;
    }
    if (this.foundatlevel !== null && level!==this.foundatlevel) {
      //console.log('destroying later');
      sink.destroy();
      return;
    }
    this.foundatlevel = level;
    if (!this.sinkrecord) {
      this.sinkrecord = record;
    }
    if (lib.isArray(this.sinkname) && !this.subSinkHunter) {
      this.subSinkHunter = new SubSinkHunter(this, sink, level);
    } else {
      lib.arryDestroyAll(this.hunters);
      this.hunters = null;
      //console.log('acceptSink', level);
      this.sinkDestroyedListener = sink.destroyed.attach(this.forgetSink.bind(this,level));
      this.sink = sink;
      this.callbackTheSink(sink);
    }
  };
  FindSinkTask.prototype.forgetSink = function(level){
    //console.log('forgetSink!', this.sinkname, 'level', level, 'foundatlevel', this.foundatlevel);
    if(level === this.foundatlevel){
      if (this.sinkDestroyedListener) {
        this.sinkDestroyedListener.destroy();
      }
      this.sinkDestroyedListener = null;
      this.sink = null;
      this.sinkrecord = null;
      this.foundatlevel = null;
      if (this.subSinkHunter) {
        this.subSinkHunter.destroy();
      }
      this.subSinkHunter = null;
      this.callbackTheSink(null);
      lib.runNext(this.go.bind(this));
    }
  };
  FindSinkTask.prototype.callbackTheSink = function (sink) {
    if (!this.onSink) {
      this.destroy();
    }
    var onsinkret = this.onSink(sink);
    if (onsinkret === true) {
      this.destroy();
    }
  };
  FindSinkTask.prototype.compulsoryConstructionProperties = ['sinkname','onSink'];

  return FindSinkTask;
}

module.exports = createFindSinkTask;
