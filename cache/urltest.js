'use strict';

const titbit = require('../main')

const app = new titbit({
  debug: true,
  //globalLog: true,
  useLimit: true,
  //maxIPRequest: 10000,
  maxConn: 10000,
  maxUrlLength: 1000,
  //http2: true,
  cert : './rsa/localhost-cert.pem',
  key : './rsa/localhost-privkey.pem',
})

app.get('/', async c => {
  //console.log(c.query)
  c.send(c.query)
})

app.get('/url', async c => {

})

let serv = app.run(1234)


setInterval(() => {
  serv.getConnections((err,count) => {
    console.log(count)
  })
}, 2000)
