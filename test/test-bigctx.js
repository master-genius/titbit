const titbit = require('../main');

var app = new titbit({
  debug: true,
  //http2: true
});

var start_time = Date.now();

var ctx = null;

let total = 50000;

for (let i=0 ;i < total; i++) {
  ctx = new app.httpServ.context();
  ctx.path = '/';
  ctx.ip = '127.0.0.1';
  ctx.requestCall = (c) => {
    c.send('success');
  };
  ctx = null;
}

var end_time = Date.now();

let rtm = end_time - start_time;

console.log(rtm, 'ms', `${parseInt(total * 1000 / rtm)}/s`);
