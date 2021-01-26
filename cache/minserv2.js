'use strict';

const titbit = require('../main')

let http2_on = false

if (process.argv.indexOf('--http2') > 0) {
  http2_on = true
}

let sess_set = {
  maxConcurrentStreams : 20,
  maxHeaderListSize : 1024,
}

const app = new titbit({
  debug: true,
  globalLog: true,
  useLimit: false,
  maxpool : 5000,
  cert : './rsa/localhost-cert.pem',
  key : './rsa/localhost-privkey.pem',
  http2: http2_on,
  timeout: 5000,
  maxUrlLength: 180,
  realIP: true,
  server : {
    peerMaxConcurrentStreams : 100,
    settings : sess_set
  }
})

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
    }, parseInt(Math.random() * 5) + 100)
  })

  c.send('success' + (c.reply.id || '') )
})

app.get('/ok', async c => {
  await new Promise((rv, rj) => {
    setTimeout(() => {
      rv()
    }, 10)
  })

  c.send('ok' + (c.reply.id || '') )
})

app.get('/delay-error', async c => {
  
  await delay(10)
  //c.request.emit('error')
  c.reply.emit('error')

  await delay(100)

  c.reply.end('delay-error ok')

})

app.get('/frame-error', async c => {
  c.reply.emit('frameError', new Error('frame error test'))
})

app.post('/data', async c => {
  c.send(c.body)
})

app.post('/upload', async c => {
  c.send(c.files)
})

app.get('/timeout', async c => {
  
  await delay(3000)

  c.reply.write('123')

  c.reply.write('234')

  //c.reply.end()

  //此处会引发段错误。
  //await delay(36000)

  //c.send('out')
})

app.get('/url-too-long', async c => {
  c.send({
    query : c.query,
    url : c.request.url
  })
})

app.get('/error', async c => {
  let r = parseInt(Math.random() * 11)

  if (r > 5) {
    console.log('abort')
    c.request.emit('aborted')
  } else {
    console.log('error')
    c.request.emit('error')
  }

  c.send('ok')

})

app.on('requestError', (err, stream, headers) => {
  console.log(err || 'error nothing')
  stream.close();
})

let maxStream = 8000;

app.run(1234).on('session', sess => {

  console.log('--', sess.localSettings, sess.remoteSettings)

  sess.settings(sess_set, (err, setting, dura) => {
  
    console.log('settings:', sess.localSettings, sess.remoteSettings)
  })

  sess.on('stream', (stream, headers) => {

    console.log(stream.id)

    if (stream.id > maxStream) {
      console.log('close')
      stream.close()
      return false
    }

  })

})

setInterval(() => {
  app.server.getConnections((err,count) => {
    console.log('conn',count)
  })
}, 5000)
