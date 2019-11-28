/**
    module middleware2
    Copyright (C) 2019.08 BraveWang
    This program is free software; you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation; either version 3 of the License , or
    (at your option) any later version.
 */

'use strict';

//const http2 = require('http2');
const midCore = require('./midcore');


class middleware extends midCore {

    /**
     * 执行中间件，其中核心则是请求回调函数。
     * @param {object} ctx 请求上下文实例。
     */
    async run (ctx) {
        try {
            var group = this.globalKey;
            //如果创建了分组，但是没有添加中间件则不会执行
            if (ctx.group != '' && this.mid_group[ctx.group] !== undefined) {
                group = ctx.group;
            }
            var last = this.mid_group[group].length-1;
            await this.mid_group[group][last](ctx);
        } catch (err) {
            if (this.debug) { console.log(err); }
            if (ctx.stream) {
                try {
                    if (!ctx.stream.headersSent) {
                        //ctx.resHeaders[':status'] = '500';
                        ctx.stream.respond({
                            ':status' : '500'
                        });
                    }
                    //ctx.stream.close(http2.constants.NGHTTP2_INTERNAL_ERROR);
                    //ctx.stream.close();
                    ctx.stream.end();
                } catch (err) {}
            }
        } finally {
            ctx = null;
        }

    };

    /** 这是最终添加的请求中间件。基于洋葱模型，这个中间件最先执行，所以最后会返回响应结果。 */
    /**
     * @param {object} groupTable router添加路由时的分组表，通过router.group()获取。
     */
    addFinal (groupTable) {
        var fr = async (ctx, next) => {
            await next(ctx);  
            if(!ctx.stream || ctx.stream.closed || ctx.stream.destroyed) {
                return ;
            }
            if (ctx.cache && ctx.resBody) {
                if (!ctx.stream.headersSent) {
                    ctx.stream.respond(ctx.resHeaders);
                }
                ctx.stream.end(ctx.resBody, ctx.resEncoding);
            } else {
                ctx.stream.end();
            }
        };
        this.add(fr, groupTable);
    }

}

module.exports = middleware;
