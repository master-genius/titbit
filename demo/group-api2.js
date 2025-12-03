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

app.post('/d', async ctx => {
  ctx.send(ctx.body)
}, {group: 'data', name: 'data'})

app.post('/x', async ctx => {
  ctx.send(ctx.body)
}, {group: 'data', name: 'x'})

app.put('/y/:id', async ctx => {
  ctx.send({
    param: ctx.param,
    body: ctx.body
  })
}, {group: 'data', name: 'y'})

app.pre(async (ctx, next) => {
  console.log(ctx.group, ctx.path, 'start')
  await next()
  console.log(ctx.group, ctx.path, 'end')
}, '@data')

app.pre(async (ctx, next) => {
  console.log(ctx.group, ctx.path, 'start', Math.random())
  await next()
  console.log(ctx.group, ctx.path, 'end', Math.random())
}, {group: 'data', name: 'x'})

app.pre(async (ctx, next) => {
  console.log(ctx.group, ctx.path, ctx.routepath, 'start')
  await next()
  console.log(ctx.group, ctx.path, ctx.routepath, 'end')
}, {
  group: 'data',
  method: 'PUT',
  name: 'y'
})

app.run(1235)
