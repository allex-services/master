function sinkMapCreator(execlib,ParentServicePack){
  var sinkmap = new (execlib.lib.Map), ParentSinkMap = ParentServicePack.SinkMap;
  sinkmap.add('service',require('./sinks/servicesinkcreator')(execlib,ParentSinkMap.get('service')));
  
  return sinkmap;
}

module.exports = sinkMapCreator;
