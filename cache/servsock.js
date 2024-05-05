'use strict';

const titbit = require('../lib/titbit.js');
const zlib = require('zlib');
const fs = require('fs');
const cluster = require('cluster');

var app = new titbit({
    //daemon: true,
    maxBody: 1500000000,
    debug: true,
    useLimit: true,
    //deny : ['192.168.3.4'],
    maxIPRequest: 500,
    peerTime: 2,
    //cert : '../rsa/localhost-cert.pem',
    //key : '../rsa/localhost-privkey.pem',
    //http2: true,
    //showLoadInfo: true,
    loadInfoType : 'text',
    loadInfoFile : '/tmp/titbit-load.log',
    globalLog: true,
    //loadInfoFile: '/tmp/loadinfo.log',
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

let sockpath = '/tmp/titbit.sock';
try {
  fs.accessSync(sockpath);
  fs.unlinkSync(sockpath);
} catch (err) {
}

app.service.router = app.router;

var {router} = app;
/*
app.addHook(async (c, next) => {
  c.maxBody = 8;

  await next(c);
}, {method : ['POST','PUT']});
*/

var _userAgentCache = {};

app.use(async (c, next) => {
  if (c.headers['user-agent'] === undefined) {
    c.headers['user-agent'] = 'default-agent';
  }

  let ua = c.headers['user-agent'];

  let key = `${ua}:${c.ip}`;
  
  if (_userAgentCache[key] === undefined) {
    _userAgentCache[key] = {
      time : Date.now(),
      count : 1
    };
  }
  
  let uak = _userAgentCache[key];

  let tm = Date.now();
  if (tm - uak.time > 10000) {
    uak.count = 1;
    uak.time = tm;
  }

  if (uak.count > 150) {
    c.status(503);
    c.res.body = 'too many request';
    return ;
  }

  uak.count += 1;

  await next(c);

});

router.options('/*', async c => {
    console.log(c.param.starPath);
    c.setHeader('Access-control-allow-origin', '*');
    c.setHeader('Access-control-allow-methods', app.router.methods);
}, 'options-check');

router.get('/', async ctx => {
    let rsock = ctx.request.socket;
    console.log(ctx.headers, rsock.remoteFamily);
    ctx.send('ok');
});

router.get('/test', async ctx => {
  let delay = parseInt(Math.random() * 300);

  await new Promise((rv, rj) => {
    setTimeout(() => {
      rv();
    }, delay);
  });

  ctx.send(Buffer.from(`我是中国人${delay}\n`));
});

router.post('/p', async ctx => {
    ctx.res.body = ctx.body;
}, '@post');

router.post('/pt', async ctx => {
    ctx.res.body = ctx.body;
}, {name: 'post-test2', group: 'post'});

app.get('/html', async c => {
  c.html(`<!DOCTYPE html><html>
      <head>
        <meta charset="utf-8">
      </head>
      <body>
        <div style="color:#676869;font-size:125%;text-align:center;">Great</div>
      </body>
    </html>`);
});

app.use(async (ctx, next) => {
    var start_time = Date.now();
    await next(ctx);
    var end_time = Date.now();
    var timing = end_time-start_time;
    console.log(process.pid,ctx.path, `: ${timing}ms`);
});


/*
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
*/

app.use(async (ctx, next) => {
    console.log('checking file');
    if (!ctx.isUpload) {
        return ;
    }
    if (!ctx.getFile('image')) {
        ctx.String('file not found, please upload with name "image" ');
        return ;
    }
    await next(ctx);
}, {name: 'upload-image'});

router.post('/upload', async c => {
    try {
        console.log(c.files);
        let results = [];
        let tmp = '';
        let fname = '';
        let images = c.getFile('image', -1);

        for(let i=0; i<images.length; i++) {
            fname = `${process.env.HOME}/tmp/a/${c.helper.makeName(images[i].filename)}`;
            tmp = await c.moveFile(images[i], fname);
            results.push(tmp);
        }
        c.res.body = results;
    } catch (err) {
        console.log(err);
        c.send(err.message);
    }
}, {name: 'upload-image', group: 'upload'});

app.use(async (c, next) => {
    if (c.getFile('file') === null) {
        c.send('file not found -> c.files.file');
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
                //console.log('not move');
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
    c.send(c.service.router.group());
});

app.use(async (c, next) => {
    c.cache = true;
    c.setHeader('content-encoding', 'gzip');
    c.setHeader('content-type', 'text/plain; charset=utf-8');
    await next(c);
    c.resBody = await new Promise((rv, rj) => {
        zlib.gzip(c.resBody, {encoding:'utf8'}, (err, data) => {
            if (err) {rj (err);}
            rv(data);
        });
    });
}, {name: 'gzip-test'});

router.get('/quantum', async c => {
    let data = await new Promise((rv, rj) => {
        fs.readFile('../tmp/quantum', {encoding:'utf8'}, (err, data) => {
            if (err) { rj(err); }
            rv(data);
        });
    });
    c.send(data);
}, 'gzip-test');

router.get('/router', async c => {
    c.res.body = [
        c.service.router.routeTable(),
        c.service.router.group()
    ];
});

/*
if (cluster.isWorker) {
  setTimeout(() => {
    process.exit(2);
  }, 150);
}
*/

app.daemon(sockpath, 1);

