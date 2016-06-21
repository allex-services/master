function sinkMapCreator(execlib,ParentSinkMap){
  var sinkmap = new (execlib.lib.Map);
  sinkmap.add('service',require('./sinks/servicesinkcreator')(execlib,ParentSinkMap.get('service')));
  
  return sinkmap;
}

module.exports = sinkMapCreator;
