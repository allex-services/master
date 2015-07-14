function createServiceSink(execlib,ParentSink){

  if(!ParentSink){
    ParentSink = execlib.execSuite.ServicePack.SinkMap.get('user');
  }

  function ServiceSink(prophash,client){
    ParentSink.call(this,prophash,client);
  }
  ParentSink.inherit(ServiceSink,require('../methoddescriptors/serviceuser'),require('../visiblefields/serviceuser'),require('../storagedescriptor'));
  ServiceSink.prototype.createStateFilter = function(){
    //TODO: create your filter here
    return null;
  };
  ServiceSink.prototype.createDataFilter = function(){
    //TODO: create your filter here
    return null;
  };
  return ServiceSink;
}

module.exports = createServiceSink;
