function createMasterService(execlib,ParentServicePack){
  'use strict';
  var ParentService = ParentServicePack.Service,
    execSuite = execlib.execSuite,
    dataSuite = execlib.dataSuite,
    NullStorage = dataSuite.NullStorage,
    lib = execlib.lib;

  function factoryCreator(parentFactory){
    return {
      'service': require('./users/serviceusercreator')(execlib,parentFactory.get('service')) 
    };
  }

  function UsedPorts(startport){
    this.startport = startport;
  }
  UsedPorts.prototype.destroy = function(){
    this.startport = null;
  };
  UsedPorts.prototype.next = function(){
    /*
    var ret = this.startport;
    while(this.ports.find(ret)){
      ret++;
    }
    this.ports.add(ret);
    return ret;
    */
    return execSuite.firstFreePortStartingWith(this.startport);
  };
  UsedPorts.prototype.reclaim = function(port){
    //so what...
  };

  function MasterService(prophash){
    ParentService.call(this,prophash);
    this.tcpports = new UsedPorts(prophash.portrangestart.tcp || 15000);
    this.httpports = new UsedPorts(prophash.portrangestart.http || 16000);
    this.wsports = new UsedPorts(prophash.portrangestart.ws || 17000);
    this.onChildModuleEngaged = prophash.onChildModuleEngaged;
  }
  ParentService.inherit(MasterService,factoryCreator,require('./storagedescriptor'));
  MasterService.prototype.__cleanUp = function(){
    this.onChildModuleEngaged = null;
    this.tcpports.destroy();
    this.tcpports = null;
    this.httpports.destroy();
    this.httpports = null;
    this.wsports.destroy();
    this.wsports = null;
    ParentService.prototype.__cleanUp.call(this);
  };
  MasterService.prototype.createStorage = function(storagedescriptor){
    return ParentService.prototype.createStorage.call(this,storagedescriptor);
  };
  return MasterService;
}

module.exports = createMasterService;
