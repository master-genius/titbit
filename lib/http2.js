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
const url = require('url');
const fs = require('fs');

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
      version : '2',
      bodyMaxSize : 0,
      method    : '',
      url     : {
        host    : '',
        protocol  : '',
        href    : '',
        origin    : '',
        port    : '',
      },
      //客户端IP
      ip      : '',
      port    : 0,
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
      
      //在请求时指向实际的stream
      stream : null,
      response : null,

      res : {
        headers : {
          ':status' : '200'
        },
        body : '',
        encoding : 'utf8'
      },
  
      box : {},

      service: null,
    };
  
    ctx.getFile = (name, ind = 0) => {
      if (ind < 0) { return ctx.files[name] || []; }
  
      if (ctx.files[name] === undefined) { return null; }
  
      if (ind >= ctx.files[name].length) { return null; }
  
      return ctx.files[name][ind];
    };
  
    ctx.setHeader = (nobj, val = null) => {
      if (typeof nobj === 'string' && val != null) {
        ctx.res.headers[nobj] = val;
      } else if (typeof nobj === 'object') {
        for(let k in nobj) {
          ctx.res.headers[k] = nobj[k];
        }
      }
    };

    ctx.sendHeader = () => {
      ctx.stream.respond(ctx.res.headers);
    };
  
    ctx.status = (stcode = null) => {
      if(stcode === null) {return parseInt(ctx.res.headers[':status']);}
      ctx.res.headers[':status'] = (typeof stcode == 'string' 
                      ? stcode : stcode.toString());
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
   * @param {object} headers 
   * @param {object} sentHeaders 
   * @param {string} remote_ip 
   */
  globalLog (headers, sentHeaders, remote_ip) {
    let link = `${headers[':scheme']}://${headers[':authority']}${headers[':path']}`;

    let log_data = {
      type  : 'log',
      success : true,
      log : `@ ${headers[':method']} | ${link} | ${sentHeaders[':status']} | `
            + `${(new Date()).toLocaleString("zh-Hans-CN")} | ${remote_ip}\n`
    };
  
    if (sentHeaders[':status'] != 200) { log_data.success = false; }

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

  onStream () {
    var self = this;

    var callback = (stream, headers) => {
      //stream.on('frameError', onerror);
      
      stream.setTimeout(self.config.timeout, () => {
        stream.close(http2.constants.NGHTTP2_SETTINGS_TIMEOUT);
      });

      stream.on('error', (err) => {stream.destroy()});
      stream.on('aborted', () => {
        if (stream && !stream.closed) { stream.destroy(); }
      });

      let remote_ip = headers['x-real-ip'] || stream.session.socket.remoteAddress;
      if (self.config.globalLog) {
        stream.on('close', () => {
          if (stream.rstCode == http2.constants.NGHTTP2_NO_ERROR) {
            self.globalLog(headers, stream.sentHeaders, remote_ip);
          }
        });
      }
    
      let urlobj = url.parse(headers[':path'], true);
      if (urlobj.pathname == '') { urlobj.pathname = '/'; }

      let rt = self.router.findRealPath(urlobj.pathname, headers[':method']);
      if (rt === null) {
        stream.respond({':status': '404'});
        stream.end(self.config.pageNotFound);
        return ;
      }
    
      let ctx = self.context();
      ctx.bodyLength = 0;
      ctx.bodyMaxSize = self.config.bodyMaxSize;
      ctx.service = self.service;
      ctx.method = headers[':method'];
      ctx.url.host = headers[':authority'];
      ctx.url.protocol = headers[':scheme'];
      ctx.url.href = urlobj.href;
      ctx.url.origin = `${headers[':scheme']}://`
              +`${headers[':authority']}${headers[':path']}`;
    
      ctx.ip = remote_ip;
      ctx.port = stream.session.socket.remotePort;
      ctx.stream = stream;
      ctx.response = stream;
      ctx.headers = headers;
      ctx.path = urlobj.pathname;
      ctx.query = urlobj.query;
      //ctx.routerObj = rout;
      //self.router.setContext(ctx);
      ctx.routepath = rt.key;
      ctx.requestCall = rt.reqcall.reqCall;
      ctx.name = rt.reqcall.name;
      ctx.group = rt.reqcall.group;
      ctx.param = rt.args;
      rt = null;

      return self.midware.run(ctx).finally(()=>{ctx=null;});
    };
    
    return callback;
  }

  /**
   * 
   * @param {object} ctx 请求上下文
   * @param {function} next 中间件
   */
  async requestMidware (ctx, next) {
    await new Promise((rv, rj) => {
      if (ctx.method == 'GET'
        || ctx.method == 'OPTIONS'
        || ctx.method == 'HEAD'
        || ctx.method == 'TRACE')
      {
        ctx.stream.on('data', (data) => {
          ctx.stream.respond({':status' : '400'});
          ctx.stream.end();
          //ctx.stream.destroy();
          ctx.stream.close();
        });
      } else if (ctx.method == 'POST'
        || ctx.method == 'PUT'
        || ctx.method == 'DELETE'
        || ctx.method == 'PATCH')
      {
        ctx.stream.on('data', (data) => {
          ctx.bodyLength += data.length;
          if (ctx.bodyLength > ctx.bodyMaxSize) {
            ctx.bodyBuffer = null;
            ctx.stream.respond({':status' : '413'});
            ctx.stream.end(`Body too large,limit:${ctx.bodyMaxSize/1024}Kb`);
            //ctx.stream.destroy(); //否则会报错，销毁stream就不会有读写事件发生。
            ctx.stream.close();
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
      }

      ctx.bodyBuffer = null;
      await next(ctx);
    }, err => { })
    /*
    .finally(() => {
      ctx.bodyBuffer = [];
    });
    */
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
      console.error(err);
      process.exit(-1);
    }

    var streamCallback = this.onStream();
    serv.on('stream', streamCallback);
    serv.on('sessionError', (err, sess) => {
      if (self.config.debug) {console.error('--DEBUG--SESSION-ERROR--:',err);}
      sess.close();
    });
    
    serv.on('tlsClientError', (err, tls) => {
      tls.destroy();
      if (self.config.debug) {console.error('--DEBUG--TLS--CONNECT--:', err);}
    });
    serv.on('error', (e) => {
      if (e.code === 'EADDRINUSE') {
        if (process.send !== undefined
          && typeof process.send === 'function')
        {
          process.send({
            type : 'eaddr',
          });
        } else {
          console.log('该端口已被使用，请先停止进程');
        }
      }
    });

    serv.setTimeout(self.config.timeout, (sess) => {
      //如果需要暴力的方式则直接destroy
      //sess.destroy();
      //close会等待已经存在的stream传输完成，如果没有新的stream则会调用destroy销毁会话。
      //console.log('close for timeout');
      //sess.close();
      //使用stream控制关闭流，一个连接会有多个流，所以不能全部关闭
      //但是可以设置socktimeout控制连接超时。
    });

    for(let k in self.events) {
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

module.exports = httpt;
