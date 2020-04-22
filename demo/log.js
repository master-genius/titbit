const titbit = require('../main');

process.on('exit', (code) => {
  console.log('EXIT CODE:', code);
});


var app = new titbit({
  debug: true,
  globalLog : true,
  logType : 'file',
  logFile : '/tmp/titbit.log',
  errorLogFile : '/tmp/titbit-error.log'
});

var _key = 'abcdefghijklmnopqrstuvwxyz123456';

app.get('/', async c => {
    c.res.body = 'success';
});

app.get('/uuid', async c => {
  c.send(c.helper.uuid('w_'));
});

app.post('/p', async c => {
    c.res.body = c.body;
});

app.get('/encrypt', async c => {
  c.res.body = c.helper.aesEncrypt(c.query.data, _key);
});

app.get('/decrypt', async c => {
  c.res.body = c.helper.aesDecrypt(c.query.data, _key);
});

app.daemon(8000);

