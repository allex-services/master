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
      name: 'tcpoptions'
    },{
      name: 'httpport'
    },{
      name: 'httpoptions'
    },{
      name: 'wsport'
    },{
      name: 'wsoptions'
    },{
      name: 'pid'
    },{
      name: 'debug' //for testing only!
    },{
      name: 'debug_brk'
    },{
      name: 'prof'
    },{
      name: 'gate'
    }]
  }
};
