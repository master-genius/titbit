const titbit = require('../lib/titbit.js')

const app = new titbit({
  debug: true,
  loadInfoFile: '--mem',
  //http2: true,
  key: __dirname + '/../cache/rsa/localhost-privkey.pem',
  cert: __dirname + '/../cache/rsa/localhost-cert.pem'
})

app.get('/js', async ctx => {
  await ctx.pipeText(__filename)
})

app.run(1230)
