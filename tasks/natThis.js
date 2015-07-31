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
    this.acquireNatSinkTask = taskRegistry.run('acquireSink', {
      connectionString: 'socket:///tmp/nat.'+global.ALLEX_PROCESS_DESCRIPTOR.masterpid,
      identity: {
        samemachineprocess: {
          pid: process.pid,
          role: 'user',
          filter: {
            op: 'natlookup',
            iaddress: this.iaddress,
            iport: this.iport
          }
        }
      },
      onSink: this.onNatSink.bind(this)
    });
  };
  NatThisTask.prototype.onNatSink = function (sink) {
    this.natSink = sink;
    if (sink) {
      taskRegistry.run('natLookup',{
        sink: sink,
        iport: this.iport,
        cb: this.onNatLookup.bind(this)
      });
    }
  };
  NatThisTask.prototype.onNatLookup = function (address, port) {
    console.log('nat record!', address, port);
    if(!this.cb){
      return;
    }
    this.cb(address, port);
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
