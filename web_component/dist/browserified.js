(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
ALLEX.execSuite.registry.add('allex_masterservice',require('./clientside')(ALLEX, ALLEX.execSuite.registry.get('allex_servicecontainerservice')));

},{"./clientside":2}],2:[function(require,module,exports){
function createClientSide(execlib,ParentServicePack) {
  'use strict';
  var sinkhunters = require('./tasks/sinkhunterscreator')(execlib);
  return {
    SinkMap: require('./sinkmapcreator')(execlib,ParentServicePack),
    Tasks: [{
      name: 'findSink',
      klass: require('./tasks/findSink')(execlib, sinkhunters)
    },{
      name: 'findSinksByModuleName',
      klass: require('./tasks/findSinksByModuleName')(execlib, sinkhunters)
    },{
      name: 'findAndRun',
      klass: require('./tasks/findAndRun')(execlib)
    },{
      name: 'natThis',
      klass: require('./tasks/natThis')(execlib)
    },{
      name: 'findMasterPid',
      klass: require('./tasks/findMasterPid')(execlib)
    }]
  };
}

module.exports = createClientSide;

},{"./sinkmapcreator":4,"./tasks/findAndRun":7,"./tasks/findMasterPid":8,"./tasks/findSink":9,"./tasks/findSinksByModuleName":10,"./tasks/natThis":11,"./tasks/sinkhunterscreator":12}],3:[function(require,module,exports){
module.exports = {
  notifyModuleEngaged: [{
    title: 'Name of engaged module',
    type: 'string'
  }],
  addNeed: [{
    title: 'Need object',
    type: 'object'
  }],
  removeNeed: [{
    title: 'Instance name',
    type: 'string'
  }]
};

},{}],4:[function(require,module,exports){
function sinkMapCreator(execlib,ParentSinkMap){
  var sinkmap = new (execlib.lib.Map);
  sinkmap.add('service',require('./sinks/servicesinkcreator')(execlib,ParentSinkMap.get('service')));
  
  return sinkmap;
}

module.exports = sinkMapCreator;

},{"./sinks/servicesinkcreator":5}],5:[function(require,module,exports){
function createServiceSink(execlib,ParentSink){

  if(!ParentSink){
    ParentSink = execlib.execSuite.ServicePack.SinkMap.get('user');
  }

  function ServiceSink(prophash,client){
    ParentSink.call(this,prophash,client);
  }
  ParentSink.inherit(ServiceSink,require('../methoddescriptors/serviceuser'),require('../visiblefields/serviceuser'),require('../storagedescriptor'));
  ServiceSink.prototype.createStateFilter = function(){
    //TODO: create your filter here
    return null;
  };
  ServiceSink.prototype.createDataFilter = function(){
    //TODO: create your filter here
    return null;
  };
  return ServiceSink;
}

module.exports = createServiceSink;

},{"../methoddescriptors/serviceuser":3,"../storagedescriptor":6,"../visiblefields/serviceuser":13}],6:[function(require,module,exports){
module.exports = {
  record:{
    primaryKey: 'instancename',
    fields:[{
      name: 'instancename'
    },{
      name: 'modulename'
    },{
      name: 'propertyhash',
      default: {}
    },{
      name: 'strategies',
      default: {}
    },{
      name: 'closed',
    },{
      name: 'tcpport'
    },{
      name: 'httpport'
    },{
      name: 'wsport'
    },{
      name: 'pid'
    },{
      name: 'debug' //for testing only!
    },{
      name: 'debug_brk'
    },{
      name: 'prof'
    }]
  }
};

},{}],7:[function(require,module,exports){
(function (global){(function (){
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
    var taskisfunc;
    if (!this.program) {
      if (sink) {
        sink.destroy();
      }
      return;
    }
    taskisfunc = lib.isFunction(this.program.task.name);
    if(!sink){
      if(!taskisfunc || !this.program.continuous){
        if(taskisfunc) {
          this.program.task.name(this.makeTaskPropertyHash(sink));
        }
        lib.runNext(this.destroy.bind(this));
        return;
      }
    }
    this.log('going for',this.program.task.name);
    if(taskisfunc) {
      this.program.task.name(this.makeTaskPropertyHash(sink));
    }else{
      this.prepareToIgnite(this.makeTaskPropertyHash(sink));
    }
  };
  FindAndRunTask.prototype.makeTaskPropertyHash = function (sink) {
    var tph;
    if (!this.program) {
      return {};
    }
    tph = this.program.task.propertyhash || {};
    tph.sink = sink;
    tph.taskRegistry = taskRegistry;
    tph.execlib = execlib;
    lib.traverse(tph,this.fillAsNeeded.bind(this,tph));
    return tph;
  };
  FindAndRunTask.prototype.prepareToIgnite = function (tph) {
    registry.registerClientSide(tph.sink.modulename).then(this.onRemoteService.bind(this,tph));
  };
  FindAndRunTask.prototype.onRemoteService = function (tph, remoteservice) {
    var pn = this.program.task.name,
      task = execSuite.taskRegistry.ctors.get(pn);
    if (!task) {
      console.error('ooops, no task for', pn);
    }
    try{
      taskRegistry.run(pn,tph);
    } catch (e) {
      console.error(e.stack);
      console.error(e);
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
      httpport: true
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
    if(!prophashval) {
      return;
    }
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

}).call(this)}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],8:[function(require,module,exports){
(function (process,global){(function (){
var Path = require('path'),
  fs = require('fs');

function parsePid(lib, allexmasterpidcontents, cb){
  var allexmasterpid = parseInt(allexmasterpidcontents), program;
  if(isNaN(allexmasterpid)){
    console.log('allexmaster.pid is not in correct format. Is allexmaster running in your current working directory?');
    cb(null);
  }else{
    global.ALLEX_PROCESS_DESCRIPTOR = new lib.Map();
    global.ALLEX_PROCESS_DESCRIPTOR.add('masterpid', allexmasterpid);
    cb(allexmasterpid);
  }
}



function createPidFinder(execlib) {
}
function createFindMasterPidTask(execlib) {
  'use strict';

  var lib = execlib.lib,
    q = lib.q,
    execSuite = execlib.execSuite,
    taskRegistry = execSuite.taskRegistry,
    Task = execSuite.Task;

  function FindMasterPidTask(prophash) {
    Task.call(this, prophash);
    this.cb = prophash.cb;
  }
  lib.inherit(FindMasterPidTask, Task);
  FindMasterPidTask.prototype.destroy = function () {
    this.cb = null;
    Task.prototype.destroy.call(this);
  };
  FindMasterPidTask.prototype.finish = function (pid) {
    this.cb(pid);
    this.destroy();
  };
  FindMasterPidTask.prototype.go = function () {
    pidFinder(this.finish.bind(this));
  };
  FindMasterPidTask.prototype.compulsoryConstructionProperties = ['cb'];

  function pidFinder (cb) {
    try{
    var allexmasterpidcontents, cwd = process.cwd(), tempcwd = cwd;

    while(!allexmasterpidcontents){
      try{
        allexmasterpidcontents = fs.readFileSync(Path.join(tempcwd,'allexmaster.pid')).toString();
      }
      catch(e){
        try{
          process.chdir('..');
          tempcwd = process.cwd();
        }
        catch(e){
          console.log('oops in going upwards',e);
          console.log('allexmaster.pid not found. Is allexmaster running in your current working directory (or any parent of it)?',e);
        }
      }
    }

    if(allexmasterpidcontents){
      if(tempcwd!==cwd){
        process.chdir(cwd);
      }
      parsePid(execlib.lib, allexmasterpidcontents, cb);
    }
    } catch(e) {
      console.error(e.stack);
      console.error(e);
    }
  }

  return FindMasterPidTask;
}

module.exports = createFindMasterPidTask;

}).call(this)}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"_process":16,"fs":14,"path":15}],9:[function(require,module,exports){
(function (global){(function (){
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

}).call(this)}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],10:[function(require,module,exports){
(function (global){(function (){
function createFindSinksByModuleNameTask(execlib, sinkhunters) {
  'use strict';

  var lib = execlib.lib,
    q = lib.q,
    qlib = lib.qlib,
    execSuite = execlib.execSuite,
    taskRegistry = execSuite.taskRegistry,
    Task = execSuite.Task,
    LanSinkHunter = sinkhunters.LanSinkHunter;

  function getAcquireSinkFilter() {
    return {
      op: 'eq',
      field: 'modulename',
      value: this.task.moduleName
    };
  };

  function ServiceRecordManager(sinkcb, destroycb) {
    this.sinkcb = sinkcb;
    this.destroycb = destroycb;
    this.servicerecord = null;
    this.taskpropertyhash = null;
    this.task = null;
    this.sink = null;
    this.sinkDestroyedListener = null;
  }
  ServiceRecordManager.prototype.destroy = function () {
    if (this.destroycb) {
      this.destroycb(this.servicerecord.instancename);
    }
    if (this.sinkDestroyedListener) {
      this.sinkDestroyedListener.destroy();
    }
    this.sinkDestroyedListener = null;
    this.sink = null;
    this.purgeTask();
    this.taskpropertyhash = null;
    this.servicerecord = null;
    this.destroycb = null;
    this.sinkcb = null;
  };
  ServiceRecordManager.prototype.purgeTask = function () {
    if (this.task) {
      this.task.destroy();
    }
    this.task = null;
  };
  ServiceRecordManager.prototype.onServiceRecord = function (servicerecord, taskpropertyhash) {
    this.servicerecord = servicerecord;
    this.taskpropertyhash = taskpropertyhash;
    this.taskpropertyhash.singleshot = true;
    this.taskpropertyhash.onSink = this.onSink.bind(this);
    this.taskpropertyhash.onCannotConnect = this.onCannotConnect.bind(this);
    this.onServiceRecordTaskHandler();
  };
  ServiceRecordManager.prototype.stopTask = function () {
    this.taskpropertyhash = null;
    this.purgeTask();
    if (!this.sink) {
      this.destroy();
    }
  };
  ServiceRecordManager.prototype.onServiceRecordTaskHandler = function () {
    this.purgeTask();
    if (!this.sink) {
      if (!this.taskpropertyhash) {
        this.destroy();
      } else {
        this.task = taskRegistry.run('acquireSink', this.taskpropertyhash);
      }
    }
  };
  ServiceRecordManager.prototype.onSink = function (sink) {
    if (!this.sinkcb) {
      return;
    }
    if (sink) {
      if (this.sink) {
        throw new lib.Error('DUPLICATE_SINK');
      }
      if (this.sinkDestroyedListener) {
        throw new lib.Error('DUPLICATE_SINK_DESTROYED_LISTENER');
      }
      this.task = null;
      this.sinkDestroyedListener = sink.destroyed.attach(this.onSinkDown.bind(this));
      this.sink = sink;
      this.sinkcb(this.servicerecord, sink);
    } else {
      this.sinkDestroyedListener.destroy();
      this.sinkDestroyedListener = null;
      this.sink = sink;
      this.sinkcb(this.servicerecord, sink);
      this.onServiceRecordTaskHandler();
    }
  };
  ServiceRecordManager.prototype.onCannotConnect = function () {
    this.onServiceRecordTaskHandler();
  };
  ServiceRecordManager.prototype.onSinkDown = function () {
    this.onSink(null);
  };

  function MultiLanSinkHunter (task, level) {
    LanSinkHunter.call(this, task, level);
    this.sinkRecordManagers = new lib.Map();
  }
  lib.inherit(MultiLanSinkHunter, LanSinkHunter);
  MultiLanSinkHunter.prototype.destroy = function () {
    if (this.sinkRecordManagers) {
      lib.containerDestroyAll(this.sinkRecordManagers);
      this.sinkRecordManagers.destroy();
    }
    this.sinkRecordManagers = null;
    LanSinkHunter.prototype.destroy.call(this);
  };
  MultiLanSinkHunter.prototype.getAcquireSinkFilter = getAcquireSinkFilter;
  MultiLanSinkHunter.prototype.createAcquireSinkPropHash = function (sinkrecord) {
    var ret = LanSinkHunter.prototype.createAcquireSinkPropHash.call(this, sinkrecord);
    ret.singleshot = false;
    return ret;
  };
  MultiLanSinkHunter.prototype.reportSink = function (sinkrecord, sink) {
    this.task.reportSink(sink, this.level, sinkrecord);
  };
  MultiLanSinkHunter.prototype.onSinkRecordFound = function (sinkrecord) {
    var instancename = sinkrecord.instancename, 
      srm = this.sinkRecordManagers.get(instancename);

    if (!srm) {
      srm = new ServiceRecordManager(this.reportSink.bind(this), this.onServiceRecordManagerDown.bind(this));
      this.sinkRecordManagers.add(instancename, srm);
    }
    srm.onServiceRecord(sinkrecord, this.createAcquireSinkPropHash(sinkrecord));

  };
  MultiLanSinkHunter.prototype.onSinkRecordDeleted = function (sinkrecord) {
    var instancename = sinkrecord.instancename, 
      srm = this.sinkRecordManagers.get(instancename);

    if (!srm) {
      srm = new ServiceRecordManager(this.reportSink.bind(this));
      this.sinkRecordManagers.add(instancename, srm);
    }
    srm.stopTask();
  };
  MultiLanSinkHunter.prototype.onServiceRecordManagerDown = function (instancename) {
    this.sinkRecordManagers.remove(instancename);
  };

  function FindSinksByModuleNameTask(prophash) {
    Task.call(this, prophash);
    this.masterpid = prophash.masterpid || global.ALLEX_PROCESS_DESCRIPTOR.get('masterpid');
    this.moduleName = prophash.modulename;
    this.identity = prophash.identity;
    this.onSink = prophash.onSink;
    this.hunter = null;
  }
  lib.inherit(FindSinksByModuleNameTask, Task);
  FindSinksByModuleNameTask.prototype.destroy = function () {
    if (this.hunter) {
      this.hunter.destroy();
    }
    this.hunter = null;
    this.onSink = null;
    this.identity = null;
    this.moduleName = null;
    this.masterpid = null;
    Task.prototype.destroy.call(this);
  };
  FindSinksByModuleNameTask.prototype.go = function () {
    if (this.hunter) {
      return;
    }
    this.hunter = new MultiLanSinkHunter(this,0);
    this.hunter.go();
  };
  FindSinksByModuleNameTask.prototype.getIdentity = function () {
    return this.identity;
  };
  FindSinksByModuleNameTask.prototype.isDirect = function () {
    return false;
  };
  FindSinksByModuleNameTask.prototype.reportSink = function (sink, level, record) {
    if (this.onSink) {
      this.onSink(sink, record);
    }
  };

  FindSinksByModuleNameTask.prototype.compulsoryConstructionProperties = ['modulename','onSink'];

  return FindSinksByModuleNameTask;
};

module.exports = createFindSinksByModuleNameTask;

}).call(this)}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],11:[function(require,module,exports){
function createNatThisTask(execlib) {
  'use strict';
  var lib = execlib.lib,
    q = lib.q,
    execSuite = execlib.execSuite,
    Task = execSuite.Task,
    taskRegistry = execSuite.taskRegistry;

  function NatThisTask(prophash) {
    Task.call(this,prophash);
    this.iaddress = prophash.iaddress;
    this.iport = prophash.iport;
    this.cb = prophash.cb;
    this.singleshot = prophash.singleshot;
    this.acquireNatSinkTask = null;
    this.natSink = null;
  }
  lib.inherit(NatThisTask, Task);
  NatThisTask.prototype.destroy = function () {
    if (this.natSink) {
      this.natSink.destroy();
    }
    this.natSink = null;
    if (this.acquireNatSinkTask) {
      this.acquireNatSinkTask.destroy();
    }
    this.acquireNatSinkTask = null;
    this.singleshot = null;
    this.cb = null;
    this.iaddress = null;
    this.iport = null;
    Task.prototype.destroy.call(this);
  };
  NatThisTask.prototype.go = function () {
    if (!this.cb) {
      return;
    }
    if (this.acquireNatSinkTask) {
      return;
    }
    this.acquireNatSinkTask = taskRegistry.run('findNatSink', {
      cb: this.onNatSink.bind(this)
    });
  };
  NatThisTask.prototype.onNatSink = function (sink) {
    this.natSink = sink;
    if (sink) {
      taskRegistry.run('natLookup',{
        sink: sink,
        iaddress: this.iaddress,
        iport: this.iport,
        cb: this.onNatLookup.bind(this)
      });
    }
  };
  NatThisTask.prototype.onNatLookup = function (address, port) {
    //console.log('nat', this.iaddress+':'+this.iport, '=>', address+':'+port);
    if(this.cb){
      this.cb(address, port);
    }
    if (this.singleshot) {
      this.destroy();
    }
  };
  NatThisTask.prototype.onNatRecordDeleted = function () {
    //controversial?
    if (this.cb) {
      this.cb();
    }
  };
  NatThisTask.prototype.compulsoryConstructionProperties = ['iaddress','iport','cb'];


  return NatThisTask;
}

module.exports = createNatThisTask;

},{}],12:[function(require,module,exports){
(function (process){(function (){
function createSinkHunters(execlib) {
  'use strict';

  var lib = execlib.lib,
      q = lib.q,
      execSuite = execlib.execSuite,
      registry = execSuite.registry,
      taskRegistry = execSuite.taskRegistry;


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
      this.destroy();
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
      if (this.task.isDirect(acquired+1)) {
        sink.subConnect(this.task.getSinkName(acquired+1), this.task.getIdentity(acquired+1)).then(
          this.onSubSink.bind(this, acquired+1),
          this.onNoDirectSubSink.bind(this, sink, acquired)
        );
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
    }
  };
  SubSinkHunter.prototype.onNoDirectSubSink = function (sink, acquired, error) {
    lib.runNext(this.goOn.bind(this, sink, acquired), lib.intervals.Second);
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
    if (!this.task) {
      if (sink) {
        sink.destroy();
      }
      return;
    }
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
    if (!this.task) { //I'm dead
      return;
    }
    if(this.baseAcquireSinkTask){
      return;
    }
    if (this.task.isDirect()) {
      this.baseAcquireSinkTask = taskRegistry.run('acquireSink', this.createDirectBaseAcquireSinkTaskPropertyHash());
    } else {
      this.baseAcquireSinkTask = taskRegistry.run('acquireSink',this.createNonDirectBaseAcquireSinkTaskPropertyHash());
    }
  };
  RemoteSinkHunter.prototype.createDirectBaseAcquireSinkTaskPropertyHash = function () {
    return {
      connectionString: this.task.getSinkName(),
      identity: this.task.getIdentity(),
      onSink: this.reportSink.bind(this),
      onCannotConnect: this.onNoBaseSink.bind(this),
      singleshot: true
    };
  };
  RemoteSinkHunter.prototype.createNonDirectBaseAcquireSinkTaskPropertyHash = function () {
    return {
      connectionString:'socket://'+execSuite.tmpPipeDir()+'/'+this.dataSourceSinkName()+'.'+this.task.masterpid,
      identity:{
        samemachineprocess:{
          pid: process.pid,
          role: 'service'
        }
      },
      onSink: this.onDataSourceSink.bind(this),
      onCannotConnect: this.onNoBaseSink.bind(this),
      singleshot: true
    };
  };
  RemoteSinkHunter.prototype.onNoBaseSink = function () {
    if (!this.task) {
      return;
    }
    if(this.baseAcquireSinkTask) {
      this.baseAcquireSinkTask.destroy();
    }
    this.baseAcquireSinkTask = null;
    lib.runNext(this.go.bind(this), lib.intervals.Second);
  };
  RemoteSinkHunter.prototype.getAcquireSinkFilter = function () {
    throw new lib.Error('NOT_IMPLEMENTED','Basic RemoteSinkHunter does not implement getAcquireSinkFilter');
  };
  RemoteSinkHunter.prototype.dataSourceSinkName = function (defer) {
    defer.reject(new lib.Error('NOT_IMPLEMENTED','Basic RemoteSinkHunter does not implement dataSourceSinkName'));
  };
  RemoteSinkHunter.prototype.onDataSourceSink = function(datasourcesink){
    this.datasourcesink = datasourcesink;
    if(this.materializeQueryTask){
      this.materializeQueryTask.destroy();
    }
    this.materializeQueryTask = null;
    if(datasourcesink){
      this.materializeQueryTask = taskRegistry.run('materializeQuery',{
        sink: datasourcesink,
        continuous: true,
        filter: this.getAcquireSinkFilter(),
        data: [],
        onRecordCreation: this.onSinkRecordFound.bind(this),
        onRecordDeletion: this.onSinkRecordDeleted.bind(this)
      });
    }
  };
  RemoteSinkHunter.prototype.onSinkRecordFound = function(sinkrecord){
    try{
    var prophash = this.createAcquireSinkPropHash(sinkrecord);
    if(!prophash){
      return;
    }
    if (!('singleshot' in prophash)) {
      prophash.singleshot = true;
    }
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
    if (this.materializeQueryTask) {
      this.materializeQueryTask.destroy();
    }
    this.materializeQueryTask = null;
    if (this.datasourcesink) {
      this.datasourcesink.destroy();
    }
    this.datasourcesink = null;
    if (this.acquireSinkTask) {
      this.acquireSinkTask.destroy();
    }
    this.acquireSinkTask = null;
    if (!this.task) {
      if (sink) {
        sink.destroy();
      }
      return;
    }
    this.task.reportSink(sink,this.level,sinkrecord);
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
      connectionString: 'socket://'+execSuite.tmpPipeDir()+'/allexprocess.'+sinkrecord.pid,
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
    var connectionString, strategiesimplemented, identity, _id, myidentity, _myid;
    if (sinkrecord.httpport){
      connectionString = 'http://'+sinkrecord.ipaddress+':'+sinkrecord.httpport;
    } else if(sinkrecord.wsport){
      connectionString = 'ws://'+sinkrecord.ipaddress+':'+sinkrecord.wsport;
    }
    if(!connectionString){
      console.error('Could not make the connectionString out of lansinkrecord',sinkrecord);
      return null;
    }
    strategiesimplemented = Object.keys(sinkrecord.strategies);
    myidentity = this.task.getIdentity();
    if(strategiesimplemented.length){
      identity = {};
      _id = identity;
      _myid = myidentity;
      strategiesimplemented.forEach(function(strat){
        _id[strat] = _myid;
      });
      _myid = null;
      _id = null;
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

}).call(this)}).call(this,require('_process'))
},{"_process":16}],13:[function(require,module,exports){
module.exports = ['tcpport','httpport','wsport','pid','debug','debug_brk','prof'];

},{}],14:[function(require,module,exports){

},{}],15:[function(require,module,exports){
(function (process){(function (){
// .dirname, .basename, and .extname methods are extracted from Node.js v8.11.1,
// backported and transplited with Babel, with backwards-compat fixes

// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// resolves . and .. elements in a path array with directory names there
// must be no slashes, empty elements, or device names (c:\) in the array
// (so also no leading and trailing slashes - it does not distinguish
// relative and absolute paths)
function normalizeArray(parts, allowAboveRoot) {
  // if the path tries to go above the root, `up` ends up > 0
  var up = 0;
  for (var i = parts.length - 1; i >= 0; i--) {
    var last = parts[i];
    if (last === '.') {
      parts.splice(i, 1);
    } else if (last === '..') {
      parts.splice(i, 1);
      up++;
    } else if (up) {
      parts.splice(i, 1);
      up--;
    }
  }

  // if the path is allowed to go above the root, restore leading ..s
  if (allowAboveRoot) {
    for (; up--; up) {
      parts.unshift('..');
    }
  }

  return parts;
}

// path.resolve([from ...], to)
// posix version
exports.resolve = function() {
  var resolvedPath = '',
      resolvedAbsolute = false;

  for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
    var path = (i >= 0) ? arguments[i] : process.cwd();

    // Skip empty and invalid entries
    if (typeof path !== 'string') {
      throw new TypeError('Arguments to path.resolve must be strings');
    } else if (!path) {
      continue;
    }

    resolvedPath = path + '/' + resolvedPath;
    resolvedAbsolute = path.charAt(0) === '/';
  }

  // At this point the path should be resolved to a full absolute path, but
  // handle relative paths to be safe (might happen when process.cwd() fails)

  // Normalize the path
  resolvedPath = normalizeArray(filter(resolvedPath.split('/'), function(p) {
    return !!p;
  }), !resolvedAbsolute).join('/');

  return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
};

// path.normalize(path)
// posix version
exports.normalize = function(path) {
  var isAbsolute = exports.isAbsolute(path),
      trailingSlash = substr(path, -1) === '/';

  // Normalize the path
  path = normalizeArray(filter(path.split('/'), function(p) {
    return !!p;
  }), !isAbsolute).join('/');

  if (!path && !isAbsolute) {
    path = '.';
  }
  if (path && trailingSlash) {
    path += '/';
  }

  return (isAbsolute ? '/' : '') + path;
};

// posix version
exports.isAbsolute = function(path) {
  return path.charAt(0) === '/';
};

// posix version
exports.join = function() {
  var paths = Array.prototype.slice.call(arguments, 0);
  return exports.normalize(filter(paths, function(p, index) {
    if (typeof p !== 'string') {
      throw new TypeError('Arguments to path.join must be strings');
    }
    return p;
  }).join('/'));
};


// path.relative(from, to)
// posix version
exports.relative = function(from, to) {
  from = exports.resolve(from).substr(1);
  to = exports.resolve(to).substr(1);

  function trim(arr) {
    var start = 0;
    for (; start < arr.length; start++) {
      if (arr[start] !== '') break;
    }

    var end = arr.length - 1;
    for (; end >= 0; end--) {
      if (arr[end] !== '') break;
    }

    if (start > end) return [];
    return arr.slice(start, end - start + 1);
  }

  var fromParts = trim(from.split('/'));
  var toParts = trim(to.split('/'));

  var length = Math.min(fromParts.length, toParts.length);
  var samePartsLength = length;
  for (var i = 0; i < length; i++) {
    if (fromParts[i] !== toParts[i]) {
      samePartsLength = i;
      break;
    }
  }

  var outputParts = [];
  for (var i = samePartsLength; i < fromParts.length; i++) {
    outputParts.push('..');
  }

  outputParts = outputParts.concat(toParts.slice(samePartsLength));

  return outputParts.join('/');
};

exports.sep = '/';
exports.delimiter = ':';

exports.dirname = function (path) {
  if (typeof path !== 'string') path = path + '';
  if (path.length === 0) return '.';
  var code = path.charCodeAt(0);
  var hasRoot = code === 47 /*/*/;
  var end = -1;
  var matchedSlash = true;
  for (var i = path.length - 1; i >= 1; --i) {
    code = path.charCodeAt(i);
    if (code === 47 /*/*/) {
        if (!matchedSlash) {
          end = i;
          break;
        }
      } else {
      // We saw the first non-path separator
      matchedSlash = false;
    }
  }

  if (end === -1) return hasRoot ? '/' : '.';
  if (hasRoot && end === 1) {
    // return '//';
    // Backwards-compat fix:
    return '/';
  }
  return path.slice(0, end);
};

function basename(path) {
  if (typeof path !== 'string') path = path + '';

  var start = 0;
  var end = -1;
  var matchedSlash = true;
  var i;

  for (i = path.length - 1; i >= 0; --i) {
    if (path.charCodeAt(i) === 47 /*/*/) {
        // If we reached a path separator that was not part of a set of path
        // separators at the end of the string, stop now
        if (!matchedSlash) {
          start = i + 1;
          break;
        }
      } else if (end === -1) {
      // We saw the first non-path separator, mark this as the end of our
      // path component
      matchedSlash = false;
      end = i + 1;
    }
  }

  if (end === -1) return '';
  return path.slice(start, end);
}

// Uses a mixed approach for backwards-compatibility, as ext behavior changed
// in new Node.js versions, so only basename() above is backported here
exports.basename = function (path, ext) {
  var f = basename(path);
  if (ext && f.substr(-1 * ext.length) === ext) {
    f = f.substr(0, f.length - ext.length);
  }
  return f;
};

exports.extname = function (path) {
  if (typeof path !== 'string') path = path + '';
  var startDot = -1;
  var startPart = 0;
  var end = -1;
  var matchedSlash = true;
  // Track the state of characters (if any) we see before our first dot and
  // after any path separator we find
  var preDotState = 0;
  for (var i = path.length - 1; i >= 0; --i) {
    var code = path.charCodeAt(i);
    if (code === 47 /*/*/) {
        // If we reached a path separator that was not part of a set of path
        // separators at the end of the string, stop now
        if (!matchedSlash) {
          startPart = i + 1;
          break;
        }
        continue;
      }
    if (end === -1) {
      // We saw the first non-path separator, mark this as the end of our
      // extension
      matchedSlash = false;
      end = i + 1;
    }
    if (code === 46 /*.*/) {
        // If this is our first dot, mark it as the start of our extension
        if (startDot === -1)
          startDot = i;
        else if (preDotState !== 1)
          preDotState = 1;
    } else if (startDot !== -1) {
      // We saw a non-dot and non-path separator before our dot, so we should
      // have a good chance at having a non-empty extension
      preDotState = -1;
    }
  }

  if (startDot === -1 || end === -1 ||
      // We saw a non-dot character immediately before the dot
      preDotState === 0 ||
      // The (right-most) trimmed path component is exactly '..'
      preDotState === 1 && startDot === end - 1 && startDot === startPart + 1) {
    return '';
  }
  return path.slice(startDot, end);
};

function filter (xs, f) {
    if (xs.filter) return xs.filter(f);
    var res = [];
    for (var i = 0; i < xs.length; i++) {
        if (f(xs[i], i, xs)) res.push(xs[i]);
    }
    return res;
}

// String.prototype.substr - negative index don't work in IE8
var substr = 'ab'.substr(-1) === 'b'
    ? function (str, start, len) { return str.substr(start, len) }
    : function (str, start, len) {
        if (start < 0) start = str.length + start;
        return str.substr(start, len);
    }
;

}).call(this)}).call(this,require('_process'))
},{"_process":16}],16:[function(require,module,exports){
// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;
process.prependListener = noop;
process.prependOnceListener = noop;

process.listeners = function (name) { return [] }

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}]},{},[1]);
