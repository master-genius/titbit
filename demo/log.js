const titbit = require('../main');

process.on('exit', (code) => {
  console.log('EXIT CODE:', code);
});


var app = new titbit({
  debug: true,
  globalLog : true,
  loadInfoType : 'text',
  loadInfoFile : '/tmp/titbit-loadinfo.log'
});

/*
 * 重写日志函数
 *
 * */

let gbl = app.httpServ.globalLog;

app.httpServ.globalLog = (method, rinfo) => {
  console.log('test for rewrite log:', method, rinfo);
  gbl(method, rinfo);
};

var _key = 'abcdefghijklmnopqrstuvwxyz123456';

app.get('/', async c => {
    c.res.body = 'success';
});

app.get('/uuid', async c => {
  c.res.body = c.helper.uuid('w_');
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


app.daemon(2021);

