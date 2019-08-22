'use strict';

const titbit = require('./lib/titbit');

var app = new titbit({
    debug: true,
    useLimit: true,
    maxIPRequest: 520,
    peerTime: 2,
    cert : './rsa/localhost-cert.pem',
    key : './rsa/localhost-privkey.pem',
    http2: true,
    showLoadInfo: false,
});

//app.add(app.box.bodyparser);
//app.add(app.box.router);

var {router} = app;

router.get('/', async ctx => {
    ctx.res.data = 'ok';
});

router.post('/p', async ctx => {
    ctx.res.data = ctx.bodyparam;
});

app.add(async (ctx, next) => {
    console.log('middleware for POST/PUT');
    await next(ctx);
}, {method: 'POST,PUT'});

app.daemon(1990);
