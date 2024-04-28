const titbit = require('../lib/titbit');

let app = new titbit();

app.get(`/start/*`, async c => {
  c.res.body = c.param;
});

app.get(`/:test/:o/:key/:z/:t`, async c => {
  c.res.body = c.param;
});

app.get(`/test/:o/:key/:z/:t`, async c => {
  c.res.body = c.param;
});

app.get(`/test/x/:key/:z/:t`, async c => {
  c.res.body = c.param;
});

app.get(`/test/:o/:key/:z/:t/oo`, async c => {
  c.res.body = c.param;
});

for(let i=0; i < 50; i++) {
  app.get(`/test/${i}`, async c => {});

  app.get(`/test/${i}/*`, async c => {
    c.res.body = 'unix';
  });

  app.get(`/test/${i}-*`, async c => {});

  app.get(`/test/x/${i}/:z/:t`, async c => {
      c.res.body = i;
  });

  app.post(`/test/x/${i}/:z/:t`, async c => {
      c.res.body = i;
  });

  app.get(`/test/linux/unix/${i}`, async c => {
      c.res.body = 'unix';
  });

  app.get(`/test/${i}/x/y/*`, async c => {
    c.res.body = `x y ${i}`;
  });
  
}

app.router.argsRouteSort()

for (let m in app.router.argsRoute) {
  console.log(m, '')
  for (let a of app.router.argsRoute[m]) {
    console.log(`  ${a.path}`)
  }
}

console.log(app.router.findRealPath('/test/35', 'GET'))

console.log(app.router.findRealPath('/test/x/49/x/y', 'GET'))

console.log(app.router.findRealPath('/test/35/a/s/d', 'GET'))

console.log(app.router.findRealPath('/test/35/x/y/w/e/r', 'GET'))

console.log(app.router.findRealPath('/test/35-*', 'GET'))

console.log(app.router.apiTable.GET['/test/x/1/:z/:t'])
