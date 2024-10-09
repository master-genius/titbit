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
  console.log('time start')
  console.time('request')
  await next()
  console.timeEnd('request')
}

app.trace('/o', async c => {})

app.use(async (c, next) => {
  console.log('global request')
  await next()
}, {pre: true})

app.use(async (c, next) => {
  console.log('global pre')
  await next()
}, {pre: true})


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
  console.log('pre', c.method, c.headers)
  await next()
})

app.middleware([[mid_timing,], ]).group('验证', route => {
  route.use(async (ctx, next) => {
    console.log('    new route use test')
    await next()
    console.log('    new route use end')
  })

  route.get('/c/:o/:p', async c => {
    console.log(c.group, c.name)
    c.send(c.param)
  })

  route.middleware([
    async (c, next) => {
      console.log('group sub test')
      await next()
    },
    
    [
      async (c, next) => {
        console.log('group sub test 2')
        await next()
      },
      {pre: false}
    ]
  ], {pre: true, tag: 'sub'}).group('sub', r => {

    r.get('/oo', async c => {
      c.send(c.group)
    })

    r.middleware(async (c, next) => {
      console.log('sub sub test')
      await next()
    }).group('/sub', subr => {
      subr.get('/ok', async c => {
        c.send(c.group)
      })
    })

  })

})

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

app.daemon({port: 1234}, 2)

//app.run(1234)

//app.isWorker && console.log(app.midware.midGroup)
