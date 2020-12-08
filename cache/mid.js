'use strict';

const titbit = require('../main');

const app = new titbit({
  debug: true,
  globalLog: true
});

async function m1(c, next) {
  console.log('    m1 start');
  await next();
  console.log('    m1 end');
}

async function m2(c, next) {
  console.log('    m2 start');
  await next();
  console.log('    m2 end');
}

async function m3(c, next) {
  console.log('m3 before data event');
  await next();
  console.log('m3 end');
}

app.use(m1).use(m2).pre(m3);

app.run(1234);
