'use strict';

const titbit = require('../main')

const app = new titbit({
  debug: true,
  //globalLog: true
  useLimit: false,
  ctxpool : 3000
})

app.get('/', async c => {
  await new Promise((rv, rj) => {
    setTimeout(() => {
      rv()
    }, parseInt(Math.random() * 5) + 100)
  })

  c.send('success')
})

app.get('/ok', async c => {
  c.send('ok')
})

app.run(1234)

