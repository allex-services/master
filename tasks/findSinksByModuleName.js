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

  function ServiceRecordManager(sinkcb) {
    this.sinkcb = sinkcb;
    this.servicerecord = null;
    this.taskpropertyhash = null;
    this.task = null;
    this.sink = null;
    this.sinkDestroyedListener = null;
  }
  ServiceRecordManager.prototype.destroy = function () {
    if (this.sinkDestroyedListener) {
      this.sinkDestroyedListener.destroy();
    }
    this.sinkDestroyedListener = null;
    this.sink = null;
    this.purgeTask();
    this.taskpropertyhash = null;
    this.servicerecord = null;
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
    if (this.sink) {
      throw new lib.Error('DUPLICATE_SINK');
    }
    if (sink) {
      if (this.sinkDestroyedListener) {
        throw new lib.Error('DUPLICATE_SINK_DESTROYED_LISTENER');
      }
      this.task = null;
      this.sinkDestroyedListener = sink.destroyed.attach(this.onSinkDown.bind(this));
      this.sink = sink;
      this.sinkcb(this.servicerecord, sink);
    } else {
      this.sinkDestroyedListener.destroy();
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
      srm = new ServiceRecordManager(this.reportSink.bind(this));
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
