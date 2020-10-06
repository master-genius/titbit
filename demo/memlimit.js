'use strict';

const titbit = require('../main');

const cluster = require('cluster');

const app = new titbit({
  maxBody : 100000000,
  debug: true,
  //showLoadInfo: false,
  memFactor: -0.48,
  loadInfoFile: '/tmp/loadinfo.log'
});


if (cluster.isMaster) {
  setTimeout(() => {
    console.log(app.secure);
  }, 10);
}

app.daemon(1234, 2);
