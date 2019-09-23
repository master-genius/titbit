const titbit = require('../main');
const fs = require('fs');
const cluster = require('cluster');

var app = new titbit({
    debug: true,
    //showLoadInfo: false,
});

if (cluster.isMaster) {
    var fwt = fs.watch('../tmp');

    fwt.on('change', (etype, filename) => {
        console.log(etype, filename);

        for(let id in cluster.workers) {
            cluster.workers[id].process.kill();
        }
    });

}

if (process.argv.indexOf('-d') > 0) {
    app.config.daemon = true;
}

app.daemon(2021, 2);
