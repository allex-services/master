function createClientSide(execlib,ParentServicePack) {
  return {
    SinkMap: require('./sinkmapcreator')(execlib,ParentServicePack),
    Tasks: [{
      name: 'findSink',
      klass: require('./tasks/findSink')(execlib)
    },{
      name: 'findAndRun',
      klass: require('./tasks/findAndRun')(execlib)
    }]
  };
}

module.exports = createClientSide;
