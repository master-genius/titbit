'use strict';

const titbit = require('../main');

var app = new titbit({
    debug : true,
    allow : [
        '127.0.0.1'
    ],
    maxIPRequest: 1500,
    peerTime: 1,
    useLimit: false,
    maxConn: 2000,
    //http2: true,
    cert : './rsa/localhost-cert.pem',
    key : './rsa/localhost-privkey.pem',
    showLoadInfo: true,
    loadInfoType : 'text',
    globalLog : true,
    logType: 'stdio',
    loadInfoFile : '/tmp/loadinfo.log'
});

app.use(async (c, next) => {
  console.log('hook running');
  console.log(c.group, c.name, c.method, '\n');
  console.log(c.box);
  await next();

}, {pre : true});

app.use(async (c, next) => {
    console.log('middleware 1');
    await next();
    console.log('middleware 1 end');
}, 'home');

app.use(async (c, next) => {
    console.log('middleware 2');
    c.body.say = '你好';
    await next();
    console.log('middleware 2 end');
}, {group: 'test', method: 'POST'});

app.use(async (c, next) => {
    console.log('middleware 3');
    if (c.query.say == 'hey') {
        c.send('你好，test 接口 GET请求结束。');
    } else {
        await next();
    }
    console.log('middleware 3 end');
}, {group: 'test', method : 'GET'});

app.use(async (c, next) => {
    console.log('set body size');
    c.maxBody = 24;
    await next();
}, {name: 'test-post', pre: true});

app.use(async (c, next) => {
    console.log('middleware 4');
    c.body.x = 12;
    await next();
    console.log('middleware 4 end');
}, 'test-post');

app.get('/', async c => {
    c.send('ok');
}, 'home');

app.get('/test', async c => {
    c.send(c.name);
}, {group: 'test', name : 'test'});

app.post('/test', async c => {
    c.send(c.body);
}, {group: 'test', name : 'test-post'});

app.post('/transmit', async c => {
    c.send('ok');
}, 'transmit');

app.use(async (c, next) => {
    let total = 0;
    
    c.box.dataHandle = (data) => {
        total += data.length;
        if (total > 32) {
            c.response.statusCode = 413;
            c.response.end('太多了，限制32字节以内');
            return ;
        }
    };

    await next();

    console.log(total, 'bytes');

}, {pre: true, method: 'POST', name: 'transmit'});


app.daemon(2021, 2);
