function createServiceUser(execlib,ParentUser){
  'use strict';
  var lib = execlib.lib,
    q = lib.q,
    qlib = lib.qlib,
    registry = execlib.execSuite.registry;

  if(!ParentUser){
    ParentUser = execlib.registry.get('.').Service.prototype.userFactory.get('user');
  }

  function ServiceUser(prophash){
    ParentUser.call(this,prophash);
  }
  ParentUser.inherit(ServiceUser,require('../methoddescriptors/serviceuser'),[],require('../visiblefields/serviceuser'));
  ServiceUser.prototype.onReadyForSpawn = function(spawndescriptor,defer){
    spawndescriptor.masterpid = process.pid;
    var envj = encodeURIComponent(JSON.stringify({
      ALLEX_SPAWN:spawndescriptor
    })),
      forkstring = 'fork://'+__dirname+'/spawn.js?env='+envj;
    if(spawndescriptor.debug){
      forkstring += ('&debug='+spawndescriptor.debug);
    }else if(spawndescriptor.debug_brk){
      forkstring += ('&debug_brk='+spawndescriptor.debug_brk);
    }
    registry.spawn({},forkstring,{}).done(
      this._onSpawned.bind(this,defer,spawndescriptor),
      this._onSpawnFailed.bind(this,defer)
    );
  };
  ServiceUser.prototype.getPort = function(portdomain,spawndescriptor){
    var d = q.defer();
    this.__service[portdomain+'ports'].next().done(function(port){
      spawndescriptor[portdomain+'port'] = port;
      d.resolve(true);
    },d.reject.bind(d));
    return d.promise;
  };
  ServiceUser.prototype.acquireSink = function(spawnrecord, spawndescriptor, defer){
    var modulename = spawnrecord.modulename,
        name = spawnrecord.instancename;
    //console.log('should spawn',modulename,'as',name,'from',__dirname,spawnrecord);
    try{
      registry.register(modulename);
    }
    catch(e){
      console.error('Error in registering',modulename);
      console.error(e.stack);
      defer.reject(e);
      return;
    }
    //console.log('spawnrecord:',spawnrecord);
    q.allSettled([this.getPort('tcp',spawnrecord),
      this.getPort('http',spawnrecord),
      this.getPort('ws',spawnrecord)]).done(
      this.onReadyForSpawn.bind(this,spawnrecord,defer),
      defer.reject.bind(defer)
    );
  };
  ServiceUser.prototype._onSpawned = function(defer,spawndescriptor,sink){
    spawndescriptor.pid = sink.clientuser.client.talker.proc.pid;
    defer.resolve(sink);
    sink.extendTo(sink.destroyed.attach(this._onSinkDown.bind(this,spawndescriptor)));
  };
  ServiceUser.prototype._onSpawnFailed = function(defer,reason){
    console.log('NOT spawned',arguments);
    defer.reject(reason);
  };
  ServiceUser.prototype._onSinkDown = function(spawndescriptor){
    this.__service.tcpports.reclaim(spawndescriptor.tcpport);
    this.__service.httpports.reclaim(spawndescriptor.httpport);
    this.__service.wsports.reclaim(spawndescriptor.wsport);
    lib.runNext(this.killChild.bind(this, spawndescriptor.pid), 30*lib.intervals.Second);
  };
  ServiceUser.prototype.killChild = function (childpid) {
    console.log('disposing of closed process', childpid);
    try {
      process.kill(childpid);
    } catch (ignore) {
    }
  };
  ServiceUser.prototype.notifyModuleEngaged = function(modulename,defer){
    if(this.__service.onChildModuleEngaged){
      this.__service.onChildModuleEngaged(modulename);
    }
    defer.resolve(true);
  };
  ServiceUser.prototype.addNeed = function (needobj, defer) {
    qlib.promise2defer(this.__service.addNeed(needobj), defer);
  };
  ServiceUser.prototype.removeNeed = function (instancename, defer) {
    qlib.promise2defer(this.__service.removeNeed(instancename), defer);
  };

  return ServiceUser;
}

module.exports = createServiceUser;
