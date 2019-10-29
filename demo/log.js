const titbit = require('../main');

process.on('exit', (code) => {
  console.log(code);
});


var app = new titbit({
    globalLog : true
});

app.get('/', async c => {
    c.res.body = 'success';
});

app.post('/p', async c => {
    c.res.body = c.body;
});

app.run(8000);
