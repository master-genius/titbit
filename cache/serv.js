'use strict';

const titbit = require('../main');
const zlib = require('zlib');
const fs = require('fs');
const cluster = require('cluster');

//cluster.schedulingPolicy = cluster.SCHED_NONE;

var app = new titbit({
    //daemon: true,
    maxBody: 150000000,
    maxFiles: 50,
    debug: true,
    useLimit: true,
    //deny : ['192.168.3.4'],
    maxIPRequest: 2000,
    maxConn: 100,
    unitTime: 1,
    timeout : 10000,
    cert : './rsa/localhost-cert.pem',
    key : './rsa/localhost-privkey.pem',
    http2: true,
    server : {
      //allowHTTP1: true
    },
    showLoadInfo: true,
    loadInfoType : 'text',
    //globalLog: true,
    //logType: 'stdio',
    loadInfoFile: '/tmp/loadinfo.log',
    //loadInfoFile : '',
    monitorTimeSlice: 292
});

//app.workerCount.max = 8

app.autoWorker(5)

//app.sched('none')

async function delay(t) {
  return await new Promise((rv, rj) => {
    setTimeout(() => {
      rv();
    }, t);
  });
}

//app.secure.maxrss = 36860000*2;
//console.log(app.secure.maxmem/1024/1024)

//app.service = {};

app.addService('ok', true);

app.addService({
  a: 23,
  b: 45
})

app.service.router = app.router;

var {router} = app;

var _userAgentCache = {};
/* 
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
  if (tm - uak.time > 2000) {
    uak.count = 1;
    uak.time = tm;
  }

  if (uak.count > 650) {
    c.status(429);
    c.res.body = 'too many request';
    return ;
  }

  uak.count += 1;

  await next();

});
 */

app.use(async (c, next) => {
  c.setHeader('Access-control-allow-origin', '*');
  c.setHeader('Access-control-allow-methods', app.router.methods);
  c.setHeader('access-control-request-headers', 'content-type');
  
  await next();
});

router.options('/*', async c => {
  
});

router.get('/', async ctx => {
  ctx.res.body = {
    ok : 'ok',
    query : ctx.query
  };
});

app.get('/:name/:age/:detail', async c => {
  c.res.body = c.param
})

app.get('/timeout/:tm', async c => {

  await delay(parseInt(c.param.tm))

  c.send('timeout ok')
})

app.get('/rand/timeout', async c => {

  c.reply.write('123')

  await delay(parseInt(Math.random() * 1000))

  c.res.body = 'timeout ok'
})

router.get('/ctx', async ctx => {
  
  console.log(ctx);

  let ctxjson = {};
  let tp = '';
  for (let k in ctx) {
    tp = typeof ctx[k];
    if (tp == 'string' || tp == 'number') {
      ctxjson[k] = ctx[k];
    }
  }

  ctx.res.body = JSON.stringify(ctxjson);

});

app.get('/status/:code', async c => {
  c.send(`status ${c.param.code} send`, c.param.code)
})

router.get('/test', async ctx => {

  await delay(30);
  console.log('ok start');

  await delay(25);

  console.log('not end');
  
  await delay(25);
  console.log('ha ha!');
  
  let tout = parseInt(Math.random() * 50);

  await delay(tout);

  await new Promise((rv, rj) => {
    setTimeout(() => {
      rv();
    }, delay);
  });

  let astr = '我是中国人\n中华民族伟大复兴！\n';
  for (let i=0; i<12; i++) {
    astr += astr;
  }

  ctx.res.body = Buffer.from(`${astr}`);
});

router.post('/p', async ctx => {
    ctx.res.body = ctx.body;
}, '@post');

router.post('/pt', async ctx => {
    ctx.res.body = ctx.body;
}, {name: 'post-test2', group: 'post'});

app.get('/html', async c => {
  c.res.body = `<!DOCTYPE html><html>
      <head>
        <meta charset="utf-8">
      </head>
      <body>
        <div style="color:#676869;font-size:125%;text-align:center;">Great</div>
      </body>
    </html>`;
});

/* app.use(async (ctx, next) => {
    var start_time = Date.now();
    await next();
    var end_time = Date.now();
    var timing = end_time-start_time;
    console.log(process.pid,ctx.path, `: ${timing}ms`);
}); */

app.get('/pid', async c => {
  c.res.body = process.pid
})

app.use(async (ctx, next) => {
  
  console.log(ctx.body, ctx.files)

  console.log('checking file');
    if (!ctx.isUpload) {
        return ;
    }
    if (!ctx.getFile('image')) {
        ctx.res.body = 'file not found, please upload with name "image" ';
        return ;
    }
    await next();
}, {name: 'upload-image'});

router.post('/upload', async c => {
  try {
    /* console.log(c.files);
    console.log(c.body); */

    let files = c.getFile('image', -1);
    let results = [];
    let fname = '';

    for(let i=0; i<files.length; i++) {
      try {
        fname = `${process.env.HOME}/tmp/a/${c.helper.makeName(files[i].filename)}`;
        await c.moveFile(files[i], fname);
        results.push(fname);
      } catch (err) {
        console.error(err);
      }
    }
    c.res.body = results;
  } catch (err) {
      c.res.body = err.message;
  }
}, {name: 'upload-image', group: 'upload'});

app.use(async (c, next) => {
    if (c.getFile('file') === null) {
        c.send('file not found -> c.files.file');
        return ;
    }
    await next();

}, 'upload-file');

router.put('/upload', async c => {
  try {
    console.log(c.files);
    console.log(c.body);
    let files = c.getFile('file', -1);
    let results = [];
    let fname = '';

    for(let i=0; i < files.length; i++) {
      try {
        fname = `${process.env.HOME}/tmp/a/${c.helper.makeName(files[i].filename, `${i}`)}`;
        await c.moveFile(files[i], fname);
        results.push(fname);
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
    await next();
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
    c.res.body = data;
}, 'gzip-test');

router.get('/router', async c => {
    c.res.body = [
        c.service.router.routeTable(),
        c.service.router.group()
    ];
});

//worker中设置大量定时器，测试性能
//在设置1000个定时器，仍然可以处理请求，但是比较慢
//在设置10个以内的定时器，触发时间100ms以上，对整体的性能影响比较小。
//但是这也要看定时器中进行的任务处理耗时，如果定时器中处理的是异步则不会有太大的影响。
/*
if (cluster.isWorker) {
  let randtm = 0;
  for (let i=0; i < 100; i++) { 
    randtm = i+10;
    setInterval(() => {
      console.log(process.pid,'timeout', i, process.memoryUsage(), process.cpuUsage());
    }, randtm);
  }
}
*/

if (cluster.isWorker) {
  /*
  var _sysloadinfo = '';
  process.on('message', (msg) => {
    _sysloadinfo = msg;
    console.clear();
    console.log(msg);
  });

  setInterval(() => {
    process.send({type:'loadmsg'}, undefined, undefined, (err) => {});
  }, 1000);

  app.get('/loadinfo', async c=>{
    c.res.body = _sysloadinfo;
  });
*/

}

if (process.argv.indexOf('-d') > 0) {
  app.config.daemon = true;
}

if (app.isMaster) {
  console.log(process.pid, 'master')
}


if (app.isWorker) {
  console.log(process.pid, 'worker')
  setTimeout(() => {
    console.log(process.pid,app.service)
  }, 100)
}

let serv = app.daemon(1234, 2);

if (app.isPrimary) {
  console.log(process.pid, 'master')
  console.log(app.service)
}

/* 
if (cluster.isWorker) {

  setInterval(() => {
    serv.getConnections((err,count) => {
      console.log('conn',count)
    })
  }, 5000)

}
 */
