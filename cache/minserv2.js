'use strict';

const titbit = require('../main')

const app = new titbit({
  debug: true,
  //globalLog: true
  useLimit: false,
  maxpool : 5000,
  cert : './rsa/localhost-cert.pem',
  key : './rsa/localhost-privkey.pem',
  http2: true,
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

  await delay(6000)

  //c.send('out')
})

app.run(1234)

