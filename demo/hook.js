'use strict';

const titbit = require('../main');

var app = new titbit({
    debug: true,
    showLoadInfo: false,
    /*postHook:  async (ctx) => {
        console.log('hook');
        if (!ctx.query.pass || ctx.query.pass !== '1990') {
            await new Promise((rv, rj) => {
                setTimeout(() => {
                    rv();
                }, 100);
            });
            ctx.response.end('fucked');
        }
    } */
});

var {router} = app;

app.use(async (ctx, next) => {
    console.log('mid');
    await next(ctx);
});

router.get('/', async c => {
    c.res.body = 'ok';
});

router.post('/p', async c => {
    c.res.body = c.body;
});

app.run(1990);
