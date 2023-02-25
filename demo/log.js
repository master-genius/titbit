const titbit = require('../main');
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
  logType : 'file',
  logFile: '/tmp/access.log',
  errorLogFile : '/tmp/error.log',
  logMaxLines: 10,
  logHistory: 10
});

app.addService('name', 'brave');

var _key = 'abcdefghijklmnopqrstuvwxyz123456';

app.get('/', async c => {
    c.res.body = 'success';
},{name:'home', group:'/'});

app.get('/uuid', async c => {
  c.res.body = c.helper.uuid('w_');
});

app.post('/p', async c => {
    c.res.body = c.body;
});

app.get('/name', async c => {
  c.res.body = c.service.name;
});

app.get('/tout', async c => {

  await delay(18000);

  c.response.write('handling...');

  await delay(10000);

  c.res.body = 'timeout test';
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

  c.res.body = 'timeout test' + JSON.stringify(c.body);
});

app.get('/encrypt', async c => {
  c.res.body = c.helper.aesEncrypt(JSON.stringify(c.query), _key);
});

app.get('/decrypt', async c => {
  c.res.body = c.helper.aesDecrypt(c.query.data, _key);
});

app.get('/sha256', async c => {
  c.res.body = c.helper.sha256(`${Math.random()}${Date.now()}`);
});

//app.logger.watch();

app.daemon(2023, 2);
