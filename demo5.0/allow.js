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

app.get('/', async c => {
    c.send('ok');
});

app.get('/test', async c => {
    c.send(c.name);
}, 'test');

app.daemon(2021, 2);
