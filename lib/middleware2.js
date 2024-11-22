/**
  module middleware2
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
      ctx.data = null;
      ctx.dataHeaders = null;
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
      ctx.user = null;
      ctx = null;
    }

  }

  /** 这是最终添加的请求中间件。基于洋葱模型，这个中间件最先执行，所以最后会返回响应结果。 */
  addFinal() {
    let fr = async (ctx, next) => {
      
      await next();

      if(!ctx.stream
        || ctx.stream.closed 
        || ctx.stream.destroyed
        || !ctx.stream.writable)
      {
        return ;
      }

      let content_type = 'text/plain;charset=utf-8';
      let datatype = typeof ctx.data;

      /** 如果还没有发送头部信息，则判断content-type类型，然后返回。 */

      if (!ctx.stream.headersSent) {

        if (!ctx.dataHeaders['content-type']) {

          if (ctx.data instanceof Buffer || datatype === 'number') {
            ctx.dataHeaders['content-type'] = content_type;
          }
          else if (datatype === 'object') {
            ctx.dataHeaders['content-type'] = 'application/json;charset=utf-8';
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

            ctx.setHeader('content-type', content_type);
          }
          
        }

        ctx.stream.respond(ctx.dataHeaders)
      }

      if (!ctx.data) {
        ctx.stream.end()
      } else if (ctx.data instanceof Buffer || datatype === 'string') {
        ctx.stream.end(ctx.data, ctx.dataEncoding)
      } else if (datatype === 'number') {
        ctx.stream.end(`${ctx.data}`)
      } else {
        ctx.stream.end(JSON.stringify(ctx.data))
      }
    }

    this.add(fr)
  }

}

module.exports = Middleware;
