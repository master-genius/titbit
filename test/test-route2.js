const titbit = require('../main');

var app = new titbit();

for(let i=0; i < 50; i++) {
    app.get(`/test/:x/${i}/:z/:t`, async c => {
        c.res.body = i;
    });

    app.post(`/test/:x/${i}/:z/:t`, async c => {
        c.res.body = i;
    });

    app.get(`/test/:linux/:unix/${i}`, async c => {
        c.res.body = 'unix';
    });

    app.get(`/test/${i}/*`, async c => {
      c.res.body = 'unix';
    });
}

console.log('路由数量：', app.router.count);

let startTime = Date.now();

let t = '';
let count = 0;
for (let i=0; i < 60000; i++) {
  if ( app.router.findRealPath('/test/x/49/qwe/sdfe', 'GET') ) {
    count += 1;
  }

  if ( app.router.findRealPath('/test/49/qwe/dsv/ds/sd///////////asdff/', 'GET') ) {
    count += 1;
  }

  if ( app.router.findRealPath('/test/x/49/unix//////freebsd/', 'POST') ) {
    count += 1;
  }

  if ( app.router.findRealPath('/test/linux/unix/49/', 'GET') ) {
    count += 1;
  }
}

let endTime = Date.now();

console.log('timing', endTime - startTime, count);
console.log(parseInt(count / (endTime - startTime)) * 1000 );

