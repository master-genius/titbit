'use strict';

const http = require('node:http');
const https = require('node:https');
const fs = require('node:fs');
const process = require('node:process');
const logger = require('./logger.js');
const {fpurl} = require('./fastParseUrl.js');
const Context = require('./context1.js');
const ctxpool = require('./ctxpool.js');
const checkHeaderLimit = require('./headerLimit.js');
const sendmsg = require('./sendmsg.js');

/**
 * http1会对消息头进行限制，解析时会检测最大限制。
 */

class Http1 {
  constructor(options = {}) {
    this.config = options.config;
    this.router = options.router;
    this.midware = options.midware;
    this.events = options.events;
    this.service = options.service;
    this.isWorker = options.isWorker;

    this.logger = logger;
    ctxpool.max = this.config.maxpool;

    this.ctxpool = ctxpool;
    this.Context = Context;
    this.fpurl = fpurl;
    this.host = '';
  }

  requestError(err, handle, headers) {
    this.config.errorHandle(err, '--ERR-REQUEST--');

    if (!handle.destroyed) {
      handle.destroy();
    }
  }

  /**
   * request事件的回调函数。
   * @param {req} http.IncomingMessage
   * @param {res} http.ServerResponse
   */
  onRequest() {
    let self = this;
    let protocol = self.config.https ? 'https' : 'http';

    let callback = (req, res) => {

      req.on('error', (err) => {
        self.requestError(err, req, req.headers);
      });

      res.on('error', (err) => {
        self.requestError(err, res, req.headers);
      });

      let remote_ip = req.socket.remoteAddress || '';

      if (req.url.length > self.config.maxUrlLength) {
        req.url = req.url.substring(0, self.config.maxUrlLength);
      }

      if (self.config.globalLog) {
        
        let real_ip = '-';
        //req.headers是getter属性，首次获取会进行消息头解析。再次获取会直接从已存储的变量返回。
        let reqHeaders = req.headers;

        if (self.config.realIP) {
          real_ip = reqHeaders['x-real-ip'] || reqHeaders['x-forwarded-for'] || '-'
        }

        res.on('finish', () => {
          if (!req || !res || res.destroyed) {
            return;
          }

          checkHeaderLimit(reqHeaders, 'host', 300);
          checkHeaderLimit(reqHeaders, 'user-agent', 111);

          self.logger({
            method: req.method,
            status: res.statusCode,
            ip: remote_ip,
            link: `${protocol}://${reqHeaders.host || self.host}${req.url}`,
            agent: reqHeaders['user-agent'] || '-',
            real_ip: real_ip
          });

        });
      }

      let urlobj = fpurl(req.url, self.config.autoDecodeQuery, 
                        self.config.fastParseQuery,
                        self.config.maxQuery);
      
      let rt = self.router.findRealPath(urlobj.path, req.method);
      if (rt === null) {
        res.statusCode = 404;
        res.end(self.config.notFound, () => {
          !req.destroyed && req.destroy();
        });
        return ;
      }

      let ctx = ctxpool.getctx () || new Context();

      ctx.bodyLength = 0;
      ctx.maxBody = self.config.maxBody;
      ctx.service = self.service;

      ctx.method = req.method;
      ctx.headers = req.headers;
      ctx.host = ctx.headers.host || self.host;
      ctx.protocol = protocol;
      ctx.ip = remote_ip;

      ctx.port = req.socket.remotePort;
      ctx.request = req;
      ctx.response = res;
      ctx.reply = ctx.response;

      ctx.path = urlobj.path;
      ctx.query = urlobj.query;
      ctx.routepath = rt.key;
      ctx.requestCall = rt.reqcall.reqCall;
      ctx.name = rt.reqcall.name;
      ctx.group = rt.reqcall.group;
      ctx.param = rt.args;
      rt = null;

      return self.midware.run(ctx).finally(()=>{
        ctxpool.free(ctx);
        ctx = null;
      });
    };

    return callback;
  }

  mid() {
    let self = this;

    let noBodyMethods = {};

    ['GET','OPTIONS','HEAD','TRACE'].forEach(a => {
      noBodyMethods[a] = true;
    });

    return async (ctx, next) => {
      let resolved = false;
      let bodylength = 0;
      let bodyBuffer;

      await new Promise((rv, rj) => {
        //客户端和服务端解析不会允许非法method
        if ( noBodyMethods[ctx.method] ) {
          //实际上这个回调函数不会执行，因为会立即触发end事件，此处可以保证非法的请求也可以提交数据。
          ctx.request.on('data', data => {
            ctx.response.statusCode = 400;
            ctx.response.end(self.config.badRequest);
            ctx.request.destroy();
          });
        } else {
          let bigBodyEnd = false;
          bodyBuffer = [];
          ctx.request.on('data', data => {
            bodylength += data.length;
            if (bodylength > ctx.maxBody) {
              if (bigBodyEnd) return;
              bigBodyEnd = true;

              bodyBuffer = null;
              ctx.response.statusCode = 413;
              ctx.response.end('', () => {
                ctx.request.destroy();
              });
              return ;
            }
            bodyBuffer.push(data);
          });
        }

        //若请求体太大，此时会进行destroy处理，触发close事件，但不会触发end。
        //通过记录resolved状态避免重复调用rv。
        ctx.request.on('close', () => {
          (!resolved) && rv();
        });

        ctx.request.on('end',() => {
          resolved = true;
          rv();
        });
        
      });

      if (!ctx.response.writable || ctx.response.writableEnded) {
        return;
      }

      if (bodyBuffer && bodyBuffer.length > 0) {
        ctx.bodyLength = bodylength;
        ctx.rawBody = Buffer.concat(bodyBuffer, bodylength);
        bodyBuffer = null;
      }
    
      await next();
    };

  }

  /** 
   * 运行HTTP/1.1服务
   * @param {number} port 端口号
   * @param {string} host IP地址，可以是IPv4或IPv6
   * 0.0.0.0 对应使用IPv6则是::
  */
  run(port, host) {
    let self = this;
    let serv = null;

    if (this.config.https) {
      try {
        if (this.config.key && this.config.cert) {
          this.config.server.key  = fs.readFileSync(this.config.key);
          this.config.server.cert = fs.readFileSync(this.config.cert);
        }
        
        serv = https.createServer(this.config.server, this.onRequest());

        serv.on('tlsClientError', (err, tls) => {
          
          self.config.errorHandle(err, '--ERR-TLS-CLIENT--');

          if (!tls.destroyed) {
            tls.destroy();
          }
          
        });

        serv.on('secureConnection', (sock) => {
          sock.on('error', err => {
            self.config.errorHandle(err, '--ERR-CONNECTION--');
          });
        });
        
      } catch (err) {
        !this.isWorker && console.error(err);
        sendmsg('_server-error', err.message, {autoExit: true, exitCode: 1});
      }
    } else {
      serv = http.createServer(self.config.server, this.onRequest());
    }

    serv.on('clientError', (err, sock) => {
      if (sock.destroyed) return;

      self.config.errorHandle(err, '--ERR-CLIENT--');
      
      if (err.code === 'ECONNRESET' || !sock.writable) return;

      if (!sock.destroyed) {
        if (!sock.writableEnded) {
          sock.end('HTTP/1.1 400 Bad request\r\n', () => {
            sock.destroy();
          });
        } else {
          sock.destroy();
        }
      }

    });

    serv.on('error', (e) => {
      if (e.code === 'EADDRINUSE') {
        if (process.send !== undefined && typeof process.send === 'function') {
          process.send({type: '_eaddr'}, (err) => {});
        } else {
          console.error('Error: 该端口已被使用，请先停止相关进程');
          process.exit(1);
        }
      } else {
        self.config.errorHandle(e, '--ERR--');
      }
    });
    
    serv.setTimeout(this.config.timeout, (sock) => {
      if (!sock.destroyed) {
        if (!sock.pending) {
          sock.end('HTTP/1.1 408 Request timeout\r\n', () => {
            sock.destroy();
          });
        } else {
          sock.destroy();
        }
      }
    });

    serv.maxHeadersCount = 80;
    serv.headersTimeout = 6000;
    serv.requestTimeout = self.config.requestTimeout;
    
    for (let k in this.events) {
      for (let ecall of this.events[k]) { 
        if (typeof ecall !== 'function') {
          continue;
        }
        serv.on(k, ecall);
      }
    }

    this.events = {};
   
    //说明是使用unix socket模式监听服务
    if (typeof port === 'string' && port.indexOf('.sock') > 0) {
      this.host = port;
      serv.listen(port);
    } else {
      this.host = host;
      if (port !== 80 && port !== 443) {
        this.host += `:${port}`;
      }
      serv.listen(port, host);
    }

    return serv;
  }

}

module.exports = Http1;
