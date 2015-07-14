function createFindAndRunTask(execlib){
  'use strict';
  var lib = execlib.lib,
      q = lib.q,
      execSuite = execlib.execSuite,
      registry = execSuite.registry,
      taskRegistry = execSuite.taskRegistry,
      Task = execSuite.Task;

  function FindAndRunTask(prophash){
    Task.call(this,prophash);
    this.addressinfoneeds = null;
    this.checkProgram(prophash.program);
    this.masterpid = prophash.masterpid || global.ALLEX_PROCESS_DESCRIPTOR.get('masterpid');
    if(!this.masterpid){
      throw new lib.Error('NO_MASTER_PID','Property hash for FindSinkTask misses the masterpid property');
    }
    this.program = prophash.program;
    this.findSinkTask = null;
  }
  lib.inherit(FindAndRunTask,Task);
  FindAndRunTask.prototype.destroy = function(){
    if(this.findSinkTask){
      this.findSinkTask.destroy();
    }
    this.findSinkTask = null;
    this.program = null;
    this.masterpid = null;
    this.addressinfoneeds = null;
    Task.prototype.destroy.call(this);
  };
  FindAndRunTask.prototype.go = function(){
    this.findSinkTask = taskRegistry.run('findSink',{
      debug:this.debugMode(),
      masterpid: this.masterpid,
      sinkname: this.program.sinkname,
      identity: this.program.identity,
      propertyhash: this.program.propertyhash,
      onSink: this.onSink.bind(this),
      addressinfo: this.addressinfoneeds
    });
  };
  FindAndRunTask.prototype.onSink = function(sink){
    try{
      if(!sink){
        if('function' === typeof this.program.task.name){
          this.program.task.name({sink:null});
        }
        lib.runNext(this.destroy.bind(this));
        return;
      }
      var tph = this.program.task.propertyhash || {};
      tph.sink = sink;
      tph.taskRegistry = taskRegistry;
      lib.traverse(tph,this.fillAsNeeded.bind(this,tph));
      this.log('going for',this.program.task.name);
      if('function' === typeof this.program.task.name){
        this.program.task.name(tph);
      }else{
        taskRegistry.run(this.program.task.name,tph);
      }
    }
    catch(e){
      console.log(e.stack);
      console.log(e);
    }
  };
  FindAndRunTask.prototype.checkProgram = function (program) {
    if (!program.sinkname){
      throw new lib.Error('NO_SINKNAME_IN_PROGRAM');
    }
    if (!program.task){
      throw new lib.Error('NO_TASK_IN_PROGRAM');
    }
    if (lib.isArray(program.task)) {
      program.task.forEach(this.checkProgramTask.bind(this));
    } else {
      this.checkProgramTask(program.task);
    }
  };
  FindAndRunTask.prototype.checkProgramTask = function (programtask) {
    if(!programtask.name){
      throw new lib.Error('NO_TASKNAME_IN_PROGRAM');
    }
    lib.traverse(programtask.propertyhash,this.checkForFillYourself.bind(this));
  };
  var _propsForNeed = {
      wsport: true
    },
    _propsForGlobalNeed = {
      ipaddress: true
    };
  FindAndRunTask.prototype.checkForFillYourself = function (prophashval,prophashname) {
    if(prophashval === 'fill yourself'){
      var fn = 'fill_'+prophashname;
      if('function' !== typeof this[fn]){
        console.log(fn,'=>',this[fn]);
        var e = new lib.Error('CANNOT_FILL_TASK_PROPERTY_HASH','Property '+prophashname+' cannot be filled by FindAndRunTask');
        e.propertyname = prophashname;
        throw e;
      }
      if(_propsForGlobalNeed.hasOwnProperty(prophashname)){
        this.addressinfoneeds = 'global';
      }else if(this.addressinfoneeds!=='global' && _propsForNeed.hasOwnProperty(prophashname)){
        this.addressinfoneeds = true;
      }
    }
  };
  FindAndRunTask.prototype.fillAsNeeded = function(prophash,prophashval,prophashname){
    if(prophashval === 'fill yourself'){
      prophash[prophashname] = this['fill_'+prophashname]();
    }
    if(lib.defined(prophashval['bind yourself'])){
      prophash[prophashname] = prophashval['bind yourself'].bind(null,this,prophash);
    }
  };
  FindAndRunTask.prototype.fill_ipaddress = function(){
    return this.findSinkTask.sinkrecord.ipaddress || '127.0.0.1';
  };
  FindAndRunTask.prototype.fill_httpport = function(){
    return this.findSinkTask.sinkrecord.httpport || 0;
  };
  FindAndRunTask.prototype.fill_wsport = function(){
    return this.findSinkTask.sinkrecord.wsport || 0;
  };
  FindAndRunTask.prototype.compulsoryConstructionProperties = ['program'];

  return FindAndRunTask;
}

module.exports = createFindAndRunTask;
