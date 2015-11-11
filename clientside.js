function createClientSide(execlib,ParentServicePack) {
  'use strict';
  return {
    SinkMap: require('./sinkmapcreator')(execlib,ParentServicePack),
    Tasks: [{
      name: 'findSink',
      klass: require('./tasks/findSink')(execlib)
    },{
      name: 'findSinksByModuleName',
      klass: require('./tasks/findSinksByModule')(execlib)
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
