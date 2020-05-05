const titbit = require('../main');

var app = new titbit();

for(let i=0; i<80; i++) {
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
    t = app.router.findRealPath('/test/x/79/123/345', 'GET');
    t = app.router.findRealPath('/test/linux/unix/79', 'GET');

    if (t) {
        count += 2;
    }
}

let endTime = Date.now();

console.log('timing', endTime - startTime);
console.log(count);
