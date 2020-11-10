'use strict';

const titbit = require('../main')

const app = new titbit({
  debug: true,
  //globalLog: true
  useLimit: false,
  maxpool : 5000,
  timeout : 3000
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
    }, parseInt(Math.random() * 25) + 50)
  })

  c.send('success')

})

app.get('/null', async c => {
  c.res.body = 'null'
})

app.get('errcode', async c => {
  c.send('not found', 404)
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
  
  await delay(4000)

  c.reply.write('123')

  await delay(2000)

  c.reply.write('234')

  await delay(26000)

  c.send('out')
})

if (process.argv.indexOf('-c') > 0) {
  app.daemon(1234, 3)
  //app.daemon(1235, 3)
} else {
  app.run(1234)
}
