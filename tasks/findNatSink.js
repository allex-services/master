function createFindNatSink (execlib) {
  'use strict';

  var lib = execlib.lib,
    q = lib.q,
    execSuite = execlib.execSuite,
    Task = execSuite.Task,
    taskRegistry = execSuite.taskRegistry;

  function FindNatSinkTask (prophash) {
    Task.call(this, prophash);
    this.acquireNatSinkTask = null;
    this.cb = prophash.cb;
  }
  lib.inherit(FindNatSinkTask, Task);
  FindNatSinkTask.prototype.destroy = function () {
    if (this.acquireNatSinkTask) {
      this.acquireNatSinkTask.destroy();
    }
    this.acquireNatSinkTask = null;
  };
  FindNatSinkTask.prototype.go = function () {
    this.acquireNatSinkTask = taskRegistry.run('acquireSink', {
      connectionString: 'socket://'+execSuite.tmpPipeDir()+'/nat.'+global.ALLEX_PROCESS_DESCRIPTOR.masterpid,
      identity: {
        samemachineprocess: {
          pid: process.pid,
          role: 'user'
        }
      },
      onSink: this.cb
    });
  };
  FindNatSinkTask.prototype.compulsoryConstructionProperties = ['cb'];

  return FindNatSinkTask;
}
module.exports = createFindNatSink;
