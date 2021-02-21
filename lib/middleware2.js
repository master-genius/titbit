/**
  module middleware2
  Copyright (C) 2019.08 BraveWang
  This program is free software; you can redistribute it and/or modify
  it under the terms of the GNU General Public License as published by
  the Free Software Foundation; either version 3 of the License , or
  (at your option) any later version.
 */
'use strict';

const midCore = require('./midcore');

class middleware extends midCore {

  /**
   * 执行中间件，其中核心则是请求回调函数。
   * @param {object} ctx 请求上下文实例。
   */
  async run (ctx) {
    try {
      await this.exec(ctx, ctx.group);
    } catch (err) {
      if (this.debug) { console.error('--DEBUG-RESPONSE--:', err); }
      if (ctx.stream && !ctx.stream.destroyed && ctx.stream.writable) {
        try {
          if (!ctx.stream.headersSent) {
            ctx.stream.respond({
              ':status' : '500'
            });
          }
          //ctx.stream.close();
          ctx.stream.end();
        } catch (err) {}
      }
    } finally {
      ctx.res.body = null;
      ctx.res.headers = null;
      ctx.stream = null;
      ctx.request = null;
      ctx.service = null;
      ctx.box = null;
      ctx.requestCall = null;
      ctx.body = null;
      ctx.headers = null;
      ctx.rawBody = null;
      ctx.files = null;
      ctx.param = null;
      ctx.reply = null;
      ctx = null;
    }

  };

  /** 这是最终添加的请求中间件。基于洋葱模型，这个中间件最先执行，所以最后会返回响应结果。 */
  addFinal () {
    var fr = async (ctx, next) => {
      
      await next();

      if(!ctx.stream
        || ctx.stream.closed 
        || ctx.stream.destroyed
        || ctx.stream.session.destroyed
        || !ctx.stream.writable)
      {
        return ;
      }

      let content_type = 'text/plain; charset=utf-8';
      let datatype = typeof ctx.res.body;

      /** 如果还没有发送头部信息，则判断content-type类型，然后返回。 */

      if (!ctx.stream.headersSent) {

        if (ctx.res.headers['content-type'] === undefined) {

          if (ctx.res.body instanceof Buffer || datatype === 'number') {
            ctx.res.headers['content-type'] = content_type;
          }
          else if (datatype === 'object') {
            ctx.res.headers['content-type'] = 'text/json; charset=utf-8';
          }
          else if (datatype === 'string' && ctx.res.body.length > 1) {
            switch (ctx.res.body[0]) {
              case '{':
              case '[':
                content_type = 'text/json; charset=utf-8'; break;

              case '<':
                if (ctx.res.body[1] == '!') {
                  content_type = 'text/html;charset=utf-8';
                } else {
                  content_type = 'text/xml;charset=utf-8';
                }
                break;

              default:;
            }

            ctx.res.headers['content-type'] = content_type;
          }
          
        }

        ctx.stream.respond(ctx.res.headers);
      }

      if (ctx.res.body === null || (datatype === 'string' && ctx.res.body.length == 0) )
      {
        ctx.stream.end();
        
      } else if (ctx.res.body instanceof Buffer || datatype === 'string') {
        ctx.stream.end(ctx.res.body, ctx.res.encoding);

      } else if (datatype === 'number') {
        ctx.stream.end(`${ctx.res.body}`)
        
      } else {
        ctx.stream.end(JSON.stringify(ctx.res.body));
      }
    };

    this.add(fr);
  }

}

module.exports = middleware;
