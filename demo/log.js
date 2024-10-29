const titbit = require('../lib/titbit.js');
const v8 = require('v8');
const cluster = require('cluster');

process.on('exit', (code) => {
  console.log('EXIT CODE:', code);
});

/*
if (cluster.isWorker) {
  setInterval(() => {
    console.log(v8.getHeapStatistics());
  }, 15000);
}
*/

async function delay(t) {
  return await new Promise((rv, rj) => {
    setTimeout(() => {
      rv();
    }, t);
  });
}

let app = new titbit({
  debug: true,
  globalLog : true,
  //loadInfoType : 'text',
  loadInfoFile : '/tmp/loadinfo.log',
  timeout : 15000,
  //socktimeout: 1000,
  useLimit: true,
  maxConn: 6000,
  logType : 'file',
  logFile: '/tmp/access.log',
  errorLogFile : '/tmp/error.log',
  logMaxLines: 10,
  logHistory: 10
});

app.addService('name', 'brave');

var _key = 'abcdefghijklmnopqrstuvwxyz123456';

app.get('/', async c => {
    c.data = 'success';
},{name:'home', group:'/'});

app.get('/uuid', async c => {
  c.data = c.ext.uuid()
});

app.get('/timeout/:tm', async ctx => {
  await new Promise((rv, rj) => {
    setTimeout(() => {
      rv()
    }, parseInt(ctx.param.tm) || 10)
  })

  ctx.send(`timeout ok ${ctx.param.tm}`)
});

app.post('/p', async c => {
    c.data = c.body;
});

app.get('/name', async c => {
  c.data = c.service.name;
});

app.get('/tout', async c => {

  await delay(1800);

  c.response.write('handling...');

  await delay(1000);

  c.data = 'timeout test';
});

app.post('/tout', async c => {
  await delay (119);

  console.log('start');
  c.response.write('start');
  
  await delay (119);

  console.log('not end');
  c.response.write('start 2');
  
  await delay(18000);

  c.response.write('handling...');

  await delay(10000);

  c.data = 'timeout test' + JSON.stringify(c.body);
});

app.get('/encrypt', async c => {
  c.data = c.helper.aesEncrypt(JSON.stringify(c.query), _key);
});

app.get('/decrypt', async c => {
  c.data = c.helper.aesDecrypt(c.query.data, _key);
});

app.get('/sha256', async c => {
  c.data = c.helper.sha256(`${Math.random()}${Date.now()}`);
});

//app.logger.watch();

app.sched('none')

app.daemon(2025, 2)
