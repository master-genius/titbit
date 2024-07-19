const titbit = require('../lib/titbit.js');

var app = new titbit({
  debug: true,
  //http2: true
});

var start_time = Date.now();

var ctx = null;

let total = 20000;

for (let i=0 ;i < total; i++) {
  ctx = new app.httpServ.Context();
  ctx.path = '/';
  ctx.ip = '127.0.0.1';
  ctx.requestCall = (c) => {
    c.send('success');
  };
  ctx.box.rand = Math.random()
  ctx = null;
}

var end_time = Date.now();

let rtm = end_time - start_time;

console.log(rtm, 'ms', `${parseInt(total * 1000 / rtm)}/s`);
