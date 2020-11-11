'use strict';

const http2 = require('http2');
//const helper = require('./helper');
//const url = require('url');
const fs = require('fs');
const logger = require('./logger');
//const moveFile = require('./movefile');
const fpurl = require('./fastParseUrl');
const ctxpool = require('./ctxpool');
const context = require('./context2');

class httpt {

  constructor (options) {
    this.config = options.config;
    this.router = options.router;
    this.events = options.events;
    this.midware = options.midware;
    this.service = options.service;
    this.logger = logger;
    ctxpool.max = this.config.maxpool;
    this.ctxpool = ctxpool;
    this.context = context;
  }

  onStream () {
    var self = this;

    var callback = (stream, headers) => {
      
      stream.on('frameError', (type,code,id)=>{});

      stream.on('error', (err) => {stream.destroy()});
      stream.on('aborted', () => {
        if (stream && !stream.closed) { stream.destroy(); }
      });

      let remote_ip = headers['x-real-ip'] || stream.session.socket.remoteAddress || '-';
      if (self.config.globalLog) {
        stream.on('close', () => {
          if (stream.rstCode == http2.constants.NGHTTP2_NO_ERROR) {
            self.logger({
              method : headers[':method'],
              status : parseInt(stream.sentHeaders[':status'] || 0),
              ip : remote_ip,
              link : `${headers[':scheme']}://${headers[':authority']}${headers[':path']}`,
              agent : headers['user-agent'] || '-'
            });
          }
        });
      }

      if (headers[':path'].length > self.config.maxUrlLength) {
        headers[':path'] = headers[':path'].substring(0, self.config.maxUrlLength);
      }

      let urlobj = fpurl(headers[':path'], self.config.autoDecodeQuery);

      let rt = self.router.findRealPath(urlobj.path, headers[':method']);

      if (rt === null) {
        stream.respond({':status': '404'});
        stream.end(self.config.notFound);
        return ;
      }

      stream.setTimeout(self.config.timeout, () => {
        stream.close(http2.constants.NGHTTP2_SETTINGS_TIMEOUT);
      });
    
      let ctx = ctxpool.getctx() || new context();

      ctx.bodyLength = 0;
      ctx.maxBody = self.config.maxBody;
      ctx.service = self.service;
      ctx.method = headers[':method'];
      ctx.host = headers[':authority'];
      ctx.protocol = headers[':scheme'];
    
      ctx.ip = remote_ip;
      ctx.port = stream.session.socket.remotePort;
      ctx.stream = stream;
      ctx.reply = ctx.stream;
      ctx.request = ctx.stream;
      
      ctx.headers = headers;

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
        ctx=null;
      });
    };
    
    return callback;
  }

  middleware () {
    let self = this;
    let noBodyMethods = 'GOHT';
    
    return async (ctx, next) => {
      await new Promise((rv, rj) => {

        if (noBodyMethods.indexOf(ctx.method[0]) >= 0) {
          ctx.stream.on('data', (data) => {
            ctx.stream.respond({':status' : '400'});
            ctx.stream.end(self.config.badRequest);
            ctx.stream.close();
          });
        } else {

          if (ctx.box.dataHandle && typeof ctx.box.dataHandle === 'function') {
            ctx.stream.on('data', ctx.box.dataHandle);
          } else {
            ctx.stream.on('data', (data) => {
              ctx.bodyLength += data.length;
              if (ctx.bodyLength > ctx.maxBody) {
                ctx.bodyBuffer = null;
                ctx.stream.respond({':status' : '413'});
                ctx.stream.end(`Body too large,limit:${ctx.maxBody} bytes`);
                //ctx.stream.destroy(); //否则会报错，销毁stream就不会有读写事件发生。
                ctx.stream.close();
                return ;
              }
              ctx.bodyBuffer.push(data);
            });
          }
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
        }
  
        ctx.bodyBuffer = null;
        await next();
      }, err => {});
  
    };

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
        if (this.config.key && this.config.cert) {
          this.config.server.key  = fs.readFileSync(this.config.key);
          this.config.server.cert = fs.readFileSync(this.config.cert);
        }
        serv = http2.createSecureServer(this.config.server);
      } else {
        serv = http2.createServer(this.config.server);
      }
    } catch(err) {
      console.error(err);
      process.exit(-1);
    }

    var streamCallback = this.onStream();
    serv.on('stream', streamCallback);
    serv.on('sessionError', (err, sess) => {
      if (self.config.debug) {
        console.error('--DEBUG--SESSION-ERROR--:',err);
      }
      sess.close();
    });
    
    serv.on('tlsClientError', (err, tls) => {

      if (self.config.debug) {
        console.error('--DEBUG--TLS--CLIENT--:', err);
      }
      
      if (!tls.destroyed) {
        tls.destroy();
      }
    });

    //只监听tlsClientError是不行的，在进行并发压力测试时，会异常退出。
    serv.on('secureConnection', (sock) => {
      sock.on('error', err => {
        if (self.config.debug) {
          console.error('--DEBUG--CONNECTION--', err);
        }
        
      });

    });

    serv.on('error', (e) => {
      if (e.code === 'EADDRINUSE') {
        if (process.send !== undefined && typeof process.send === 'function') {
          process.send({type: '_eaddr'});
        } else {
          console.error('该端口已被使用，请先停止进程');
        }
      }
    });

    serv.setTimeout(self.config.timeout, (sess) => {
      //如果需要暴力的方式则直接destroy
      //sess.destroy();
      //close会等待已经存在的stream传输完成，如果没有新的stream则会调用destroy销毁会话。
      sess.close();
    });

    //在测试 read ECONNRESET at TLSWrap.onStreamRead问题时引入的。
    //当然这是不对此问题起作用的。
    serv.on('session', (sess) => {
      
      sess.on('error', err => {
        if (!sess.destroyed) {
          sess.destroy();
        }
      });

    });

    for(let k in self.events) {
      if (typeof this.events[k] !== 'function') { continue; }
      if (k=='tlsClientError' || k == 'error') { continue; }
      serv.on(k, this.events[k]);
    }
    
    this.events = [];
    
    //说明是使用unix socket模式监听服务
    if (typeof port === 'string' && port.indexOf('.sock') > 0) {
      serv.listen(port);
    } else {
      serv.listen(port, host);
    }

    return serv;
  }

}

module.exports = httpt;
