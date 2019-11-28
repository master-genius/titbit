const titbit = require('../main');

var app = new titbit({
    http2: true,
    key : '../rsa/localhost-privkey.pem',
    cert: '../rsa/localhost-cert.pem',
    bodyMaxSize: 10,
});

var {router} = app;

router.head('/', async c=>{});

router.patch('/', async c => {
    c.res.body = c.body;
});

router.get('/', async c => {
    c.res.body = 'home page';
});

router.post('/', async c => {
    c.res.body = c.body;
});


app.daemon(2021, 2);

