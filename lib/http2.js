/**
    module http2
    Copyright (C) 2019.08 BraveWang
    This program is free software; you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation; either version 3 of the License , or
    (at your option) any later version.
 */

'use strict';

const http2 = require('http2');
const helper = require('./helper');
const fs = require('fs');
const url = require('url');

class httpt {

    constructor (options) {
        this.config = options.config;
        this.router = options.router;
        this.events = options.events;
        this.midware = options.midware;
        this.service = options.service;
    }

    context () {
        var ctx = {
            config      : {},
            bodyMaxSize : 0,
            method      : '',
            url         : {
                host        : '',
                protocol    : '',
                href        : '',
                origin      : '',
                port        : '',
            },
            //客户端IP
            ip          : '',
            //实际的访问路径
            path        : '',
            name        : '',
            headers     : {},
            //实际执行请求的路径
            routepath   : '/',
            param       : {},
            query       : {},
            body        : {},
            isUpload    : false,
            group       : '',
            rawBody     : '',
            bodyBuffer  : [],
            bodyLength  : 0,
            files       : {},
            requestCall : null,
            helper      : helper,
            
            //在请求时指向实际的stream
            stream : null,
            //response 
            res         : {
    
                headers     : {
                    ':status' : '200',
                },
                data        : '',
                encoding    : 'utf8',
            },
    
            box : {},
    
            routerObj: null,

            service: null,
        };
    
        ctx.getFile = function(name, ind = 0) {
            if (ind < 0) { return ctx.files[name] || []; }
    
            if (ctx.files[name] === undefined) { return null; }
    
            if (ind >= ctx.files[name].length) { return null; }
    
            return ctx.files[name][ind];
        };
    
        ctx.res.setHeader = function(nobj, val = null) {
            if (typeof nobj === 'string' && val != null) {
                ctx.res.headers[nobj] = val;
            } else if (typeof nobj === 'object') {
                for(let k in nobj) {
                    ctx.res.headers[k] = nobj[k];
                }
            }
        };
    
        ctx.res.status = function(stcode = null) {
            if(stcode === null) {return parseInt(ctx.res.headers[':status']);}
            ctx.res.headers[':status'] = (typeof stcode == 'string' 
                                            ? stcode : stcode.toString());
        };
    
        ctx.moveFile = async function (upf, options) {
            return helper.moveFile(ctx, upf, options);
        };
    
        return ctx;
    }

    /**
     * 
     * @param {object} headers 
     * @param {object} sentHeaders 
     * @param {string} remote_ip 
     */
    globalLog (headers, sentHeaders, remote_ip) {
        var log_data = {
            type    : 'log',
            success : true,
            method  : headers[':method'],
            link    : '',
            time    : (new Date()).toLocaleString("zh-Hans-CN"),
            status  : sentHeaders[':status'],
            ip      : remote_ip
        };
    
        log_data.link=`${headers[':scheme']}://`
                +`${headers[':authority']}${headers[':path']}`;
    
        if (log_data.status != 200) { log_data.success = false; }
        if (process.send && typeof process.send === 'function') {
            process.send(log_data);
        }
    }

    onStream () {
        var self = this;
        var callback = (stream, headers) => {
            var onerror = (err) => {
                //stream.close(http2.constants.NGHTTP2_INTERNAL_ERROR);
                stream.destroy();
            };
            stream.on('frameError', onerror);
            stream.on('error', onerror);
            stream.on('aborted', () => {
                if (stream && !stream.closed) { stream.destroy(); }
            });
            var remote_ip = headers['x-real-ip'] || stream.session.socket.remoteAddress;
            if (self.config.globalLog) {
                stream.on('close', () => {
                    self.globalLog(headers, stream.sentHeaders, remote_ip);
                });
            }
        
            var urlobj = url.parse(headers[':path'], true);
            if (urlobj.pathname == '') { urlobj.pathname = '/'; }
            var rout = self.router.findRealPath(urlobj.pathname, headers[':method']);
            if (rout === null) {
                stream.respond({':status': '404'});
                stream.end(self.config.pageNotFound);
                return ;
            }
        
            var ctx = self.context();
            ctx.config = self.config;
            ctx.bodyMaxSize = self.config.bodyMaxSize;
            ctx.service = self.service;
            ctx.method = headers[':method'];
            ctx.url.host = headers[':authority'];
            ctx.url.protocol = headers[':scheme'];
            ctx.url.href = urlobj.href;
            ctx.url.origin = `${headers[':scheme']}://`
                            +`${headers[':authority']}${headers[':path']}`;
        
            ctx.ip = remote_ip;
            ctx.stream = stream;
            ctx.headers = headers;
            ctx.path = urlobj.pathname;
            ctx.query = urlobj.query;
            ctx.routerObj = rout;
            self.router.setContext(ctx);

            return self.midware.run(ctx);
        };
        
        return callback;
    }

    async requestMidware (ctx, next) {
        await new Promise((rv, rj) => {
            if (ctx.method == 'GET' || ctx.method == 'OPTIONS') {
                ctx.stream.on('data', (data) => {});
            } else if (ctx.method=='POST' || ctx.method=='PUT' || ctx.method=='DELETE') {
                ctx.stream.on('data', (data) => {
                    ctx.bodyLength += data.length;
                    if (ctx.bodyLength > ctx.bodyMaxSize) {
                        ctx.bodyBuffer = null;
                        ctx.stream.respond({':status' : '413'});
                        ctx.stream.end(`Body too large,limit:${ctx.bodyMaxSize/1024}Kb`);
                        ctx.stream.destroy(); //否则回报错，销毁stream就不会有读写事件发生。
                        return ;
                    }
                    ctx.bodyBuffer.push(data);
                });
            }
        
            ctx.stream.on('end',() => {
                if (ctx.stream.closed || ctx.stream.aborted || ctx.stream.destroyed) {
                    rj();
                } else {
                    rv();
                }
                
            });
        })
        .then(async () => {
            if (ctx.bodyBuffer.length > 0) {
                ctx.rawBody = Buffer.concat(ctx.bodyBuffer, ctx.bodyLength);
                ctx.bodyBuffer = null;
            }
            await next(ctx);
        }, err => {});
    }

    /** 
     * 运行HTTP/2服务
     * @param {number} port 端口号
     * @param {string} host IP地址，可以是IPv4或IPv6
     * 0.0.0.0 对应使用IPv6则是::
    */
    run (port, host) {
        var self = this;
        var serv = null;
        try {
            if (this.config.https) {
                this.config.server.key  = fs.readFileSync(this.config.key);
                this.config.server.cert = fs.readFileSync(this.config.cert);
                serv = http2.createSecureServer(this.config.server);
            } else {
                serv = http2.createServer(this.config.server);
            }
        } catch(err) {
            console.log(err);
            process.exit(-1);
        }

        var streamCallback = this.onStream();
        serv.on('stream', streamCallback);
        serv.on('sessionError', (err, sess) => {
            if (self.config.debug) {console.log('--DEBUG--SESSION-ERROR--:',err);}
            sess.close();
        });
        
        serv.on('tlsClientError', (err, tls) => {
            tls.destroy();
            if (self.config.debug) {console.log('--DEBUG--TLS--CONNECT--:', err);}
        });
        serv.setTimeout(self.config.timeout);

        for(let k in self.events) {
            if (typeof this.events[k] !== 'function') { continue; }
            if (k=='tlsClientError') { continue; }
            serv.on(k, this.events[k]);
        }
        serv.listen(port, host);
        return serv;
    }

}

module.exports = httpt;
