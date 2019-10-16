const titbit = require('../main');

var app = new titbit({
    globalLog : true,
    cert : '../rsa/localhost-cert.pem',
    key : '../rsa/localhost-privkey.pem',
    http2: true,
});

app.get('/', async c => {
    c.res.body = 'success';
});

app.post('/p', async c => {
    c.res.body = c.body;
});

app.daemon(8192);
