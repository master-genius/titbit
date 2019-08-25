/**
 * module middleware
 * Copyright (c) [2019.08] BraveWang
 * This software is licensed under the MPL-2.0.
 * You can use this software according to the terms and conditions of the MPL-2.0.
 * See the MPL for more details:
 *     https://www.mozilla.org/en-US/MPL/2.0/
 */
'use strict';

const http2 = require('http2');
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
                        ctx.res.headers[':status'] = '500';
                        ctx.stream.respond(ctx.res.headers);
                    }
                    ctx.stream.close(http2.constants.NGHTTP2_INTERNAL_ERROR);
                } catch (err) {}
            }
        } finally {
            ctx.app = null;
            ctx.body = null;
            ctx.res.body = null;
            ctx.requestCall = null;
            ctx.files = null;
            ctx.rawBody = '';
            ctx.headers = null;
            ctx.stream = null;
            ctx.box = null;
        }

    };

    /** 这是最终添加的请求中间件。基于洋葱模型，这个中间件最先执行，所以最后会返回响应结果。 */
    addFinal (groupTable) {
        var fr = async function(ctx, next) {
            await next(ctx);
            if(!ctx.stream || ctx.stream.closed || ctx.stream.destroyed) {
                return ;
            }
            var content_type = 'text/plain; charset=utf-8';
            var datatype = typeof ctx.res.body;
            /** 如果还没有发送头部信息，则判断content-type类型，然后返回。 */
            if (!ctx.stream.headersSent) {
                if (datatype === 'object') {
                    ctx.res.headers['content-type'] = 'text/json; charset=utf-8';
                } else if (datatype == 'string' && ctx.res.body.length > 1
                    && ctx.res.headers['content-type'] !== undefined
                ) {
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
                ctx.stream.respond(ctx.res.headers);
            }

            if ((datatype === 'object' || datatype == 'boolean') 
                && ctx.res.body !== null)
            {
                ctx.stream.end(JSON.stringify(ctx.res.body));
            } else if (datatype == 'string' && ctx.res.body.length !== '') {
                ctx.stream.end(ctx.res.body, ctx.res.encoding);
            } else {
                ctx.stream.end();
            }
        };
        this.add(fr, groupTable);
    }

}

module.exports = middleware;
