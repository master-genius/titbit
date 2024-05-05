'use strict';

const titbit = require('../lib/titbit.js');

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

let xyz = async (c, next) => {

  let tmstr = (new Date).toLocaleString()

  console.log('xyz: ',  tmstr)

  c.box.timestr = tmstr

  await next()

}

let midt = {
  detail : 'test for mid',


  mid : () => {
    return async (c, next) => {
      console.log(midt.detail)
      await next()
    }
  }

}

let midware = {

  detail: 'middleware test',

  middleware: async function (c, next) {
    console.log(this.detail)
    await next()
  }

}

app.use(m1).use(m2).pre(m3)
  .use(xyz, {name: ['time']})
  .use(midt)
  .pre(midware)

app.get('/', async c => {
  c.send('OK')
})

app.get('/time', async c => {
  c.send(c.box.timestr)
}, 'time')


app.run(1234);
