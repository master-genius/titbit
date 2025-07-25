'use strict';

const titbit = require('../lib/titbit.js');

var app = new titbit({
    //daemon: true,
    maxBody: 2500000,
    debug: true,
    useLimit: true,
    //deny : ['10.7.10.149'],
    maxIPRequest: 480,
    peerTime: 1,
    showLoadInfo: false,
    globalLog: true,
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

router.options('/*', async c => {
  console.log(c.param.starPath);
  c.setHeader('Access-control-allow-origin', '*');
  c.setHeader('Access-control-allow-methods', app.router.methods);
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

router.get('/err', async ctx => {
  ctx.res.body = '500 error';
  ctx.status(500);
});

router.get('/a/:a/:b/', async c => {
  c.res.body = c.param;
});

router.get('x/*', async c => {
  c.res.body = c.param.starPath;
});

router.get('/:name/:id/:age', async c => {
  c.res.body = c.param;
});

//放在最后不会和/err冲突
router.get('/:name', async c => {
  c.send(c.param.name)
})

app.run(2023);

