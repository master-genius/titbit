/**
 * module global-log
 * Copyright (c) [2019.08] BraveWang
 * This software is licensed under the MPL-2.0.
 * You can use this software according to the terms and conditions of the MPL-2.0.
 * See the MPL for more details:
 *     https://www.mozilla.org/en-US/MPL/2.0/
 */

'use strict';

//const cluster = require('cluster');

var globalLog = {};

globalLog.http1 = function (method, rinfo) {
    var log_data = {
        type    : 'log',
        success : true,
        method  : method,
        link    : rinfo.link,
        time    : (new Date()).toLocaleString("zh-Hans-CN"),
        status  : rinfo.status,
        ip      : rinfo.ip
    };

    if (log_data.status != 200) {
        log_data.success = false;
    }
    if (process.send && typeof process.send === 'function') {
        process.send(log_data);
    }
};

globalLog.http2 = function (headers, sentHeaders, remote_ip) {
    var log_data = {
        type    : 'log',
        success : true,
        method  : headers[':method'],
        link    : '',
        time    : (new Date()).toLocaleString("zh-Hans-CN"),
        status  : sentHeaders[':status'],
        ip      : remote_ip
    };

    log_data.link=`${headers[':scheme']}://${headers[':authority']}${headers[':path']}`;

    if (log_data.status != 200) { log_data.success = false; }
    if (process.send && typeof process.send === 'function') {
        process.send(log_data);
    }
};

module.exports = globalLog;
