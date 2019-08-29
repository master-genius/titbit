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
    /* await new Promise((rv, rj) => {
        setTimeout(() => {
            rv();
        }, 10);
    }); */
    if (!ctx.query.pass || ctx.query.pass !== '1990') { 
        ctx.res.body = 'deny~';
    } else {
        ctx.bodyMaxSize = 100000000;
        await next(ctx);
    }
}, {method:['POST','PUT']});

app.addHook(async (ctx, next) => {
    console.log('for GET');
    await next(ctx);
}, {method:'GET'});

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

app.run(1990);
