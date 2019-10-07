const titbit = require('../main');

var app = new titbit();

for(let i=0; i<40; i++) {
    app.get(`/test/x/${i}/:z/:t`, async c => {
        c.res.body = i;
    });

    app.post(`/test/x/${i}/:z/:t`, async c => {
        c.res.body = i;
    });

    app.get('/test/linux/unix/'+i, async c => {
        c.res.body = 'unix';
    });
}

let startTime = Date.now();

let t = '';
let count = 0;
for (let i=0; i<80000; i++) {
    t = app.router.findRealPath('/test/x/39/123/345', 'GET');
    //t = app.router.findRealPath('/test/linux/unix/99', 'GET');
    if (t) {
        count += 1;
    }
}

let endTime = Date.now();

console.log('timing', endTime - startTime);
console.log(count);
