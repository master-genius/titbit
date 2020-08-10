'use strict';

const titbit = require('../main');

var app = new titbit({
  debug: true,
});

app.router.setPre('/blog');

app.get('/a', async c => {

});

app.get('/', async c => {

});

app.post('/a', async c => {

});

app.get('/a/:id', async c => {

});

app.router.printTable();

console.log(app.router.findRealPath('/a', 'GET'));

console.log(app.router.findRealPath('/blog/a/123', 'GET'));
