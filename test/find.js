const doio = require('../main');

const app = new doio();

try {
  app.get('/:name/:', async c => {});
} catch (err) {
  console.error(err.message);
}

try {
  app.get('/:content/*', async c => {});
} catch (err) {
  console.error(err.message);
}

try {
  app.get('/x/*/y', async c => {});
} catch (err) {
  console.error(err.message);
}

app.get('/p/:name/:id/:age/::', async c => {});

app.get('/static/*', async c => {});

app.get('/file/download/*', async c => {});

app.get('/:sys/:release/iso/:handle', async c => {});

app.get('/xyz', async c => {});


console.log(app.router.findRealPath('/p/wang/1/25/:', 'GET') );

console.log(app.router.findRealPath('/static/css/a.css', 'GET') );

console.log(app.router.findRealPath('/file/download/linux/ubuntu/20.04.iso', 'GET') );

console.log(app.router.findRealPath('/unix/freebsd/iso/download', 'GET') );

console.log(app.router.findRealPath('/:sys/:release/iso/:handle', 'GET') );

console.log(app.router.findRealPath('/:sys/:release/iso/:handle/a', 'GET') );

console.log(app.router.findRealPath('/xyz', 'GET') );