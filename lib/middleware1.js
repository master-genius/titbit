/**
  module middleware1
  Copyright (C) 2019.08 BraveWang
 */
'use strict';

const MidCore = require('./midcore.js');

class Middleware extends MidCore {
  /**
   * 执行中间件，其中核心则是请求回调函数。
   * @param {object} ctx 请求上下文实例。
   */
  async run(ctx) {
    try {
      await this.exec(ctx, ctx.group);
    } catch (err) {
      
      this.errorHandle(err, '--ERR-RESPONSE--');

      try {
        if (ctx.response && !ctx.response.writableEnded) {
          ctx.response.statusCode = 500;
          ctx.response.end();
        }
      } catch (err) {}

    } finally {
      ctx.request = null;
      ctx.response = null;
      ctx.data = null;
      ctx.box = null;
      ctx.service = null;
      ctx.requestCall = null;
      ctx.headers = null;
      ctx.body = null;
      ctx.rawBody = null;
      ctx.files = null;
      ctx.param = null;
      ctx.reply = null;
      ctx.user = null;
      ctx = null;
    }
  }

  /** 这是最终添加的请求中间件。基于洋葱模型，这个中间件最先执行，所以最后会返回响应结果。*/
  /**
   *
   * Node 12 开始废除了finished属性。
   *
   */
  addFinal() {
    let fr = async (ctx, next) => {
      await next();

      if (!ctx.response || ctx.response.writableEnded || !ctx.response.writable || ctx.response.destroyed) {
        return;
      }

      /**
       * 如果已经设置了content-type或者消息头已经发送则直接返回
       */
      let content_type = 'text/plain;charset=utf-8';
      let datatype = typeof ctx.data;

      if (!(ctx.response.headersSent || ctx.response.hasHeader('content-type')) )
      {
        if (datatype === 'object') {
          ctx.response.setHeader('content-type','application/json;charset=utf-8');
        }
        else if (datatype === 'string' && ctx.data.length > 1) {
          switch (ctx.data[0]) {
            case '{':
            case '[':
              content_type = 'application/json;charset=utf-8'; break;
            case '<':
              if (ctx.data[1] == '!') {
                content_type = 'text/html;charset=utf-8';
              }
              break;
            default:;
          }
          ctx.response.setHeader('content-type', content_type);
        }
      }

      if (!ctx.data) {
        ctx.response.end()
      } else if (ctx.data instanceof Buffer || datatype === 'string') {
        ctx.response.end(ctx.data, ctx.dataEncoding)
      } else if (datatype === 'number') {
        ctx.response.end(`${ctx.data}`)
      } else {
        ctx.response.end(JSON.stringify(ctx.data))
      }

    }

    this.add(fr)
  }

}

module.exports = Middleware;
