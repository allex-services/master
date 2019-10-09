function createTasks(execlib) {
  'use strict';

  var sinkhunters = require('./tasks/sinkhunterscreator')(execlib);

  function sinkNameFromStringSegment (sseg, index, arry) {
    var colonindex, namerole = 'user', subsinkname = sseg.trim();
    if (index === arry.length-1) {
      return subsinkname;
    }
    colonindex = subsinkname.indexOf(':');
    if (colonindex>0) {
      namerole = subsinkname.substr(colonindex+1);
      subsinkname = subsinkname.substr(0, colonindex);
    }
    return {name: subsinkname, identity: {name: namerole, role: namerole}};
  }

  function sinkNameFromString (string) {
    return string.indexOf(',') > 0 ? string.split(',').map(sinkNameFromStringSegment) : string;
  }

  execlib.execSuite.sinkNameFromString = sinkNameFromString;

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
    name: 'findNatSink',
    klass: require('./tasks/findNatSink')(execlib)
  },{
    name: 'natThis',
    klass: require('./tasks/natThis')(execlib)
  },{
    name: 'findMasterPid',
    klass: require('./tasks/findMasterPid')(execlib)
  }];
}

module.exports = createTasks;
