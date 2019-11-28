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
            var group = this.globalKey;
            if (ctx.group != '' && this.mid_group[ctx.group] !== undefined) {
                group = ctx.group;
            }
            var last = this.mid_group[group].length-1;
            await this.mid_group[group][last](ctx);
        } catch (err) {
            if (this.debug) { console.log('--DEBUG--RESPONSE--:',err); }
            try {
                if (ctx.response) {
                    ctx.response.statusCode = 500;
                    ctx.response.end();
                }
            } catch (err) {}
        } finally {
            ctx = null;
        }
    };

    /** 这是最终添加的请求中间件。基于洋葱模型，这个中间件最先执行，所以最后会返回响应结果。*/
    /**
     * 
     * @param {object} groupTable router添加路由时的分组表，通过router.group()获取。
     */
    addFinal (groupTable) {
        var fr = async (ctx, next) => {
            await next(ctx);
            if (!ctx.response || ctx.response.finished) { return ; }
            if (ctx.res.body) {
                ctx.response.end(ctx.res.body, ctx.res.encoding);
            } else {
                ctx.response.end();
            }
        };
        this.add(fr, groupTable, {});
    }

}

module.exports = middleware;
