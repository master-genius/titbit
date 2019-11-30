'use strict';

const titbit = require('../main');

var app = new titbit({
    debug : true,
    allow : [
        '127.0.0.1'
    ],
    maxIPRequest: 10,
    peerTime: 5,
    useLimit: true,
    //http2: true,
    cert : '../rsa/localhost-cert.pem',
    key : '../rsa/localhost-privkey.pem',
    //showLoadInfo: true,
    //loadInfoFile : '/tmp/loadinfo.log'
});

app.use(async (c, next) => {
    c.cache = true;
    //await next(c);
});

app.get('/', async c => {
    throw new Error('test ok error after send');
    c.send('ok');
    
});

app.get('/test', async c => {
    c.send(c.name);
}, 'test');

app.daemon(2021, 2);
