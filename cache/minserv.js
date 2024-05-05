'use strict';

const titbit = require('../lib/titbit.js')
const cluster = require('cluster');

let http2_on = false

if (process.argv.indexOf('--http2') > 0) {
  http2_on = true
}

const app = new titbit({
  debug: true,
  globalLog: true,
  useLimit: true,
  maxIPRequest: 10,
  unitTime: 12,
  maxpool : 5000,
  timeout : 3000,
  maxQuery: 8,
  //fastParseQuery: true,
  //loadInfoFile : '--mem'
  keepAlive: 12000,
  strong: true,
  http2: http2_on,
})

/* 
const v8 = require('v8');
setInterval(() => {
  console.log(v8.getHeapStatistics())
}, 2000)
 */

async function delay(tm) {
  await new Promise((rv, rj) => {
    setTimeout(() => {
      rv()
    }, tm)
  })
  return true
}

app.get('/', async c => {
  await new Promise((rv, rj) => {
    setTimeout(() => {
      rv()
    }, parseInt(Math.random() * 25) + 40)
  })

  c.send({
    query: c.query
  })

})

app.get('/null', async c => {
  c.res.body = null
})

app.get('/emit-error', async c => {})

app.get('errcode', async c => {
  c.send('not found', 404)
})

app.post('/data', async c => {
  c.send(c.body)
})

app.post('/upload', async c => {
  c.send(c.files)
})

app.get('/ok', async c => {
  await new Promise((rv, rj) => {
    setTimeout(() => {
      rv()
    }, 10)
  })

  c.send('ok')
})

app.get('/error', async c => {
  let r = parseInt(Math.random() * 11)

  if (r > 5) {
    console.log('abort')
    c.request.emit('aborted')
  } else {
    console.log('error')
    c.request.emit('error', new Error('eee'))
    c.response.emit('error')
  }

  c.send('ok')

})

app.get('/timeout', async c => {
  
  await delay(400)

  c.reply.write('123')

  await delay(2000)

  c.reply.write('234')


  await delay(2000)

  c.reply.write('234')

  //await delay(26000)

  c.send('out')
})

/* 
if (cluster.isWorker) {
  setInterval(() => {
    process.send({
      type : 'get-load-info'
    })
  }, 1000)

  process.on('message', msg => {
    console.log(process.pid, '\n')
    console.log(msg)
  })

} else {
  app.setMsgEvent('get-load-info', (w, msg) => {
    w.send(app.monitor.loadCache)
  })
}
 */

if (process.argv.indexOf('-c') > 0) {
  app.autoWorker(4)
  app.daemon(1234, 2)
  //app.daemon(1235, 3)
} else {
  app.run(1234)
  setInterval(() => {

    app.server.getConnections((err, conn) => {
      console.log(conn)
    })

  }, 3000)

  app.server.requestTimeout = 50
  app.server.maxHeadersCount = 80
  
}

/* if (cluster.isMaster) {
  setTimeout(() => {
    for (let k in cluster.workers) {
      cluster.workers[k].emit('error', new Error('test err'))
    }
  }, 1600)
}
 */
