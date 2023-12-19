'use strict'

const titbit = require('../lib/titbit.js')

const app = new titbit({
  debug: true,
  loadInfoFile: '--mem'
})

/* 
app.midware.addFinal = () => {
  return async (c, next) => {
    return c.reply.end('ok')
  }
}

app.pre(async (c, next) => {
  return c.reply.end('ok')
})
 */

app.get('/home', async c => {
  c.send('home page')
})

let mid_timing = async (c, next) => {
  console.time('request')
  await next()
  console.timeEnd('request')
}

app.trace('/o', async c => {})

app.router.group('/api', (route) => {
  route.get('/test', async c => {
    c.send('api test')
  })

  route.get('/:name', async c => {
    c.send(c.param)
  })

  route.trace('/o', async c => {})
})
.use(async (c, next) => {
  console.log(c.group, c.path, c.routepath)
  await next()
})
.pre(async (c, next) => {
  console.log(c.method, c.headers)
  await next()
})
.middleware([mid_timing])
.middleware(async(c, next) => {
  console.log('test for middleware')
  await next()
}, {pre: true})

app.group('测试', route => {
  route.get('/test', async c => {
    console.log(c.group, c.name)
    c.send('test ok')
  }, 'test')
})
.use(async (c, next) => {
  console.log('测试组')
  await next()
})

app.daemon(1234, 2)

//app.run(1234)

//console.log(app.midware.midGroup)