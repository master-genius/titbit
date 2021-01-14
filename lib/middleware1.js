/**
  module middleware1
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
      if (this.debug) { console.error('--DEBUG--RESPONSE--:',err); }
      try {
        if (ctx.response && !ctx.response.writableEnded) {
          ctx.response.statusCode = 500;
          ctx.response.end();
        }
      } catch (err) {}
    } finally {
      ctx.request = null;
      ctx.response = null;
      ctx.res.body = null;
      ctx.box = null;
      ctx.service = null;
      ctx.requestCall = null;
      ctx.headers = null;
      ctx.body = null;
      ctx.rawBody = null;
      ctx.files = null;
      ctx.param = null;
      ctx.reply = null;
      ctx = null;
    }
  };

  /** 这是最终添加的请求中间件。基于洋葱模型，这个中间件最先执行，所以最后会返回响应结果。*/
  /**
   *
   * Node 12 开始废除了finished属性。
   *
   */
  addFinal () {
    var fr = async (ctx, next) => {
      await next();

      if (!ctx.response || ctx.response.writableEnded || !ctx.response.writable || ctx.response.destroyed) {
        return;
      }

      /**
       * 如果已经设置了content-type或者消息头已经发送则直接返回
       */
      let content_type = 'text/plain;charset=utf-8';
      let datatype = typeof ctx.res.body;

      if (!(ctx.res.encoding === 'binary' 
            || ctx.response.headersSent
            || ctx.response.hasHeader('content-type')) )
      {
        if (datatype == 'object') {
          ctx.response.setHeader('content-type','text/json;charset=utf-8');
        }
        else if (datatype === 'string' && ctx.res.body.length > 1) {
          switch (ctx.res.body[0]) {
            case '{':
            case '[':
              content_type = 'text/json;charset=utf-8'; break;
            case '<':
              if (ctx.res.body[1] == '!') {
                content_type = 'text/html;charset=utf-8';
              } else {
                content_type = 'text/xml;charset=utf-8';
              }
              break;
            default:;
          }
          ctx.response.setHeader('content-type', content_type);
        }
      }

      if (ctx.res.body === null || (datatype === 'string' && ctx.res.body.length === 0) )
      {
        ctx.response.end();
        
      } else if (ctx.res.body instanceof Buffer || datatype === 'string') {
        ctx.response.end(ctx.res.body, ctx.res.encoding);

      } else if (datatype === 'number') {
        ctx.response.end(`${ctx.res.body}`);

      } else {
        ctx.response.end(JSON.stringify(ctx.res.body));
      }

    };

    this.add(fr);
  }

}

module.exports = middleware;
