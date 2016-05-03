function createFindSinksByModuleNameTask(execlib, sinkhunters) {
  'use strict';

  var lib = execlib.lib,
    q = lib.q,
    qlib = lib.qlib,
    execSuite = execlib.execSuite,
    Task = execSuite.Task,
    LanSinkHunter = sinkhunters.LanSinkHunter;

  function getAcquireSinkFilter() {
    return {
      op: 'eq',
      field: 'modulename',
      value: this.task.moduleName
    };
  };

  function MultiLanSinkHunter (task, level) {
    LanSinkHunter.call(this, task, level);
    this.acquireSinkTasks = new lib.Map();
  }
  lib.inherit(MultiLanSinkHunter, LanSinkHunter);
  MultiLanSinkHunter.prototype.destroy = function () {
    if (this.acquireSinkTasks) {
      lib.arryDestroyAll(this.acquireSinkTasks);
    }
    this.acquireSinkTasks = null;
    LanSinkHunter.prototype.destroy.call(this);
  };
  MultiLanSinkHunter.prototype.createDirectBaseAcquireSinkTaskPropertyHash = function () {
    var ret = LanSinkHunter.prototype.createDirectBaseAcquireSinkTaskPropertyHash.call(this);
    ret.singleshot = false;
    return ret;
  };
  MultiLanSinkHunter.prototype.createNonDirectBaseAcquireSinkTaskPropertyHash = function () {
    var ret = LanSinkHunter.prototype.createNonDirectBaseAcquireSinkTaskPropertyHash.call(this);
    ret.singleshot = false;
    return ret;
  };
  MultiLanSinkHunter.prototype.getAcquireSinkFilter = getAcquireSinkFilter;
  MultiLanSinkHunter.prototype.createAcquireSinkPropHash = function (sinkrecord) {
    var ret = LanSinkHunter.prototype.createAcquireSinkPropHash.call(this, sinkrecord);
    ret.singleshot = false;
    return ret;
  };
  MultiLanSinkHunter.prototype.reportSink = function (sinkrecord, sink) {
    //this.purgeSingleAcquireSinkTask(sinkrecord.instancename);
    this.task.reportSink(sink, this.level, sinkrecord);
  };
  MultiLanSinkHunter.prototype.onSinkRecordFound = function (sinkrecord) {
    console.log('onSinkRecordFound', sinkrecord.instancename);
    LanSinkHunter.prototype.onSinkRecordFound.call(this, sinkrecord);
    if (!this.acquireSinkTasks.get(sinkrecord.instancename)) {
      this.acquireSinkTasks.add(sinkrecord.instancename, this.acquireSinkTask);
    } else {
      console.log('but already have', sinkrecord.instancename, '?!');
    }
    this.acquireSinkTask = null;
  };
  MultiLanSinkHunter.prototype.onSinkRecordDeleted = function (sinkrecord) {
    this.purgeSingleAcquireSinkTask(sinkrecord.instancename);
  };
  MultiLanSinkHunter.prototype.purgeSingleAcquireSinkTask = function (sinktaskname) {
    console.log('purgeSingleAcquireSinkTask', sinktaskname);
    var ast = this.acquireSinkTasks.remove(sinktaskname);
    if (ast) {
      ast.destroy();
    }
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
