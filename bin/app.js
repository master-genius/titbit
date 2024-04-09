'use strict'

const Titbit = require('titbit')

const app = new Titbit({
  debug: true,
})

app.get('/', async ctx => {
  ctx.send('success')
})

app.post('/', async ctx => {
  ctx.send(ctx.body)
})

app.run(1234)
