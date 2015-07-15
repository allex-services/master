function createServicePack(execlib){
  'use strict';
  var lib = execlib.lib,
    q = lib.q,
    execSuite = execlib.execSuite,
    d = q.defer();

  execSuite.registry.register('allex_servicecontainerservice').done(
    realCreator.bind(null,d),
    d.reject.bind(d)
  );

  function realCreator(defer, ParentServicePack) {
    var ret = require('./clientside')(execlib, ParentServicePack);
    ret.Service = require('./servicecreator')(execlib,ParentServicePack);
    defer.resolve(ret);
    /*
    defer.resolve({
      Service: require('./servicecreator')(execlib,ParentServicePack),
      SinkMap: require('./sinkmapcreator')(execlib,ParentServicePack),
      Tasks: [{
        name: 'findSink',
        klass: require('./tasks/findSink')(execlib)
      },{
        name: 'findAndRun',
        klass: require('./tasks/findAndRun')(execlib)
      }]
    });
    */
  }

  return d.promise;
}

module.exports = createServicePack;
