function createServiceUser(execlib,ParentUser){
  'use strict';
  var lib = execlib.lib,
    q = lib.q,
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
    var envj = JSON.stringify({
      ALLEX_SPAWN:spawndescriptor
    }),
      forkstring = 'fork://'+__dirname+'/spawn.js?env='+envj;
    if(spawndescriptor.debug){
      forkstring += ('&debug='+spawndescriptor.debug);
    }else if(spawndescriptor.debug_brk){
      forkstring += ('&debug_brk='+spawndescriptor.debug_brk);
    }
    console.log('asking for fork with string', forkstring);
    registry.spawn({},forkstring/*+(name==='Time'? '&debug_brk=5858' : '')*/,{}).done(
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
  ServiceUser.prototype.acquireSink = function(spawndescriptor,defer){
    var modulename = spawndescriptor.modulename,
        name = spawndescriptor.instancename;
    //console.log('should spawn',modulename,'as',name,'from',__dirname,spawndescriptor);
    try{
      registry.register(modulename);
    }
    catch(e){
      console.error('Error in registering',modulename);
      console.error(e.stack);
      defer.reject(e);
      return;
    }
    //console.log('spawndescriptor:',spawndescriptor);
    q.allSettled([this.getPort('tcp',spawndescriptor),
      this.getPort('http',spawndescriptor),
      this.getPort('ws',spawndescriptor)]).done(
      this.onReadyForSpawn.bind(this,spawndescriptor,defer),
      defer.reject.bind(defer)
    );
  };
  ServiceUser.prototype._onSpawned = function(defer,spawndescriptor,sink){
    spawndescriptor.pid = sink.clientuser.client.proc.pid;
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
  };
  ServiceUser.prototype.notifyModuleEngaged = function(modulename,defer){
    if(this.__service.onChildModuleEngaged){
      this.__service.onChildModuleEngaged(modulename);
    }
  };

  return ServiceUser;
}

module.exports = createServiceUser;
