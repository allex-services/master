function createFindSinksByModuleTask(execlib) {
  'use strict';
  var lib = execlib.lib,
    q = lib.q,
    execSuite = execlib.execSuite,
    taskRegistry = execSuite.taskRegistry,
    Task = execSuite.Task;

  function SinkHunter(list, sinkname, identity, cb) {
    try {
    this.handle = list.push(this);
    this.list = list;
    this.cb = cb;
    this.task = taskRegistry.run('findSink', {
      sinkname: sinkname,
      identity: identity,
      onSink: this.onSink.bind(this)
    });
    } catch (e) {
      console.error(e.stack);
      console.error(e);
    }
  }
  SinkHunter.prototype.destroy = function () {
    if (!this.handle) {
      return;
    }
    this.list.removeOne(this.handle);
    if (this.task) {
      this.task.destroy();
    }
    this.cb = null;
    this.list = null;
    this.handle = null;
  };
  SinkHunter.prototype.onSink = function (sink) {
    this.task.destroy();
    this.task = null;
    this.cb(sink);
    this.destroy();
  };

  function FindSinkByModuleTask (prophash) {
    Task.call(this, prophash);
    this.masterpid = prophash.masterpid || global.ALLEX_PROCESS_DESCRIPTOR.get('masterpid');
    if(!this.masterpid){
      throw new lib.Error('NO_MASTER_PID','Property hash for FindSinkTask misses the masterpid property');
    }
    this.moduleName = prophash.modulename;
    this.onSink = prophash.onSink;
    this.identity = prophash.identity || {name: 'user', role: 'user'};
    this.sinkHunters = new lib.SortedList();
    this.acquireLanSinkTask = null;
    this.materializeTask = null;
  }
  lib.inherit(FindSinkByModuleTask, Task);
  FindSinkByModuleTask.prototype.destroy = function () {
    if (!this.log) {
      return;
    }
    lib.containerDestroyAll(this.sinkHunters);
    this.materializeTask = null;
    this.acquireLanSinkTask = null;
    this.sinkHunters.destroy();
    this.sinkHunters = null;
    this.identity = null;
    this.onSink = null;
    this.moduleName = null;
    this.masterpid = null;
    Task.prototype.destroy.call(this);
  };
  FindSinkByModuleTask.prototype.go = function () {
    if (this.acquireLanSinkTask) {
      return;
    }
    this.acquireLanSinkTask = taskRegistry.run('acquireSink', {
      connectionString:'socket:///tmp/availablelanservices.'+this.masterpid,
      identity:{
        samemachineprocess:{
          pid: process.pid,
          role: 'service',
          filter: {
            op: 'eq',
            field: 'modulename',
            value: this.moduleName
          }
        }
      },
      onSink: this.onAvailableLanServices.bind(this)
    });
  };
  FindSinkByModuleTask.prototype.onAvailableLanServices = function (sink) {
    if (this.materializeTask) {
      this.materializeTask.destroy();
    }
    this.materializeTask = taskRegistry.run('materializeData', {
      sink: sink,
      data: [],
      onRecordCreation: this.huntSink.bind(this)
    });
  };
  FindSinkByModuleTask.prototype.huntSink = function (sinkrecord) {
    new SinkHunter(this.sinkHunters, sinkrecord.instancename, this.identity, this.onSink);
  };



  FindSinkByModuleTask.prototype.compulsoryConstructionProperties = ['modulename', 'onSink'];

  return FindSinkByModuleTask;
}

module.exports = createFindSinksByModuleTask;
