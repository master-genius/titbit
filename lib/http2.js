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
    }

    context () {
        var ctx = {
            app         : null,
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
            param        : {},
            query       : {},
            body   : {},
            isUpload    : false,
            group       : '',
            rawBody     : '',
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
    
        ctx.moveFile = helper.moveFile;
    
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
            ctx.app = self.config.secureMode ? null : self;
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
        
            if (headers[':method'] == 'GET' || headers[':method'] == 'OPTIONS') {
                //应对恶意请求，请求类型不能携带主体数据，这时候如果有数据则立即关闭请求。
                stream.on('data', (data) => {
                    stream.respond({':status' : '400'});
                    //stream.close(http2.constants.NGHTTP2_REFUSED_STREAM);
                    stream.destroy();
                });
            } else if (ctx.method=='POST' || ctx.method=='PUT' || ctx.method=='DELETE') {
                var total_length = 0;
                stream.on('data', (data) => {
                    total_length += data.length;
                    if (total_length > self.config.bodyMaxSize) {
                        ctx.rawBody = '';
                        stream.respond({':status' : '413'});
                        stream.end(
                            `Body too large,limit:${self.config.bodyMaxSize/1024}Kb`
                        );
                        stream.destroy(); //否则回报错，销毁stream就不会有读写事件发生。
                        return ;
                    }
                    ctx.rawBody += data.toString('binary');
                });
            }
        
            stream.on('end',() => {
                if (stream.closed || stream.aborted || stream.destroyed) {return;}
                return self.midware.run(ctx);
            });
        };
        return callback;
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
            this.config.server.key  = fs.readFileSync(this.config.key);
            this.config.server.cert = fs.readFileSync(this.config.cert);
            serv = http2.createSecureServer(this.config.server);
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
