const doio = require('../lib/titbit.js');

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

try {
  console.log('测试 模式冲突 路由添加...')
  app.get('/p/:x/:y/:z/:k', async c => {})
} catch (err) {}

app.get('/static/*', async c => {});

app.get('/file/download/*', async c => {});

app.get('/:sys/:release/iso/:handle', async c => {});

app.get('/xyz', async c => {});

app.get('/xyz/:key/oop/:oop', async c => {});
app.get('/xyz/:key/oo/:oop', async c => {});

try {
  console.log('---测试非法路由字符串---')
  app.get('/^*', async c => {})
} catch (err) {
  console.log(err.message)
}

let test_arr = [
  ['/p/wang/1/25/:', 'GET'],
  ['/static/css/a.css', 'GET'],
  ['/file/download/linux/ubuntu/20.04.iso', 'GET'],
  ['/unix/freebsd/iso/download', 'GET'],
  ['/:sys/:release/iso/:handle', 'GET'],
  ['/:sys/:release/iso/:handle/a', 'GET'],
  ['/xyz', 'GET'],
  ['/xyz/1235/oop/oop', 'GET'],
  ['/xyz/1235/oo/oop', 'GET']
]

test_arr.forEach(a => {
  console.log('find path:', a[0], a[1])
  let r = app.router.findRealPath(a[0], a[1])
  if (!r) {
    console.log('    ----', 'not found\n')
  } else {
    console.log('    path:', r.key, ' args:', r.args, '\n')
  }
})

