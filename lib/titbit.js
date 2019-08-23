/**
 * titbit 1.8.0
 * Copyright (c) [2019.08] BraveWang
 * This software is licensed under the MPL-2.0.
 * You can use this software according to the terms and conditions of the MPL-2.0.
 * See the MPL for more details:
 *     https://www.mozilla.org/en-US/MPL/2.0/
*/
'use strict';

const fs = require('fs');
//const qs = require('querystring');
const http2 = require('http2');
const http = require('http');
const https = require('https');
const url = require('url');
//const crypto = require('crypto');
const cluster = require('cluster');
const os = require('os');
const {spawn} = require('child_process');

const bodyParser = require('./bodyparser');
const middleware1 = require('./middleware1');
const middleware2 = require('./middleware2');
const router = require('./router');
const helper = require('./helper');
const context = require('./context');
const connfilter = require('./connfilter');
const globalLog = require('./global-log');

/**
 * @param {object} options 初始化选项，参考值如下：
 * - ignoreSlash，忽略末尾的/，默认为true
 * - debug 调试模式，默认为false
 * - limit 最大连接数，使用daemon接口，则每个进程都可以最多处理limit限制数量，0表示不限制。
 * - deny  {Array} IP字符串数组，表示要拒绝访问的IP。
 * - maxIPRequest {number} 单个IP单元时间内最大访问次数。
 * - peerTime {number} 单元时间，配合maxIPRequest，默认为1表示1秒钟清空一次。
 * - maxIPCache {number} 最大IP缓存个数，配合限制IP访问次数使用，默认为15000。
 * - whiteList {Array} 限制IP请求次数的白名单。
 * - timeout {number} 超时。
 * - cert {string} 启用HTTPS要使用的证书文件路径。
 * - key  {string} 启用HTTPS的密钥文件路径。
 * - globalLog {bool} 启用全局日志。
 * - bodyMaxSize {number} 表示POST/PUT提交表单的最大字节数，包括上传文件。
 * - maxFiles {number} 最大上传文件数量，超过则不处理。
 * - daemon {bool} 启用守护进程模式。
 * - pidFile {string} 保存Master进程PID的文件路径。
 * - logFile {string}
 * - errorLogFile {string}
 * - logType {string} 日志类型，支持stdio、file、ignore
 * - server {object}  服务器选项，参考http2.createSecureServer
 * - pageNotFound {string} 404页面数据
 * - cors {string} 允许跨域的域名，*表示所有
 * - optionsReturn {bool} 是否自动返回OPTIONS请求，默认为true。
 * - parseBody {bool} 自动解析上传文件数据，默认为true。
 * - useMinMiddleware {bool} 使用最小中间件模式，此模式不支持分组和规则匹配，默认为false。
 * - useLimit {bool} 启用连接限制。
 * - http2 {bool} 默认false。
 */
var titbit = function (options = {}) {
    if (! (this instanceof titbit) ) {return new titbit(options);}
    this.config = {
        //此配置表示POST/PUT提交表单的最大字节数，也是上传文件的最大限制，
        bodyMaxSize     : 8000000,
        maxFiles        : 15,
        daemon          : false, //开启守护进程
        cors            : null,
        optionsReturn   : true,
        /*
            开启守护进程模式后，如果设置路径不为空字符串，则会把pid写入到此文件，可用于服务管理。
        */
        pidFile         : '',
        logFile         : './access.log',
        errorLogFile    : './error.log',
        /*
            日志类型：stdio   标准输入输出，可用于调试
                    ignore  没有
                    file    文件，此时会使用log_file以及error_log_file的路径
        */
        logType         : 'ignore',

        //开启HTTPS
        https           : false,

        http2   : false,

        //HTTPS密钥和证书的路径
        key     : '',
        cert    : '',

        //服务器选项，参考http2.createSecureServer
        server : {
            peerMaxConcurrentStreams : 100,
        },
        //设置服务器超时，毫秒单位，在具体的请求中，可以通过stream设置具体请求的超时时间。
        timeout     : 15000,
        debug       : false,
        pageNotFound    : 'page not found',
        //展示负载信息，必须使用daemon接口
        showLoadInfo:       true,
        //useMinMiddleware:   false,
        ignoreSlash: true,
        parseBody: true,
        //useRouter: true,
        useLimit: false,
        globalLog: false, //启用全局日志
    };

    this.limit = {
        maxConn         : 1024, //限制最大连接数，如果设置为0表示不限制
        deny            : [], //拒绝请求的IP。
        maxIPRequest    : 0, //每秒单个IP可以进行请求次数的上限，0表示不限制。
        peerTime        : 1, //IP访问次数限制的时间单元，1表示每隔1秒钟检测一次。
        maxIPCache      : 15000, //存储IP最大个数，是req_ip_table的上限，否则于性能有损。
        whiteList       : [], //限制IP请求次数的白名单。
    };

    if (typeof options !== 'object') { options = {}; }
    for(var k in options) {
        switch (k) {
            case 'maxConn':
                if (typeof options.maxConn=='number' 
                    && parseInt(options.maxConn) >= 0)
                {
                    this.limit.maxConn = options.maxConn;
                } break;
            case 'deny':
                this.limit.deny = options.deny; break;
            case 'maxIPRequest':
                if (parseInt(options.maxIPRequest) >= 0) {
                    this.limit.maxIPRequest = parseInt(options.maxIPRequest);
                } break;
            case 'peerTime':
                if (parseInt(options.peerTime) > 0) {
                    this.limit.peerTime = parseInt(options.peerTime);
                } break;
            case 'maxIPCache':
                if (parseInt(options.maxIPCache) >= 1024) {
                    this.limit.maxIPCache = parseInt(options.maxIPCache);
                } break;
            case 'whiteList':
                this.limit.whiteList = options.whiteList; break;

            case 'showLoadInfo':
            case 'logType':
            case 'daemon':
            case 'maxFiles':
            case 'bodyMaxSize':
            case 'pageNotFound':
            case 'cors':
            case 'optionsReturn':
            case 'useMinMiddleware':
            case 'debug':
            case 'server':
            case 'timeout':
            case 'globalLog':
            case 'logFile':
            case 'errorLogFile':
            case 'ignoreSlash':
            //case 'useRouter':
            case 'parseBody':
            case 'useLimit':
            case 'http2':
                this.config[k] = options[k]; break;
            default:;
        }
    }

    if (options.key && options.cert) {
        try {
            fs.accessSync(options.cert, fs.constants.F_OK);
            fs.accessSync(options.cert, fs.constants.F_OK);
            this.config.cert = options.cert;
            this.config.key = options.key;
            this.config.https = true;
        } catch (err) {
            throw(err);
        }
    }

    /**
     * 记录当前的运行情况
     */
    this.rundata = {
        conn : 0,
        platform : os.platform()
    };

    this.helper = helper;
    this.bodyParser = bodyParser;
    
    this.router = router(options);
    this.group = this.router.group;
    this.methodList = this.router.methodList;

    this.middleware = this.config.http2 ? middleware2(options) : middleware1(options);
    this.add = function (midcall, options = {}) {
        return this.middleware.add(midcall, this.router.apiGroupTable, options);
    };
    this.addFinalResponse = function () {
        this.middleware.addFinalResponse(this.router.apiGroupTable);
    };
    this.addMore = function (midcall, mapcond) {
        this.middleware.addMore(midcall, this.router.apiGroupTable, mapcond);
    };

    this.runMiddleware = this.middleware.runMiddleware;
    /** 请求上下文 */
    this.context = context;
    this.makeContext = this.config.http2 ? context.c2 : context.c1;

    //快速访问一些已有中间件
    this.box = {
        bodyparser : this.bodyParser.middleware,
        router     : this.router.middleware
    };
};

titbit.prototype.eventTable = {};
titbit.prototype.on = function(evt, callback) {
    this.eventTable[evt] = callback;
};

/**
 * request事件的回调函数。
 * @param {req} http.IncomingMessage
 * @param {res} http.ServerResponse
 */
titbit.prototype.onRequest = function (req, res) {
    var the = this;

    var callback = (req, res) => {
        req.on('abort', (err) => {res.statusCode = 400; res.end();});
        req.on('error', (err) => {
            req.abort();
            res.statusCode = 400;
            res.end();
        });

        var remote_ip = req.headers['x-real-ip'] || req.socket.remoteAddress;

        var urlobj = url.parse(req.url, true);
        if (urlobj.pathname == '') { urlobj.pathname = '/'; }

        var ctx = the.makeContext();
        ctx.app = the;
        ctx.method = req.method;
        ctx.url.host = req.headers['host'];
        ctx.url.protocol = urlobj.protocol;
        ctx.url.href = urlobj.href;
        ctx.ip = remote_ip;
        ctx.request = req;
        ctx.response = res;
        ctx.headers = req.headers;
        ctx.path = urlobj.pathname;
        ctx.param = urlobj.query;
        
        if (req.method == 'GET' || req.method == 'OPTIONS') {
            req.on('data', data => {
                res.statusCode = 400;
                res.end('bad request');
                req.abort();
            });
        }
        else if (req.method=='POST' || req.method=='PUT' || req.method=='DELETE')
        {
            var dataLength = 0;
            req.on('data', data => {
                dataLength += data.length;
                if (dataLength > the.config.bodyMaxSize) {
                    ctx.rawBody = '';
                    res.statusCode = 413;
                    res.end(`Body too large,limit:${the.config.bodyMaxSize/1000}Kb`);
                    req.destroy(new Error(`body too large`));
                    return ;
                }
                ctx.rawBody += data.toString('binary');
            });
        }
        req.on('end',() => {
            if (req.aborted || res.finished) { return; }
            return the.runMiddleware(ctx);
        });
    };

    return callback;
};

/**
 * 返回一个stream事件的回调函数，如果有必要，可以在原型上重写此方法。
 */
titbit.prototype.onStream = function () {
    var the = this;
    var callback = (stream, headers) => {
        var onerror = (err) => {
            stream.close(http2.constants.NGHTTP2_INTERNAL_ERROR);
        };
        stream.on('frameError', onerror);
        stream.on('error', onerror);
        stream.on('aborted', () => {
            if (stream && !stream.closed) {
                stream.close(http2.constants.NGHTTP2_INTERNAL_ERROR);
            }
        });
    
        var urlobj = url.parse(headers[':path'], true);
        if (urlobj.pathname == '') { urlobj.pathname = '/'; }
    
        var ctx = the.makeContext();
        ctx.app = the;
        ctx.method = headers[':method'];
        ctx.url.host = headers[':authority'];
        ctx.url.protocol = headers[':scheme'];
        ctx.url.href = urlobj.href;
        ctx.url.origin = `${headers[':scheme']}://`
                        +`${headers[':authority']}${headers[':path']}`;
    
        ctx.ip = stream.session.socket.remoteAddress;
        ctx.stream = stream;
        ctx.headers = headers;
        ctx.path = urlobj.pathname;
        ctx.param = urlobj.query;
    
        if (headers[':method'] == 'GET' || headers[':method'] == 'OPTIONS') {
            //应对恶意请求，请求类型不能携带主体数据，这时候如果有数据则立即关闭请求。
            stream.on('data', (data) => {
                stream.respond({':status' : '400'});
                stream.close(http2.constants.NGHTTP2_REFUSED_STREAM);
            });
        } else if (ctx.method=='POST' || ctx.method=='PUT' || ctx.method=='DELETE') {
            var total_length = 0;
            stream.on('data', (data) => {
                total_length += data.length;
                if (total_length > the.config.bodyMaxSize) {
                  ctx.rawBody = '';
                  stream.respond({':status' : '413'});
                  stream.end(`Body too large,limit:${the.config.bodyMaxSize/1024}Kb`);
                  stream.destroy(); //否则回报错，销毁stream就不会有读写事件发生。
                  return ;
                }
                ctx.rawBody += data.toString('binary');
            });
        }
    
        stream.on('end',() => {
            if (stream.closed || stream.aborted || stream.destroyed) {return;}
            return the.runMiddleware(ctx);
        });
    };
    return callback;
};

/** 
 * 根据配置情况确定运行HTTP/1.1还是HTTP/2
 * @param {number} port 端口号
 * @param {string} host IP地址，可以是IPv4或IPv6
 * 0.0.0.0 对应使用IPv6则是::
*/
titbit.prototype.run = function(port = 2020, host = '0.0.0.0') {
    if (this.config.parseBody) {
        this.add(this.bodyParser.middleware);
    }
    this.add(this.router.middleware);
    this.addFinalResponse(); //必须放在最后，用于返回最终数据。

    /**
     * 启用全局日志，这个其实也是一个中间件，要在最后添加，
     * 全局日志
     */
    if (this.config.globalLog) {
        var glogger = new globalLog();
        if (this.config.http2) {
            this.add(glogger.middleware2);
        } else {
            this.add(glogger.middleware1);
        }
    }

    if (this.config.useLimit) {
        var connlimit = new connfilter(this.limit, this.rundata);
        this.on('connection', connlimit.callback);
    }

    if (this.config.http2) {
        return this.runHTTP2(port, host);
    }
    return this.runHTTP1(port, host);
};

/** 
 * 运行HTTP/1.1服务
 * @param {number} port 端口号
 * @param {string} host IP地址，可以是IPv4或IPv6
 * 0.0.0.0 对应使用IPv6则是::
*/
titbit.prototype.runHTTP1 = function (port, host) {
    var the = this;
    var serv = null;

    if (this.config.https) {
        try {
            var opts = {
                key  : fs.readFileSync(this.config.key),
                cert : fs.readFileSync(this.config.cert)
            };
            serv = https.createServer(opts, this.onRequest());
            serv.on('tlsClientError', (err) => {
                if (the.config.debug) { console.log('--DEBUG-TLS-ERROR:', err); }
            });
        } catch(err) {
            console.log(err);
            process.exit(-1);
        }
    } else {
        serv = http.createServer(this.onRequest());
    }

    serv.on('clientError', (err, sock) => {sock.end("Bad Request");});
    serv.setTimeout(this.config.timeout);
    for(let k in the.eventTable) {
        if (typeof this.eventTable[k] !== 'function') { continue; }
        if (k=='tlsClientError') { continue; }
        serv.on(k, this.eventTable[k]);
    }
    serv.listen(port, host);

    return serv;
};

/** 
 * 运行HTTP/2服务
 * @param {number} port 端口号
 * @param {string} host IP地址，可以是IPv4或IPv6
 * 0.0.0.0 对应使用IPv6则是::
*/
titbit.prototype.runHTTP2 = function (port, host) {
    var the = this;
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
        if (the.config.debug) {console.log('--DEBUG--SESSION-ERROR--:',err);}
        sess.close();
    });
    
    serv.on('tlsClientError', (err, tls) => {
        if (the.config.debug) {console.log('--DEBUG--TLS--CONNECT--:', err);}
    });
    serv.setTimeout(the.config.timeout);

    for(let k in the.eventTable) {
        if (typeof this.eventTable[k] !== 'function') { continue; }
        if (k=='tlsClientError') { continue; }
        serv.on(k, this.eventTable[k]);
    }
    serv.listen(port, host);
    return serv;
};

/**保存进程负载情况 */
titbit.prototype.loadInfo = [];

/**
 * 通过loadInfo保存的数据计算并显示进程和系统的负载情况。
 * 这个函数只能在Master进程中调用。
 * @param {object} w 子进程发送的数据。
 */
titbit.prototype.showLoadInfo = function (w) {
    var total = Object.keys(cluster.workers).length;
    if (this.loadInfo.length == total) {
        this.loadInfo.sort((a, b) => {
            if (a.pid < b.pid) {
                return -1;
            } else if (a.pid > b.pid) {
                return 1;
            }
            return 0;
        });
        if (!this.config.daemon) { console.clear(); }

        var oavg = os.loadavg();

        var oscpu = `  CPU Loadavg  1m: ${oavg[0].toFixed(2)}  5m: ${oavg[1].toFixed(2)}  15m: ${oavg[2].toFixed(2)}\n`;

        var cols = '  PID       CPU       MEM       CONN\n';
        var tmp = '';
        var t = '';
        for(let i=0; i<this.loadInfo.length; i++) {
            tmp = (this.loadInfo[i].pid).toString() + '          ';
            tmp = tmp.substring(0, 10);
            t = this.loadInfo[i].cpu.user + this.loadInfo[i].cpu.system;
            t = (t/102400).toFixed(2);
            tmp += t + '%       ';
            tmp = tmp.substring(0, 20);
            tmp += (this.loadInfo[i].mem.rss / (1024*1024)).toFixed(2);
            tmp += 'M         ';
            tmp = tmp.substring(0, 30);
            tmp += this.loadInfo[i].conn.toString();
            cols += `  ${tmp}\n`;
        }
        cols += `  Master PID: ${process.pid}\n`;
        cols += `  Listen ${this.loadInfo[0].host}:${this.loadInfo[0].port}\n`;
        if (this.config.daemon) {
            try {
                fs.writeFileSync('./load-info.log',oscpu+cols, {encoding:'utf8'});
            } catch (err) { }
        } else {
            console.log(oscpu+cols);
        }
        this.loadInfo = [w];
    } else {
        this.loadInfo.push(w);
    }
};

/**
 * Master进程调用的函数，用于监听消息事件。
 */
titbit.prototype.daemonMessage = function () {
    var the = this;
    var logger = null;
    if (this.config.logType == 'file') {
        var out_log = fs.createWriteStream(this.config.logFile, {flags: 'a+'});
        var err_log = fs.createWriteStream(this.config.errorLogFile, {flags: 'a+'});
        logger = new console.Console({stdout:out_log, stderr: err_log});
    } else if (this.config.logType == 'stdio') {
        var opts = {stdout:process.stdout, stderr: process.stderr};
        logger = new console.Console(opts);
    }

    cluster.on('message', (worker, msg, handle) => {
        try {
            switch(msg.type) {
                case 'log':
                    if (!logger) break;
                    msg.success 
                    ? logger.log(JSON.stringify(msg)) 
                    : logger.error(JSON.stringify(msg));
                    break;
                case 'load':
                    the.showLoadInfo(msg); break;
                default:;
            }
        } catch (err) { if(the.config.debug) {console.log(err);} }
    });
};

/**
 * 这个函数是可以用于运维部署，此函数默认会根据CPU核数创建对应的子进程处理请求。
 * @param {number} port 端口号
 * @param {string} IP地址，IPv4或IPv6，如果检测为数字，则会把数字赋值给num。
 * @param {number} num，要创建的子进程数量，0表示自动，这时候根据CPU核心数量创建。
*/
titbit.prototype.daemon = function(port = 2020, host = '0.0.0.0', num = 0) {
    if (typeof host === 'number') { num = host; host = '0.0.0.0'; }
    var the = this;

    if (process.argv.indexOf('--daemon') > 0) {
    } else if (this.config.daemon) {
        var args = process.argv.slice(1);
        args.push('--daemon');
        const serv = spawn (
                process.argv[0], args,
                {detached : true, stdio : ['ignore', 1, 2]}
            );
        serv.unref();
        return true;
    }
    
    if (cluster.isMaster) {
        if (num <= 0) { num = os.cpus().length; }

        if (typeof this.config.pidFile === 'string'
            && this.config.pidFile.length > 0) {

            fs.writeFile(this.config.pidFile, process.pid, (err) => {
                if (err) { console.error(err); }
            });
        }
        this.daemonMessage();

        for(var i=0; i<num; i++) { cluster.fork(); }
        if (cluster.isMaster) {
            setInterval(() => {
                var num_dis = num - Object.keys(cluster.workers).length;
                for(var i=0; i<num_dis; i++) { cluster.fork(); }
            }, 2000);
        }
    } else if (cluster.isWorker) {
        this.run(port, host);
        if (this.config.showLoadInfo) {
            var cpuLast = {user: 0, system: 0};
            var cpuTime = {};
            setInterval(() => {
                cpuTime = process.cpuUsage(cpuLast);
                process.send({
                    type : 'load',
                    pid  : process.pid,
                    cpu  : cpuTime,
                    mem  : process.memoryUsage(),
                    conn : the.rundata.conn,
                    host : host,
                    port : port
                });
                cpuLast = process.cpuUsage();
            }, 1024);
        }
    }
};

module.exports = titbit;