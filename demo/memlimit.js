'use strict';

const titbit = require('../lib/titbit.js');

const cluster = require('cluster');

const app = new titbit({
  maxBody : 100000000,
  debug: true,
  //showLoadInfo: false,
  memFactor: -0.43,
  loadInfoFile: '/tmp/loadinfo.log'
})

if (app.isWorker) {
  app.addService('data', {})

  setInterval(() => {
    for (let i = 0; i < 100; i++)
    app.service.data[ `${Math.random()}` ] = Date.now()
  }, 5)
}


if (cluster.isMaster) {
  setTimeout(() => {
    console.log(app.secure);
  }, 10);
}

app.daemon(1234, 9)
