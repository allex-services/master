var _okToRun = true;
function timeToDie () {
  _okToRun = false;
}

function createServiceUser(execlib,ParentUser){
  'use strict';
  var lib = execlib.lib,
    q = lib.q,
    qlib = lib.qlib,
    registry = execlib.execSuite.registry;

  lib.shouldClose.attachForSingleShot(timeToDie);

  if(!ParentUser){
    ParentUser = execlib.registry.get('.').Service.prototype.userFactory.get('user');
  }

  function ServiceUser(prophash){
    ParentUser.call(this,prophash);
  }
  ParentUser.inherit(ServiceUser,require('../methoddescriptors/serviceuser'),[],require('../visiblefields/serviceuser'));
  ServiceUser.prototype.onReadyForSpawn = function(spawndescriptor){
    return this.procCreator(spawndescriptor);
  };
  ServiceUser.prototype.getPort = function(portdomain,spawndescriptor){
    var d = q.defer();
    this.__service[portdomain+'ports'].next().done(function(port){
      spawndescriptor[portdomain+'port'] = port;
      d.resolve(true);
    },d.reject.bind(d));
    return d.promise;
  };
  function portsucceeder(port, defer, result) {
    if (!_okToRun) {
      return;
    }
    if (result === true) {
      defer.resolve(port);
    } else {
      port ++;
      if (port%1000 === 0) {
        port -= 1000;
      }
      lib.runNext(portchecker.bind(null, port, defer), lib.intervals.Second);
    }
  }
  function portfailer(port, defer, error) {
    if (!_okToRun) {
      return;
    }
    console.error('port', port, 'check failed', error, 'will retry in 1 second');
    lib.runNext(portchecker.bind(null, port, defer), lib.intervals.Second);
  }
  function portchecker (port, defer) {
    try {
    execlib.execSuite.checkPort(port).then(
      portsucceeder.bind(null, port, defer),
      portfailer.bind(null, port, defer)
    );
    } catch(e) {
      console.error(e);
      defer.reject(e);
    }
  }
  ServiceUser.prototype.portPromise = function (spawnrecord, porttype) {
    var port = (spawnrecord) ? spawnrecord[porttype+'port'] : 0, d;
    if (lib.isNumber(port) && port > 0) {
      d = q.defer();
      portchecker(port, d);
      return d.promise;
    } else {
      return this.getPort(porttype, spawnrecord);
    }
  };
  ServiceUser.prototype.acquireSink = function(spawnrecord, spawndescriptor){
    /*
    var modulename = spawnrecord.modulename,
        name = spawnrecord.instancename;
    //console.log('should spawn',modulename,'as',name,'from',__dirname,spawnrecord);
    try{
      registry.registerServerSide(modulename);
    }
    catch(e){
      console.error('Error in registering',modulename);
      console.error(e.stack);
      defer.reject(e);
      return;
    }
    */
    //console.log('spawnrecord:',spawnrecord, 'going to check for ports');
    return q.allSettled(['tcp', 'http', 'ws'].map(this.portPromise.bind(this, spawnrecord))).then(
      this.onReadyForSpawn.bind(this,spawnrecord)
    );
  };
  ServiceUser.prototype._onSpawned = function(spawndescriptor,sink){
    spawndescriptor.pid = sink.clientuser.client.talker.proc.pid;
    sink.destroyed.pazipid = spawndescriptor.pid;
    sink.destroyed.attachForSingleShot(this._onSinkDown.bind(this,spawndescriptor));
    spawndescriptor = null;
    return sink;
  };
  ServiceUser.prototype._onSinkDown = function(spawndescriptor, exception){
    if (!_okToRun) {
      return;
    }
    console.log('process down', exception);
    this.__service.tcpports.reclaim(spawndescriptor.tcpport);
    this.__service.httpports.reclaim(spawndescriptor.httpport);
    this.__service.wsports.reclaim(spawndescriptor.wsport);
    if (!(exception && exception.code == 'SERVER_SIDE_KILL')) { //it's me who actually killed this guy
      lib.runNext(this.killChild.bind(this, spawndescriptor.pid), 30*lib.intervals.Second);
      return;
    }
    this.killChild(spawndescriptor.pid);
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

  ServiceUser.prototype.procCreator = function (spawndescriptor) {
    spawndescriptor.masterpid = process.pid;
    if (spawndescriptor &&
      spawndescriptor.modulename &&
      spawndescriptor.modulename.indexOf(':')>0){
        return this.procSpawner(spawndescriptor)
      }
    return this.procForker(spawndescriptor);
  }
  ServiceUser.prototype.procForker = function (spawndescriptor, forkstring) {
    var envj = encodeURIComponent(JSON.stringify({
      ALLEX_SPAWN:spawndescriptor,
      ALLEX_RUNTIMEDIRECTORY:this.__service.runTimeDir
    })),
      forkstring = 'fork://'+__dirname+'/spawn.js?env='+envj,
      ret;
    if(spawndescriptor.debug){
      forkstring += ('&debug='+spawndescriptor.debug);
    }else if(spawndescriptor.debug_brk){
      forkstring += ('&debug_brk='+spawndescriptor.debug_brk);
    }else if(spawndescriptor.prof){
      forkstring += '&prof=true';
    }
    ret = registry.spawn({},forkstring,{}).then(
      this._onSpawned.bind(this,spawndescriptor)
    );
    spawndescriptor = null;
    return ret;
  }

  ServiceUser.prototype.procSpawner = function (spawndescriptor) {
    var domainandmodulename = spawndescriptor.modulename.split(':'), ret;
    if (domainandmodulename.length != 2) {
      return q.reject(new lib.Error('INVALID_DOMAIN_AND_MODULENAME', spawndescriptor.modulename+' has to be formed as "domain:modulename"'));
    }
    var domain = domainandmodulename[0];
    if (domain != 'dotnet'){
      return q.reject(new lib.Error('UNSUPPORTED_DOMAIN', domain+' has to be "dotnet", the only one supported for now'));
    }
    spawndescriptor.modulename = domainandmodulename[1];
    var envj = encodeURIComponent(JSON.stringify({
      ALLEX_SPAWN:spawndescriptor,
      ALLEX_RUNTIMEDIRECTORY:this.__service.runTimeDir
    })),
      spawnstring = 'spawn://AllexJSDotNet?env='+envj;
    ret = registry.spawn({},spawnstring,{}).then(
      this._onSpawned.bind(this,spawndescriptor)
    );
    spawndescriptor = null;
    return ret;
  }

  return ServiceUser;
}

module.exports = createServiceUser;
