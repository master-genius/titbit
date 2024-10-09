'use strict'

const Titbit = require('../lib/titbit.js')

let app = new Titbit({
  debug: true,
  globalLog: true
})

let sub = app.group('/api')

sub.pre(async (ctx, next) => {
  console.log('sub start')
  await next()
  console.log('sub end')
})

sub.get('/t', async ctx => {
  ctx.send({
    group: ctx.group,
    path: ctx.path
  })
})

let subsub = sub.group('/sub')

subsub.pre(async (ctx, next) => {
  console.log('sub 2 start')
  await next()
  console.log('sub 2 end')
})
.get('/.ok', async ctx => {
  ctx.send('ok')
})

subsub.get('/subt', async ctx => {
  ctx.send({
    group: ctx.group,
    path: ctx.path
  })
})

let ar = app.middleware([
  async (ctx, next) => {
    console.log('request timing start')
    console.time('request')
    await next()
    console.timeEnd('request')
  }
], {pre: true}).group('/ar')

ar.get('/test', async ctx => {
  ctx.send('test ar')
})

ar.post('/test', async ctx => {
  ctx.send(ctx.body)
})

let arsub = ar.group('/s')

arsub.use(async (ctx, next) => {
  console.log('ar sub start')
  await next()
  console.log('ar sub end')
})

arsub.get('/rich', async ctx => {
  ctx.send('success')
})


app.run(1213)
