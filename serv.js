'use strict';

const titbit = require('./main');

var app = new titbit({
    bodyMaxSize: 80000000,
    debug: true,
    useLimit: true,
    //deny : ['10.7.10.149'],
    maxIPRequest: 500,
    peerTime: 1,
    cert : './rsa/localhost-cert.pem',
    key : './rsa/localhost-privkey.pem',
    //http2: true,
    //showLoadInfo: false,
    //globalLog: true,
    logType: 'stdio',
    pageNotFound: `<!DOCTYPE html>
        <html>
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width">
                <title>titbit - not found</title>
            </head>
            <body>
                <div style="margin-top:3.8rem;text-align:center;color:#565758;">
                    <h1>404 : page not found</h1>
                </div>
            </body>
        </html>
    `,
});

var {router} = app;

router.get('/', async ctx => {
    ctx.res.body = 'ok';
});

router.post('/p', async ctx => {
    ctx.res.body = ctx.body;
});

app.add(async (ctx, next) => {
    //console.log('middleware for POST/PUT');
    await next(ctx);
}, {method: ['POST','PUT']});

app.add(async (ctx, next) => {
    if (!ctx.isUpload) {
        return ;
    }
    if (!ctx.getFile('image')) {
        ctx.res.body = 'file not found, please upload with name "image" ';
        return ;
    }
    await next(ctx);
}, {preg: '/upload'});

var _total_time = 0;
app.add(async (ctx, next) => {
    var start_time = Date.now();
    await next(ctx);
    var end_time = Date.now();
    var timing = end_time-start_time;
    _total_time += timing;
    console.log(process.pid,ctx.path, `: ${timing}ms, total: ${_total_time}ms`);
});

router.post('/upload', async c => {
    try {
        c.res.body = await c.moveFile(c.getFile('image'), {
            path : process.env.HOME + '/tmp/buffer',
        });
    } catch (err) {
        c.res.body = err.message;
    }
});

router.get('/err', async ctx => {
    throw 'Error: test';
});

app.daemon(2021, 2);
