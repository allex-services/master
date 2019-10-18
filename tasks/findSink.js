function createFindSinkTask(execlib, sinkhunters){
  'use strict';
  var lib = execlib.lib,
      q = lib.q,
      execSuite = execlib.execSuite,
      taskRegistry = execSuite.taskRegistry,
      Task = execSuite.Task;

  function getAcquireSinkFilter() {
    return {
      op: 'eq',
      field: 'instancename',
      value: this.task.getSinkName()
    };
  };

  function SingleMachineRecordSinkHunter (task, level) {
    sinkhunters.MachineRecordSinkHunter.call(this, task, level);
  }
  lib.inherit(SingleMachineRecordSinkHunter, sinkhunters.MachineRecordSinkHunter);
  SingleMachineRecordSinkHunter.prototype.getAcquireSinkFilter = getAcquireSinkFilter;

  function SingleLanSinkHunter (task, level) {
    sinkhunters.LanSinkHunter.call(this, task, level);
  }
  lib.inherit(SingleLanSinkHunter, sinkhunters.LanSinkHunter);
  SingleLanSinkHunter.prototype.getAcquireSinkFilter = getAcquireSinkFilter;

  function NullSinkHunter () {
  }
  NullSinkHunter.prototype.destroy = lib.dummyFunc;
  NullSinkHunter.prototype.go = lib.dummyFunc;


  function FindSinkTask(prophash){
    Task.call(this,prophash);
    this.masterpid = prophash.masterpid || global.ALLEX_PROCESS_DESCRIPTOR.get('masterpid');
    if(!this.masterpid){
      throw new lib.Error('NO_MASTER_PID', 'No "masterpid" property in property hash for FindSinkTask');
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
    this.log('FindSinkTask go for', this.sinkname, 'with', this.identity);
    if (this.hunters) {
      lib.arryDestroyAll(this.hunters);
    }
    this.hunters = [
      new (this.addressinfo==='global' ? NullSinkHunter : sinkhunters.RegistrySinkHunter)(this,0),
      new (this.addressinfo==='global' ? NullSinkHunter : SingleMachineRecordSinkHunter)(this,1),
      new SingleLanSinkHunter(this,2)
    ];
    this.hunters.forEach(function(h){
      h.go();
    });
  };
  FindSinkTask.prototype.getSinkName = function (index) {
    index = index||0;
    if (lib.isArray(this.sinkname)) {
      var s = this.sinkname[index];
      if (!s) {
        console.log('What the #! is in this.sinkname?', this.sinkname, 'for index', index);
        this.destroy();
        return null;
      }
      return this.sinkname[index].name || this.sinkname[index];
    }
    return this.sinkname;
  };
  FindSinkTask.prototype.getIdentity = function (index) {
    index = index || 0;
    if (lib.isArray(this.sinkname)) {
      if (index===this.sinkname.length-1) {
        return this.identity;
      }
      return this.sinkname[index].identity || {};
    } else {
      return this.identity;
    }
  };
  FindSinkTask.prototype.getPropertyHash = function (index) {
    index = index || 0;
    if (lib.isArray(this.sinkname)) {
      if (index===this.sinkname.length-1) {
        return this.prophash;
      }
      return this.sinkname[index].propertyhash || {};
    } else {
      return this.prophash;
    }
  };
  FindSinkTask.prototype.isDirect = function (index) {
    var si;
    index = index || 0;
    if (lib.isArray(this.sinkname)) {
      si = this.sinkname[index];
      if (!si) {
        return false;
      }
      return si.direct;
    }
    return false;
  };
  FindSinkTask.prototype.reportSink = function(sink,level,record){
    //this.log('FindSinkTask', this.sinkname, sink ? 'got' : 'lost', 'a sink at level', level, record ? 'that is '+ record.instancename : '', this.subSinkHunter ? 'with' : 'without', 'SubSinkHunter');
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
    //console.log('FindSinkTask with addressinfo', this.addressinfo, 'will reject the sink at level', level);
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
      this.subSinkHunter = new sinkhunters.SubSinkHunter(this, sink, level);
    } else {
      lib.arryDestroyAll(this.hunters);
      this.hunters = null;
      //console.log('acceptSink', level);
      if (sink.destroyed) {
        this.sinkDestroyedListener = sink.destroyed.attach(this.forgetSink.bind(this,level));
      }
      this.sink = sink;
      this.callbackTheSink(sink);
    }
  };
  FindSinkTask.prototype.forgetSink = function(level){
    this.log('forgetSink!', this.sinkname, 'level', level, 'foundatlevel', this.foundatlevel);
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
