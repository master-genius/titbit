'use strict';

const titbit = require('../main')

let http2_on = false

if (process.argv.indexOf('--http2') > 0) {
  http2_on = true
}

let https_on = true

if (process.argv.indexOf('--no-https') > 0) {
  https_on = false
}

const app = new titbit({
  debug: true,
  globalLog: true,
  useLimit: false,
  maxpool : 5000,
  cert : './rsa/localhost-cert.pem',
  key : './rsa/localhost-privkey.pem',
  http2: http2_on,
  https: https_on,
  timeout: 5000,
  socketTimeout: 6000,
  maxUrlLength: 18,
  realIP: true
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

  c.send('success')
})

app.get('/ok', async c => {
  await new Promise((rv, rj) => {
    setTimeout(() => {
      rv()
    }, 10)
  })

  c.send('ok')
})

app.get('/timeout', async c => {
  
  await delay(3000)

  c.reply.write('123')

  c.reply.write('234')

  //c.reply.end()

  //此处会引发段错误。
  await delay(36000)

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

let serv = app.run(1234)

setInterval(() => {
  serv.getConnections((err,count) => {
    console.log('conn',count)
  })
}, 5000)
