var execSuite = execlib.execSuite,
  taskRegistry = execSuite.taskRegistry;

function SinkFinderJob (sinkname, identity) {
  qlib.JobBase.call(this);
  this.sinkname = sinkname;
  this.identity = identity;
  this.findMasterPidTask = null;
  this.findAndRunTask = null;
}
lib.inherit(SinkFinderJob, qlib.JobBase);
SinkFinderJob.prototype.destroy = function () {
  if (this.findAndRunTask) {
    this.findAndRunTask.destroy();
  }
  this.findAndRunTask = null;
  if (this.findMasterPidTask) {
    this.findMasterPidTask.destroy();
  }
  this.findMasterPidTask = null;
  this.identity = null;
  this.sinkname = null;
  qlib.JobBase.prototype.destroy.call(this);
};
SinkFinderJob.prototype.go = function () {
  var ret = this.defer.promise;
  if (this.findMasterPidTask) {
    return ret;
  }
  this.findMasterPidTask = taskRegistry.run('findMasterPid', {cb: this.onMasterPid.bind(this)});
  return ret;
};
SinkFinderJob.prototype.onMasterPid = function (masterpid) {
  this.findAndRunTask = taskRegistry.run('findAndRun', {
    masterpid: masterpid,
    program: {
      sinkname: this.sinkname,
      identity: this.identity || {role: 'user', name: 'user'},
      task: {name: this.onSinkFound.bind(this)}
    }
  });
};
SinkFinderJob.prototype.onSinkFound = function (taskobj) {
  this.resolve(taskobj.sink);
};

function onLibRegistered (sinkname, identity) {
  return (new SinkFinderJob(sinkname, identity)).go();
}

function findSink (sinkname, identity) {
  return execSuite.registry.registerClientSide('allex_masterservice').then(
    onLibRegistered.bind(null, sinkname, identity)
  );
}

setGlobal('findSink', findSink);
