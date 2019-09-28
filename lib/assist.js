const fs = require('fs');

/**
 * @param {string|array} certs
 * @param {string|array} keys
 */
exports.readSSLFiles = function (certs, keys) {
    let sslobj = {
        cert : [],
        key  : []
    };

    if (typeof certs === 'string') {
        sslobj.cert = fs.readFileSync(certs);
    }

    if (typeof keys === 'string') {
        sslobj.key = fs.readFileSync(keys);
    }

    if (certs instanceof Array) {
        for (let i=0; i<certs.length; i++) {
            sslobj.cert.push(fs.readFileSync(certs[i]));
        }
    }

    if (keys instanceof Array) {
        for (let i=0; i<keys.length; i++) {
            sslobj.key.push(fs.readFileSync(keys[i]));
        }
    }

    return sslobj;
};
