/**
 * module global-log
 * Copyright (c) [2019.08] BraveWang
 * This software is licensed under the MPL-2.0.
 * You can use this software according to the terms and conditions of the MPL-2.0.
 * See the MPL for more details:
 *     https://www.mozilla.org/en-US/MPL/2.0/
 */

'use strict';

const cluster = require('cluster');

var globalLog = function (options = {}) {
/* 
    if (!options.httpVersion) {
        options.httpVersion = 1.1;
    };
 */
    if (! (this instanceof globalLog)) {return new globalLog(options); }

    if (!cluster.isWorker) {
        throw new Error('This module must be call in a child process.');
    }

    this.middleware1 = async (ctx, next) => {
        var request = ctx.request;
        var response = ctx.response;
        var protocol = ctx.app.config.https?'https://':'http://';
        var remote_ip = ctx.ip;
        ctx.response.on('finish', () => {
            var log_data = {
                type    : 'log',
                success : true,
                method  : request.method,
                link    : `${protocol}${request.headers['host']}/${request.url}`,
                time    : (new Date()).toLocaleString("zh-Hans-CN"),
                status  : response.statusCode,
                ip      : remote_ip
            };
        
            if (log_data.status != 200) {
                log_data.success = false;
            }
            if (process.send && typeof process.send === 'function') {
                process.send(log_data);
            }
            request = response = null;
        });
        await next(ctx);
    };

    this.middleware2 = async (ctx, next) => {
        var hd = ctx.headers;
        var stm = ctx.stream;
        var link = ctx.url.origin;
        var remote_ip = ctx.ip;
        ctx.stream.on('close', () => {
            var log_data = {
                type    : 'log',
                success : true,
                method  : hd[':method'],
                link    : link,
                time    : (new Date()).toLocaleString("zh-Hans-CN"),
                status  : stm.sentHeaders[':status'],
                ip      : remote_ip
            };
            if (hd['x-real-ip']) {
                log_data.ip = hd['x-real-ip'];
            }
        
            if (log_data.status != 200) { log_data.success = false; }
            if (process.send && typeof process.send === 'function') {
                process.send(log_data);
            }
            hd = stm = null;
        });
        await next(ctx);
    };
};

module.exports = globalLog;
