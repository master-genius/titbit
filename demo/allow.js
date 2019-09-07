'use strict';

const titbit = require('../main');

var app = new titbit({
    allow : [
        '127.0.0.1'
    ],
    maxIPRequest: 1,
    peerTime: 5,
    useLimit: true,
    http2: true,
    cert : '../rsa/localhost-cert.pem',
    key : '../rsa/localhost-privkey.pem',
});

app.router.get('/', async c => {
    c.res.body = 'ok';
});

app.router.get('/test', async c => {
    c.res.body = c.name;
}, 'test');


app.daemon(2021, 2);
