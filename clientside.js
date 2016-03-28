function createClientSide(execlib,ParentServicePack) {
  'use strict';
  var sinkhunters = require('./tasks/sinkhunterscreator')(execlib);
  return {
    SinkMap: require('./sinkmapcreator')(execlib,ParentServicePack),
    Tasks: [{
      name: 'findSink',
      klass: require('./tasks/findSink')(execlib, sinkhunters)
    },{
      name: 'findSinksByModuleName',
      klass: require('./tasks/findSinksByModuleName')(execlib, sinkhunters)
    },{
      name: 'findAndRun',
      klass: require('./tasks/findAndRun')(execlib)
    },{
      name: 'natThis',
      klass: require('./tasks/natThis')(execlib)
    },{
      name: 'findMasterPid',
      klass: require('./tasks/findMasterPid')(execlib)
    }]
  };
}

module.exports = createClientSide;
