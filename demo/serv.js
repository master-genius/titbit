'use strict';

const titbit = require('../main');
const zlib = require('zlib');
const fs = require('fs');

var app = new titbit({
    //daemon: true,
    bodyMaxSize: 80000000,
    debug: true,
    useLimit: true,
    //deny : ['10.7.10.149'],
    maxIPRequest: 480,
    peerTime: 1,
    cert : '../rsa/localhost-cert.pem',
    key : '../rsa/localhost-privkey.pem',
    http2: true,
    showLoadInfo: false,
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

app.service.router = app.router;

var {router} = app;

router.options('/*', async c => {
    console.log(c.param.starPath);
    c.res.setHeader('Access-control-allow-origin', '*');
    c.res.setHeader('Access-control-allow-methods', app.router.methodList);
}, 'options-check');

router.get('/', async ctx => {
    ctx.res.body = 'ok';
});

router.post('/p', async ctx => {
    ctx.res.body = ctx.body;
}, '@post');

router.post('/pt', async ctx => {
    ctx.res.body = ctx.body;
}, {name: 'post-test2', group: 'post'});

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
}, {name: 'upload-image'});

router.post('/upload', async c => {
    try {
        console.log(c.files);
        let results = [];
        let tmp = '';
        let images = c.getFile('image', -1);
        for(let i=0; i<images.length; i++) {
            tmp = await c.moveFile(images[i], {
                path : process.env.HOME + '/tmp/buffer',
            });
            results.push(tmp);
        }
        c.res.body = results;
    } catch (err) {
        console.log(err);
        c.res.body = err.message;
    }
}, {name: 'upload-image', group: 'upload'});

app.use(async (c, next) => {
    if (c.getFile('file') === null) {
        c.res.body = 'file not found -> c.files.file';
        return ;
    }
    await next(c);

}, 'upload-file');

router.put('/upload', async c => {
    try {
        console.log(c.files);
        console.log(c.body);
        let files = c.getFile('file', -1);
        let results = [];
        let tmp = '';
        for(let i=0; i<files.length; i++) {
            try {
                tmp = await c.moveFile(files[i], {
                    path: process.env.HOME+'/tmp/a'
                });
                results.push(tmp);
            } catch (err) {
                console.log(err);
            }
        }
        c.res.body = results;
    } catch (err) {
        c.res.body = err.message;
    }
}, {name:'upload-file', group:'upload'});

router.get('/err', async ctx => {
    throw 'Error: test';
});

router.get('/app', async c => {
    c.res.body = c.service.router.group();
});

app.use(async (c, next) => {
    c.res.setHeader('content-encoding', 'gzip');
    c.res.setHeader('content-type', 'text/plain; charset=utf-8');
    c.stream.respond(c.res.headers);
    await next(c);
    let wdat = await new Promise((rv, rj) => {
        zlib.gzip(c.res.body, {encoding:'utf8'}, (err, data) => {
            if (err) {rj (err);}
            rv(data);
        });
    });
    c.stream.write(wdat);
    c.res.body = null; //最后不再返回数据。
}, {name: 'gzip-test'});

router.get('/quantum', async c => {
    c.res.body = await new Promise((rv, rj) => {
        fs.readFile('../tmp/quantum', {encoding:'utf8'}, (err, data) => {
            if (err) { rj(err); }
            rv(data);
        });
    });
}, 'gzip-test');

router.get('/router', async c => {
    c.res.body = [
        c.service.router.routeTable(),
        c.service.router.group()
    ];
});

app.daemon(2021, 3);
