function createTasks(execlib) {
  'use strict';

  var sinkhunters = require('./tasks/sinkhunterscreator')(execlib);

  return [{
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
  }];
}

module.exports = createTasks;
