'use strict';

const http = require('http');
const https = require('https');
const fs = require('fs');
const logger = require('./logger');
const fpurl = require('./fastParseUrl');
const context = require('./context1');
const ctxpool = require('./ctxpool');

class http1 {
  constructor (options = {}) {
    this.config = options.config;
    this.router = options.router;
    this.midware = options.midware;
    this.events = options.events;
    this.service = options.service;
    this.logger = logger;
    ctxpool.max = this.config.maxpool;

    this.ctxpool = ctxpool;

    this.context = context;

    this.fpurl = fpurl;

    this.host = '';
  }

  requestError (err, handle, r) {
    if (!handle.destroyed) {
      handle.destroy();
    }
  }

  /**
   * request事件的回调函数。
   * @param {req} http.IncomingMessage
   * @param {res} http.ServerResponse
   */
  onRequest () {
    var self = this;
    var protocol = self.config.https ? 'https' : 'http';

    var callback = (req, res) => {

      req.on('error', (err) => {
        self.requestError(err, req, res);
      });

      res.on('error', (err) => {
        self.requestError(err, res, req);
      });

      let remote_ip = req.socket.remoteAddress || '';

      if (req.url.length > self.config.maxUrlLength) {
        req.url = req.url.substring(0, self.config.maxUrlLength);
      }

      if (self.config.globalLog) {
        
        let real_ip = '-'

        if (self.config.realIP) {
          real_ip = req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || '-'
        }

        res.on('finish', () => {

          if (!req || !res || !req.headers || res.destroyed) {
            return;
          }

          self.logger({
            method : req.method,
            status : res.statusCode,
            ip : remote_ip,
            link: `${protocol}://${req.headers['host'] || self.host}${req.url}`,
            agent : req.headers['user-agent'] || '-',
            real_ip : real_ip
          });

        });
      }

      let urlobj = fpurl(req.url, self.config.autoDecodeQuery, 
                        self.config.fastParseQuery,
                        self.config.maxQuery);

      let rt = self.router.findRealPath(urlobj.path, req.method);
      if (rt === null) {
        res.statusCode = 404;
        res.end(self.config.notFound);
        return ;
      }

      let ctx = ctxpool.getctx () || new context();

      ctx.bodyLength = 0;
      ctx.maxBody = self.config.maxBody;
      ctx.service = self.service;

      ctx.method = req.method;
      ctx.host = req.headers['host'] || self.host;
      ctx.protocol = protocol;
      ctx.ip = remote_ip;

      ctx.port = req.socket.remotePort;
      ctx.request = req;
      ctx.response = res;
      ctx.reply = ctx.response;
      ctx.headers = req.headers;

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

  middleware () {
    let self = this;
    let noBodyMethods = 'GOHT';

    return async (ctx, next) => {

      await new Promise((rv, rj) => {
        //客户端和服务端解析不会允许非法method
        if (noBodyMethods.indexOf(ctx.method[0]) >= 0) {
          ctx.request.on('data', data => {
            ctx.response.statusCode = 400;
            ctx.response.end(self.config.badRequest);
            ctx.request.destroy();
          });
        } else {

          if (ctx.box.dataHandle && typeof ctx.box.dataHandle === 'function') {
            ctx.request.on('data', ctx.box.dataHandle);
          } else {
            ctx.request.on('data', data => {
              ctx.bodyLength += data.length;
              if (ctx.bodyLength > ctx.maxBody) {
                ctx.bodyBuffer = null;
                ctx.response.statusCode = 413;
                ctx.response.end(`Body too large,limit:${ctx.maxBody} bytes`);
                ctx.request.destroy();
                return ;
              }
              ctx.bodyBuffer.push(data);
            });
          }
        }

        ctx.request.on('end',() => {
          rv();
        });
        
      });

      if (ctx.request.destroyed || !ctx.response.writable) {
        return;
      }

      if (ctx.bodyBuffer.length > 0) {
        ctx.rawBody = Buffer.concat(ctx.bodyBuffer, ctx.bodyLength);
      }
      ctx.bodyBuffer = null;
    
      await next();
      
    };

  }

  /** 
   * 运行HTTP/1.1服务
   * @param {number} port 端口号
   * @param {string} host IP地址，可以是IPv4或IPv6
   * 0.0.0.0 对应使用IPv6则是::
  */
  run (port, host) {
    var self = this;
    var serv = null;

    if (this.config.https) {
      try {
        if (this.config.key && this.config.cert) {
          this.config.server.key  = fs.readFileSync(this.config.key);
          this.config.server.cert = fs.readFileSync(this.config.cert);
        }
        
        serv = https.createServer(this.config.server, this.onRequest());

        serv.on('tlsClientError', (err, tls) => {

          if (self.config.debug) {
            console.error('--DEBUG-TLS-CLIENT--:', err);
          }
          if (!tls.destroyed) {
            tls.destroy();
          }
          
        });

        serv.on('secureConnection', (sock) => {
          sock.on('error', err => {
            if (self.config.debug) {
              console.error('--DEBUG--CONNECTION--', err);
            }
          });
        });
        
      } catch(err) {
        console.error(err);
        process.exit(-1);
      }
    } else {
      serv = http.createServer(self.config.server, this.onRequest());
    }

    serv.on('clientError', (err, sock) => {
      
      if (err.code === 'ECONNRESET' || !sock.writable) {
        return;
      }

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
      }
    });
    
    serv.setTimeout(this.config.timeout, (sock) => {
      //console.log('http timeout');
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

    serv.maxHeadersCount = 36;
    serv.headersTimeout = 3500;
    serv.requestTimeout = 30000;
    
    for(let k in this.events) {
      if (typeof this.events[k] !== 'function') {
        continue;
      }
      serv.on(k, this.events[k]);
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

module.exports = http1;
