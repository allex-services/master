#!/usr/bin/env node
var Path = require('path');
process.on ('uncaughtException', function (reason) {
  if(reason.code !== 'MODULE_NOT_FOUND'){
    console.log('uncaughtException in allex child process',process.pid);
    console.error(reason.stack);
    console.error(reason);
  }else{
    process.send({uncaughtException:{code: reason.code, message: reason.message}});
  }
});

'use strict';
var execlib = require('allex'),
    lib = execlib.lib,
    qlib = lib.qlib,
    execSuite = execlib.execSuite,
    ProcessDescriptor = require('./processdescriptorcreator')(execlib),
    unixsocketcleaner = require('allex_unixsocketcleanerserverruntimelib'),
    taskRegistry = execSuite.taskRegistry;

/*
var cl = console.log;
console.log = function(){
  console.trace();
  cl.apply(console,arguments);
};
*/

execlib.serverLoggingSetup();

var pe = process.exit;
process.exit = function(code) {
  console.trace();
  pe.apply(process, arguments);
}

unixsocketcleaner(Path.join(execSuite.tmpPipeDir(), 'allexprocess.'+process.pid));
execSuite.registry.registerClientSide('.'); //to get the 'findSink' task registered
execSuite.registry.registerClientSide('allex_masterservice'); //to get the 'findSink' task registered

var spawndescriptorjson = process.argv[2] || process.env['ALLEX_SPAWN'];
var runtimedirectory = process.argv[3] || process.env['ALLEX_RUNTIMEDIRECTORY'];
var APD = new ProcessDescriptor(spawndescriptorjson);
lib.moduleRecognition({takeauxfrompath: runtimedirectory});
global.ALLEX_PROCESS_DESCRIPTOR = APD;

if(!APD.get('wsport')){
  console.log('No WS port to start on');
  process.exit(1);
}

var ports = [{
  protocol: {
    name: 'socket'
  },
  port: Path.join(execSuite.tmpPipeDir(), 'allexprocess.'+process.pid),
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

function loadBaseService(){
  execlib.loadDependencies('server',['.'], contactMachineManager);
}

function contactMachineManager(){
  var mmp = 'socket://'+execSuite.tmpPipeDir()+'/allexmachinemanager';
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
  if (runtimedirectory) {
    try {
      process.chdir(runtimedirectory);
    }
    catch (e) {
      console.error('Could not chdir to designated run-time directory', runtimedirectory);
      process.exit(1);
    }
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

function tryStart(should){
  if(!should){
    console.log('tryStart should not start, goodbye');
    process.exit(1);
    return;
  }
  lib.initUid().then(qlib.executor(loadBaseService));
}
tryStart(true);

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
