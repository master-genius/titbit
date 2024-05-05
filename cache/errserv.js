'use strict';

const titbit = require('../lib/titbit.js');

var app = new titbit({
    debug : true,
    maxIPRequest: 5,
    peerTime: 10,
    useLimit: true,
    maxConn: 20,
    //http2: true,
    cert : './rsa/localhost-cert.pem',
    key : './rsa/localhost-privkey.pem',
    showLoadInfo: true,
    loadInfoType : 'text',
    globalLog : true,
    logType: 'stdio',
    loadInfoFile : '/tmp/loadinfo.log',
    /* errorHandle: (err, errname) => {
        console.log('self error log', err)
    } */
});

app.get('', async c => {
    console.log(c.headers)
    c.send('ok')
}, 'home')

app.get('/test', async c => {
    c.send(c.name);
}, {group: 'test', name : 'test'})

app.get('/randerr', async c => {
    let n = parseInt(Math.random() * 100)
    if (n < 50) {
        throw new Error(`error code ${n}`)
    }
    c.send(n)
})

if (process.argv.indexOf('-c') > 0) {
  app.daemon(1234, 2)
} else {
  app.run(1234)
}
