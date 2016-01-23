function createMasterService(execlib,ParentServicePack){
  'use strict';
  var ParentService = ParentServicePack.Service,
    execSuite = execlib.execSuite,
    dataSuite = execlib.dataSuite,
    NullStorage = dataSuite.NullStorage,
    lib = execlib.lib,
    qlib = lib.qlib;

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
    this.lanManagerAvailable = prophash.lanManagerAvailable.attach(this.onLanManager.bind(this));
  }
  ParentService.inherit(MasterService,factoryCreator,require('./storagedescriptor'));
  MasterService.prototype.__cleanUp = function(){
    if (this.lanManagerAvailable) {
      this.lanManagerAvailable.destroy();
    }
    this.lanManagerAvailable = null;
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
  MasterService.prototype.onLanManager = function (lanmanager) {
    if (lanmanager) {
      this.state.set('lanmanager', lanmanager);
    } else {
      this.state.remove('lanmanager');
    }
  };
  MasterService.prototype.addNeed = execSuite.dependentServiceMethod([], ['lanmanager'], function (lmsink, needobj, defer) {
    qlib.promise2defer(lmsink.call('addNeed', needobj), defer);
  });
  MasterService.prototype.removeNeed = execSuite.dependentServiceMethod([], ['lanmanager'], function (lmsink, instancename, defer) {
    qlib.promise2defer(lmsink.call('removeNeed', instancename), defer);
  });

  return MasterService;
}

module.exports = createMasterService;
