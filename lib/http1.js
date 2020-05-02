/**
  module http1
  Copyright (C) 2019.08 BraveWang
  This program is free software; you can redistribute it and/or modify
  it under the terms of the GNU General Public License as published by
  the Free Software Foundation; either version 3 of the License , or
  (at your option) any later version.
 */

'use strict';

const http = require('http');
const https = require('https');
const helper = require('./helper');
const url = require('url');
const fs = require('fs');

class http1 {
  constructor (options = {}) {
    this.config = options.config;
    this.router = options.router;
    this.midware = options.midware;
    this.events = options.events;
    this.service = options.service;
  }

  /**
   * 生成请求上下文对象
   */
  context () {
    var ctx = {
      version : '1.1',
      bodyMaxSize : 0,
      method    : '',
      url     : {
        host    : '',
        protocol  : '',
        href    : '',
        origin    : '',
        port    : '',
      },
      ip      : '',
      //实际的访问路径
      path    : '',
      name    : '',
      headers   : {},
      //实际执行请求的路径
      routepath   : '',
      param     : {},
      query     : {},
      body    : {},
      isUpload  : false,
      group     : '',
      rawBody   : '',
      bodyBuffer  : [],
      bodyLength  : 0,
      files     : {},
      requestCall : null,
      helper    : helper,
      port    : 0,

      res : {
        body : '',
        encoding : 'utf8',
      },
  
      request   : null,
      response  : null,
  
      box : {},
      service:null,
    };

    ctx.getFile = (name, ind = 0) => {
      if (ind < 0) {return ctx.files[name] || [];}
  
      if (ctx.files[name] === undefined) {return null;}
      
      if (ind >= ctx.files[name].length) {return null;}
  
      return ctx.files[name][ind];
    };
  
    ctx.setHeader = (name, val) => {
      ctx.response.setHeader(name, val);
    };
  
    ctx.status = (stcode = null) => {
      if (stcode === null) { return ctx.response.statusCode; }
      if(ctx.response) { ctx.response.statusCode = stcode; }
    };

    ctx.moveFile = async (upf, target) => {
      let fd = await new Promise((rv, rj) => {
        fs.open(target, 'w+', 0o644, (err, fd) => {
          if (err) { rj(err); }
          else { rv(fd); }
        });
      });

      return new Promise((rv, rj) => {
        fs.write(fd, ctx.rawBody, upf.start, upf.length, 
          (err,bytesWritten,buffer) => {
            if (err) { rj(err); }
            else { rv(bytesWritten); }
          });
      })
      .then(d => {
        return d;
      }, e => { throw e; })
      .finally(() => {
        fs.close(fd, (err) => {});
      });
    };
  
    return ctx;
  }

  /**
   * 
   * @param {string} method 
   * @param {object} rinfo
   *
   * 为了方便解析，日志作为行格式，并且具备标志性消息头。
   *
   */
  globalLog (method, rinfo) {
    let log_data = {
      type  : 'log',
      success : true,
      log : `@ ${method} | ${rinfo.link} | ${rinfo.status} | `
            + `${(new Date()).toLocaleString("zh-Hans-CN")} | ${rinfo.ip}\n`
    };
  
    if (rinfo.status != 200) {
      log_data.success = false;
    }

    if (process.send && typeof process.send === 'function') {
      process.send(log_data);
    } else {
      if (log_data.success) {
        console.log(log_data.log);
      } else {
        console.error(log_data.log);
      }
    }
  }

  /**
   * request事件的回调函数。
   * @param {req} http.IncomingMessage
   * @param {res} http.ServerResponse
   */
  onRequest () {
    var self = this;

    var callback = (req, res) => {
      
      req.setTimeout(self.config.timeout);
      res.setTimeout(self.config.timeout);

      req.on('abort', (err) => {res.statusCode = 400; res.end();});
      req.on('error', (err) => {
        res.statusCode = 400;
        res.end();
        req.abort();
      });

      let remote_ip = req.headers['x-real-ip'] || req.socket.remoteAddress;
      if (self.config.globalLog) {
        res.on('finish', () => {
          self.globalLog(req.method, {
            status : res.statusCode,
            ip : remote_ip,
            link: `${self.config.https?'https:':'http:'}//${req.headers['host']}${req.url}`
          });
        });
      }

      let urlobj = url.parse(req.url, true);
      if (urlobj.pathname == '') { urlobj.pathname = '/'; }

      let rt = self.router.findRealPath(urlobj.pathname, req.method);
      if (rt === null) {
        res.statusCode = 404;
        res.end(self.config.pageNotFound);
        return ;
      }

      let ctx = self.context();
      ctx.bodyLength = 0;
      ctx.bodyMaxSize = self.config.bodyMaxSize;
      ctx.service = self.service;
      ctx.method = req.method;
      ctx.url.host = req.headers['host'];
      ctx.url.protocol = urlobj.protocol;
      ctx.url.href = urlobj.href;
      ctx.ip = remote_ip;
      ctx.port = req.socket.remotePort;
      ctx.request = req;
      ctx.response = res;
      ctx.headers = req.headers;
      ctx.path = urlobj.pathname;
      ctx.query = urlobj.query;
      ctx.routepath = rt.key;
      ctx.requestCall = rt.reqcall.reqCall;
      ctx.name = rt.reqcall.name;
      ctx.group = rt.reqcall.group;
      ctx.param = rt.args;
      rt = null;

      return self.midware.run(ctx).finally(()=>{ ctx = null; });
    };

    return callback;
  }

  async requestMidware (ctx, next) {
    await new Promise((rv, rj) => {
      if (ctx.method == 'GET' 
        || ctx.method == 'OPTIONS'
        || ctx.method == 'HEAD'
        || ctx.method == 'TRACE')
      {
        ctx.request.on('data', data => {
          ctx.response.statusCode = 400;
          ctx.response.end();
          ctx.request.destroy();
        });
      }
      else if (ctx.method=='POST'
        || ctx.method=='PUT'
        || ctx.method=='DELETE'
        || ctx.method == 'PATCH')
      {
        ctx.request.on('data', data => {
          ctx.bodyLength += data.length;
          if (ctx.bodyLength > ctx.bodyMaxSize) {
            ctx.bodyBuffer = null;
            ctx.response.statusCode = 413;
            ctx.response.end(
              `Body too large,limit:${ctx.bodyMaxSize/1000}Kb`
            );
            ctx.request.destroy();
            return ;
          }
          ctx.bodyBuffer.push(data);
        });
      }

      ctx.request.on('end',() => {
        if (ctx.request.aborted || ctx.response.finished) { 
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

      await next(ctx);
    }, err => {})
    /*
    .finally(() => {
      ctx.bodyBuffer = [];
    });
    */
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
        this.config.server.cert = fs.readFileSync(this.config.cert);
        this.config.server.key = fs.readFileSync(this.config.key);
        
        serv = https.createServer(this.config.server, this.onRequest());
        serv.on('tlsClientError', (err) => {
          if (self.config.debug) { console.error('--DEBUG-TLS-ERROR:', err); }
        });
      } catch(err) {
        console.log(err);
        process.exit(-1);
      }
    } else {
      serv = http.createServer(this.onRequest());
    }

    serv.on('clientError', (err, sock) => {
      if (!sock.destroyed) {
        sock.end('HTTP/1.1 400 Bad request\r\n', () => {
          sock.destroy();
        });
      }
    });

    serv.on('error', (e) => {
      if (e.code === 'EADDRINUSE') {
        if (process.send !== undefined
          && typeof process.send === 'function')
        {
          process.send({
            type : 'eaddr',
          }, (err) => {});
        } else {
          console.log('该端口已被使用，请先停止进程');
        }
      }
    });
    
    serv.setTimeout(this.config.timeout, (sock) => {
      //console.log('http timeout');
      if (!sock.destroyed) {
        sock.end('HTTP/1.1 408 Request timeout\r\n', () => {
          sock.destroy();
        });
      }
    });
    
    for(let k in this.events) {
      if (typeof this.events[k] !== 'function') { continue; }
      if (k=='tlsClientError' || k == 'error') { continue; }
      serv.on(k, this.events[k]);
    }
   
    //说明是使用unix socket模式监听服务
    if (typeof port === 'string' && port.indexOf('.sock') > 0) {
      serv.listen(port);
    } else {
      serv.listen(port, host);
    }

    return serv;
  }

}

module.exports = http1;
