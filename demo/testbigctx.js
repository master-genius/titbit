const titbit = require('../main');

var app = new titbit();

var start_time = Date.now();

var ctx = null;

for (let i=0 ;i<50000;i++) {
  ctx = app.httpServ.context();
  ctx.path = '/';
  ctx.ip = '127.0.0.1';
  ctx.requestCall = (c) => {
    c.send('success');
  };
  ctx = null;
}

var end_time = Date.now();

console.log(end_time - start_time, 'ms');
