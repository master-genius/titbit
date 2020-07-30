const titbit = require('../main');

var app = new titbit();

for(let i=0; i<300; i++) {
    app.get(`/test/x/${i}/:z/:t`, async c => {
        c.res.body = i;
    });

    app.post(`/test/x/${i}/:z/:t`, async c => {
        c.res.body = i;
    });

    app.get(`/test/linux/unix/${i}`, async c => {
        c.res.body = 'unix';
    });
}

let startTime = Date.now();

let t = '';
let count = 0;
for (let i=0; i<72000; i++) {
  if ( app.router.findRealPath('/test/x/79/123/289', 'GET') ) {
    count += 1;
  }

  if ( app.router.findRealPath('/test/linux/unix/299', 'GET') ) {
    count += 1;
  }
}

let endTime = Date.now();

console.log('timing', endTime - startTime, count);
console.log(parseInt(count / (endTime - startTime)) * 1000 );

