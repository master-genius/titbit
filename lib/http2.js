'use strict';

const http2 = require('node:http2');
const fs = require('node:fs');
const process = require('node:process');
const logger = require('./logger.js');
const {fpurl} = require('./fastParseUrl.js');
const ctxpool = require('./ctxpool.js');
const Context = require('./context2.js');
const checkHeaderLimit = require('./headerLimit.js');
const sendmsg = require('./sendmsg.js');

/**
 * 因http2设计缺陷以及Node.js在实现上的细节不健全导致不得不对一些可能的情况做处理。
 */

class Httpt {

  constructor(options) {
    this.config = options.config;
    this.router = options.router;
    this.events = options.events;
    this.midware = options.midware;
    this.service = options.service;
    this.isWorker = options.isWorker;

    this.logger = logger;
    ctxpool.max = this.config.maxpool;

    this.ctxpool = ctxpool;
    this.Context = Context;
    this.fpurl = fpurl;

    this.host = '';

    this.onRequest = this.onStream;
  }

  requestError(err, handle, headers) {
    this.config.errorHandle(err, '--ERR-REQUEST--');

    if (!handle.destroyed) {
      handle.destroy();
    }
  }

  onStream() {
    let self = this;

    let callback = (stream, headers) => {

      stream.on('error', (err) => {
        self.requestError(err, stream, headers);
      });

      stream.on('frameError', (err) => {
        self.requestError(err, stream, headers);
      });

      stream.on('aborted', err => {
        err && self.requestError(err, stream, headers);
        !err && stream.destroy();
      });

      let remote_ip = stream.session.socket.remoteAddress || '';

      if (headers[':path'].length > self.config.maxUrlLength) {
        headers[':path'] = headers[':path'].substring(0, self.config.maxUrlLength);
      }

      if (self.config.globalLog) {
        
        let real_ip = '-';

        if (self.config.realIP) {
          real_ip = headers['x-real-ip'] || headers['x-forwarded-for'] || '-';
        }

        stream.on('close', () => {
          
          if (stream && stream.sentHeaders && stream.rstCode === http2.constants.NGHTTP2_NO_ERROR) {

            //http2请求可以提交超大消息头，而相关设置项没有效果。
            checkHeaderLimit(headers, 'user-agent', 111);
            checkHeaderLimit(headers, ':authority', 300);

            // typeof stream.sentHeaders[':status'] === 'number'
            self.logger({
              method: headers[':method'],
              status: stream.sentHeaders[':status'] || 0,
              ip: remote_ip,
              link: `${headers[':scheme']}://${headers[':authority'] || self.host}${headers[':path']}`,
              agent: headers['user-agent'] || '-',
              real_ip: real_ip
            });

          }
        });
      }

      let urlobj = fpurl(headers[':path'], self.config.autoDecodeQuery,
                        self.config.fastParseQuery,
                        self.config.maxQuery);

      let rt = self.router.findRealPath(urlobj.path, headers[':method']);

      if (rt === null) {
        stream.respond({':status': '404'});
        stream.end(self.config.notFound);
        return ;
      }

      stream.setTimeout(self.config.streamTimeout, () => {
        stream.close();
      });
    
      let ctx = ctxpool.getctx() || new Context();

      ctx.bodyLength = 0;
      ctx.maxBody = self.config.maxBody;
      ctx.service = self.service;
      ctx.method = headers[':method'];
      ctx.host = headers[':authority'] || headers.host || self.host;
      ctx.protocol = headers[':scheme'];
    
      ctx.ip = remote_ip;
      ctx.port = stream.session.socket.remotePort;
      ctx.stream = stream;
      ctx.reply = ctx.stream;
      ctx.request = ctx.stream;
     
      ctx.dataHeaders = {};
      ctx.headers = headers;

      ctx.path = urlobj.path;
      ctx.query = urlobj.query;
      ctx.routepath = rt.key;
      ctx.requestCall = rt.reqcall.reqCall;
      ctx.name = rt.reqcall.name;
      ctx.group = rt.reqcall.group;
      ctx.param = rt.args;
      rt = null;

      return self.midware.run(ctx).finally(() => {
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
        if ( noBodyMethods[ctx.method] ) {
          ctx.stream.on('data', data => {
            ctx.stream.respond({':status' : '400'});
            ctx.stream.end(self.config.badRequest);
            ctx.stream.close();
          });
        } else {
          let bigBodyEnd = false;
          bodyBuffer = [];
          ctx.stream.on('data', data => {
            bodylength += data.length;
            if (bodylength > ctx.maxBody) {
              if (bigBodyEnd) return;
              bigBodyEnd = true;

              bodyBuffer = null;
              ctx.stream.respond({':status' : '413'});
              ctx.stream.end();
              ctx.stream.close();
              return ;
            }
            bodyBuffer.push(data);
          });
        }

        let handle_error = err => {
          if (!resolved) {
            resolved = true;
            rv();
          }
        };

        ctx.stream.on('aborted', handle_error);
        ctx.stream.on('error', handle_error);
        ctx.stream.on('frameError', handle_error);
        ctx.stream.on('timeout', handle_error);

        ctx.stream.on('close', () => {
          (!resolved) && rv();
        });

        //在内部实现上，http2模块总是会触发end事件，这应该是在finalCloseStream中调用this.push(null)实现的。
        ctx.stream.on('end',() => {
          resolved = true;
          rv();
        });

      });

      if (ctx.stream.closed || ctx.stream.destroyed) {
        return;
      }

      if (bodyBuffer && bodyBuffer.length > 0) {
        ctx.bodyLength = bodylength;
        ctx.rawBody = Buffer.concat(bodyBuffer, bodylength);
        bodyBuffer = null;
      }

      await next();
    }
    //end func
  }

  /** 
   * 运行HTTP/2服务
   * @param {number} port 端口号
   * @param {string} host IP地址，可以是IPv4或IPv6
   * 0.0.0.0 对应使用IPv6则是::
  */
  run(port, host) {
    let self = this;
    let serv = null;

    try {
      if (this.config.https) {
        if (this.config.key && this.config.cert) {
          this.config.server.key  = fs.readFileSync(this.config.key);
          this.config.server.cert = fs.readFileSync(this.config.cert);
        }
        serv = http2.createSecureServer(this.config.server);
      } else {
        serv = http2.createServer(this.config.server);
      }
    } catch(err) {
      !this.isWorker && console.error(err);
      sendmsg('_server-error', err.message, {autoExit: true, exitCode: 1});
    }

    serv.on('stream', this.onStream());

    serv.on('sessionError', (err, sess) => {
      self.config.errorHandle(err, '--ERR-SESSION--');
      if (!sess.destroyed) {
        sess.destroy();
      }

    });
    
    serv.on('tlsClientError', (err, tls) => {
      self.config.errorHandle(err, '--ERR-TLS-CLIENT--');
      if (!tls.destroyed) {
        tls.destroy();
      }
    });

    //只监听tlsClientError是不行的，在进行并发压力测试时，会异常退出。
    serv.on('secureConnection', (sock) => {
      //在http2中，要触发超时必须要在此事件内，在connection事件中，会导致segment fault。
      //但是socket超时并非空闲超时，而是只要超过时间就触发，所以在此处不再处理超时。

      sock.on('error', err => {
        self.config.errorHandle(err, '--ERR-CONNECTION--');
      });

    });

    serv.on('unknownProtocol', tls_sock => {
      if (!tls_sock.destroyed) {
        tls_sock.destroy();
      }
    });

    serv.on('error', (e) => {
      if (e.code === 'EADDRINUSE') {
        if (process.send !== undefined && typeof process.send === 'function') {
          process.send({type: '_eaddr'});
        } else {
          console.error('Error: 该端口已被使用，请先停止相关进程');
          process.exit(1);
        }
      } else {
        self.config.errorHandle(e, '--ERR--');
      }
    });

    serv.setTimeout(self.config.timeout, session => {
      session.close(() => {
        !session.destroyed && session.destroy();
      });
    });
    
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

module.exports = Httpt;
