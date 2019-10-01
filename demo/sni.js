'use strict';

const titbit = require('../main');
const fs = require('fs');
const tls = require('tls');

var certs = {
    'daojian.w3xm.top' : {
        cert : fs.readFileSync('../tmp/daojian.w3xm.top.pem'),
        key  : fs.readFileSync('../tmp/daojian.w3xm.top.key')
    },

    'www.w3xm.top' : {
        cert : fs.readFileSync('../tmp/www.w3xm.top.pem'),
        key  : fs.readFileSync('../tmp/www.w3xm.top.key')
    }
};

var app = new titbit({
    debug: true,
    showLoadInfo: false,
    http2: true,
    https: true,
    server : {
        SNICallback : (servername, cb) => {
            return cb(null, tls.createSecureContext(certs[servername]));
        }
    },
    pidFile: 'mymaster.pid'
});

var {router} = app;

app.use(async (ctx, next) => {
    console.log('mid');
    await next(ctx);
});

app.use(async (c, next) => {
    if (!c.getFile('image')) {
        c.res.body = 'image not found';
        return ;
    }
    await next(c);
}, {method:'POST', group: 'upload'});

router.get('/', async c => {
    c.res.body = 'ok';
});

router.post('/p', async c => {
    c.res.body = c.body;
});

router.post('/upload', async c => {
    try {
        c.res.body = await c.moveFile(c.getFile('image'), {
            path: process.env.HOME + '/tmp/buffer'
        });
    } catch (err) {
        c.res.body = err.message;
    }
}, '@upload');

app.daemon(1990);
