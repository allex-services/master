function createProcessDescriptor(execlib){
  'use strict';
  var lib = execlib.lib;

  function ProcessDescriptor (props) {
    try {
      var prophash = JSON.parse(props);
      this.instancename = prophash.instancename;
      this.modulename = prophash.modulename;
      this.prophash = prophash.propertyhash || {};
      this.strategies = prophash.strategies || {};
      this.tcpport = prophash.tcpport;
      this.httpport = prophash.httpport;
      this.wsport = prophash.wsport;
      this.masterpid = prophash.masterpid;
      this.mastersink = null;
    }catch (e) {
      console.log ('Unable to create process descriptor due to ',e.message, e.stack);
      console.log (props);
      process.exit();
    }
  };

  lib.inherit (ProcessDescriptor, lib.Gettable);
  return ProcessDescriptor;
}


module.exports = createProcessDescriptor;
