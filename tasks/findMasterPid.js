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
