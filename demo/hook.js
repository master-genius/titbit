'use strict';

const titbit = require('../main');

var app = new titbit({
    debug: true,
    showLoadInfo: false,
    http2: true,
    key: '../rsa/localhost-privkey.pem',
    cert: '../rsa/localhost-cert.pem'
});

var {router} = app;

app.addHook(async (ctx, next) => {
    console.log('hook');
    await new Promise((rv, rj) => {
        setTimeout(() => {
            rv();
        }, 10);
    });
    if (!ctx.query.pass || ctx.query.pass !== '1990') { 
        ctx.res.body = 'deny~';
    } else {
        ctx.bodyMaxSize = 200;
        await next(ctx);
    }
}, {method:['POST','PUT']});

app.use(async (ctx, next) => {
    console.log('mid');
    await next(ctx);
});

router.get('/', async c => {
    c.res.body = 'ok';
});

router.post('/p', async c => {
    c.res.body = c.body;
});

app.run(1990);
