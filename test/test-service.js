'use strict'

const titbit = require('../main')

const app = new titbit({
  debug: true,
  //globalLog: true
  useLimit: false,
  maxpool : 5000
})
/* 
app.service = {
  'abc' : 1234
} */

app.addService('abc', 1234)

app.get('/service', async c => {  
  console.log(c.service)
  c.send(c.service)
})

if (process.argv.indexOf('-c') > 0) {
  app.daemon(1234, 3)
  //app.daemon(1235, 3)
} else {
  app.run(1234)
}
