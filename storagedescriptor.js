module.exports = {
  record:{
    primaryKey: 'instancename',
    fields:[{
      name: 'instancename'
    },{
      name: 'modulename'
    },{
      name: 'propertyhash',
      default: {}
    },{
      name: 'strategies',
      default: {}
    },{
      name: 'closed',
    },{
      name: 'tcpport'
    },{
      name: 'httpport'
    },{
      name: 'wsport'
    },{
      name: 'pid'
    },{
      name: 'debug' //for testing only!
    },{
      name: 'debug_brk'
    },{
      name: 'prof'
    }]
  }
};
