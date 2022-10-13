'use strict'

const titbit = require('../main')

const app = new titbit({
  debug: true,
  //globalLog: true
  useLimit: false,
  maxpool : 5000
})

app.addService('port', 1234)

app.get('/service', async c => {  
  console.log(c.service)
  c.send(c.service)
})

app.get('/', async c => {
  c.send('success')
})

if (process.argv.indexOf('-c') > 0) {
  app.daemon(1234, 3)
} else {
  app.run(1234)
}
