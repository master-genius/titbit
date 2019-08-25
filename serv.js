'use strict';

const titbit = require('./main');

var app = new titbit({
    daemon: true,
    bodyMaxSize: 80000000,
    debug: true,
    useLimit: true,
    //deny : ['10.7.10.149'],
    maxIPRequest: 420,
    peerTime: 1,
    cert : './rsa/localhost-cert.pem',
    key : './rsa/localhost-privkey.pem',
    http2: true,
    //showLoadInfo: false,
    //globalLog: true,
    logType: 'stdio',
    loadInfoFile: '/tmp/loadinfo.log',
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
}, '@post');

router.post('/pt', async ctx => {
    ctx.res.body = ctx.body;
}, {name: 'post-test2', group: 'post'});

//var _total_time = 0;
app.use(async (ctx, next) => {
    var start_time = Date.now();
    await next(ctx);
    var end_time = Date.now();
    var timing = end_time-start_time;
    console.log(process.pid,ctx.path, `: ${timing}ms`);
});


app.use(async (ctx, next) => {
    console.log('middleware for POST/PUT');
    await next(ctx);
    console.log('middleware for POST/PUT -- ');
}, {method: ['POST','PUT']});

app.use(async (ctx, next) => {
    console.log('a1');
    await next(ctx);
    console.log('a1');
});

app.use(async (ctx, next) => {
    console.log('a2');
    await next(ctx);
    console.log('a2');
});

app.use(async (ctx, next) => {
    console.log('a3');
    await next(ctx);
    console.log('a3');
}, {group: 'post'});

app.use(async (ctx, next) => {
    console.log('checking file');
    if (!ctx.isUpload) {
        return ;
    }
    if (!ctx.getFile('image')) {
        ctx.res.body = 'file not found, please upload with name "image" ';
        return ;
    }
    await next(ctx);
}, {preg: '/upload'});

router.post('/upload', async c => {
    try {
        var upf = c.getFile('image');
        console.log(upf.length, upf.data.length);
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

//console.log(app.router);

app.daemon(2021, 3);
