#!/usr/bin/env node
process.on ('uncaughtException', function (reason) {
  var e = new String(reason.toString());
  if(reason.code){
    e.code = reason.code;
  }
  if(reason.code !== 'MODULE_NOT_FOUND'){
    console.log('uncaughtException in allex child process',process.pid);
    console.error(reason.stack);
    console.error(e);
  }else{
    process.send({uncaughtException:e});
  }
});

'use strict';
var toolbox = require('allex-rt-toolbox'),
    execlib = require('allex'),
    lib = execlib.lib,
    qlib = lib.qlib,
    execSuite = execlib.execSuite,
    ProcessDescriptor = require('./processdescriptorcreator')(execlib),
    taskRegistry = execSuite.taskRegistry;

/*
var cl = console.log;
console.log = function(){
  console.trace();
  cl.apply(console,arguments);
};
*/

var pe = process.exit;
process.exit = function(code) {
  console.trace();
  pe.apply(process, arguments);
}

execSuite.installFromError = toolbox.allex.commands.install;
execSuite.firstFreePortStartingWith = toolbox.allex.portSuite.reserve;
execSuite.isPortFree = toolbox.allex.portSuite.check;

toolbox.unixsocketcleaner('/tmp/allexprocess.'+process.pid);
execSuite.registry.register('allex_masterservice'); //to get the 'findSink' task registered

var spawndescriptorjson = process.argv[2] || process.env['ALLEX_SPAWN'];
var APD = new ProcessDescriptor(spawndescriptorjson);
global.ALLEX_PROCESS_DESCRIPTOR = APD;

if(!APD.get('wsport')){
  console.log('No WS port to start on');
  process.exit(1);
}

var ports = [{
  protocol: {
    name: 'socket'
  },
  port: '/tmp/allexprocess.'+process.pid,
  strategies: {samemachineprocess:true}
}];

if(APD.get('tcpport')){
  ports.push({
    protocol: {
      name: 'socket',
    },
    port: APD.get('tcpport'),
    strategies: APD.get('strategies')
  });
}
if(APD.get('httpport')){
  ports.push({
    protocol: {
      name: 'http',
    },
    port: APD.get('httpport'),
    strategies: APD.get('strategies')
  });
}
if(APD.get('wsport')){
  ports.push({
    protocol: {
      name: 'ws'
    },
    port: APD.get('wsport'),
    strategies: APD.get('strategies')
  });
}

//console.log('spawning',APD);

function contactMachineManager(){
  var mmp = 'socket:///tmp/allexmachinemanager';
  if(APD.get('masterpid')){
    mmp += ('.'+APD.get('masterpid'));
  }
  //console.log(mmp);
  taskRegistry.run('acquireSink',{
    identity:{samemachineprocess:{pid:process.pid,role:'service'}},
    connectionString: mmp,
    onSink:start
  });
//console.log('got the supersink, now the mastersink...',mmp.protocol.name+'://localhost:'+mmp.port);
}

function onNewServicePack(mastersink,newmodulename){
  mastersink.call('notifyModuleEngaged',newmodulename).done(function(){
    console.log('ok',arguments);
  },function(){
    console.error('nok',arguments);
  });
}

function start(mastersink){
  //console.log(process.pid, 'starting', mastersink ? 'with' : 'without', 'sink');
  APD.mastersink = mastersink;
  if(!mastersink){
    //master is dead, so... die...
    process.exit(0);
    return;
  }
  execSuite.onNewServicePack = onNewServicePack.bind(null,mastersink);
  execSuite.start({
    service:{
      modulename:APD.get('modulename'),
      instancename:APD.get('instancename'),
      propertyhash:APD.get('prophash')
    },
    ports:ports
  }).done(
    null,
    process.exit.bind(process, 1)
  );
  /*.done(
    //startProcessStats
    //contactMachineManager,
    null,
    null
  );*/
}

toolbox.allex.config.init(3,tryStart,true); //true => skip updating

function tryStart(should){
  if(!should){
    console.log('tryStart should not start, goodbye');
    process.exit(1);
    return;
  }
  lib.initUid().then(qlib.executor(contactMachineManager));
}

var _allServices = [];

//tryStart(true);

/*
function startProcessStats(supersink,mastersink){
  console.log('got the mastersink',mastersink);
  execSuite.start({
    service:{
      modulename: 'allex_processstatsservice',
    }
  }).done(function(pssink){
    var s = taskRegistry.run('materializeState',{
      sink:pssink
    });
    taskRegistry.run('readState',{
      state:s,
      name:'cpu',
      cb:doUpdate.bind(null,mastersink,'cpu')
    });
    taskRegistry.run('readState',{
      state:s,
      name:'ram',
      cb:doUpdate.bind(null,mastersink,'ram')
    });
  },function(){
    console.error('Process stats nok',arguments);
  });
}
*/
