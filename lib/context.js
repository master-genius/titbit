/**
 * module context
 * Copyright (c) [2019.08] BraveWang
 * This software is licensed under the MPL-2.0.
 * You can use this software according to the terms and conditions of the MPL-2.0.
 * See the MPL for more details:
 *     https://www.mozilla.org/en-US/MPL/2.0/
 */
'use strict';

const helper = require('./helper');

var context = {};

context.c2 = function () {
    var ctx = {
        app         : null,
        method      : '',
        url         : {
            host        : '',
            protocol    : '',
            href        : '',
            origin      : '',
            port        : '',
        },
        //客户端IP
        ip          : '',
        //实际的访问路径
        path        : '',
        name        : '',
        headers     : {},
        //实际执行请求的路径
        routepath   : '/',
        param        : {},
        query       : {},
        body   : {},
        isUpload    : false,
        group       : '',
        rawBody     : '',
        files       : {},
        requestCall : null,
        helper      : helper,
        //在请求时指向实际的stream
        stream : null,
        //response 
        res : {
            headers : {
                ':status' : '200',
            },
            data : '',
            encoding : 'utf8',
        },

        box : {},

        routerObj: null,
    };

    ctx.getFile = function(name, ind = 0) {
        if (ind < 0) { return ctx.files[name] || []; }

        if (ctx.files[name] === undefined) { return null; }

        if (ind >= ctx.files[name].length) { return null; }

        return ctx.files[name][ind];
    };

    ctx.res.setHeader = function(nobj, val = null) {
        if (typeof nobj === 'string' && val != null) {
            ctx.res.headers[nobj] = val;
        } else if (typeof nobj === 'object') {
            for(let k in nobj) {
                ctx.res.headers[k] = nobj[k];
            }
        }
    };

    ctx.res.status = function(stcode = null) {
        if(stcode === null) {return parseInt(ctx.res.headers[':status']);}
        ctx.res.headers[':status'] = (typeof stcode == 'string' 
                                        ? stcode : stcode.toString());
    };

    ctx.moveFile = helper.moveFile;

    return ctx;
};

context.c1 = function () {
    var ctx = {
        app         : null,
        method      : '',
        url         : {
            host        : '',
            protocol    : '',
            href        : '',
            origin      : '',
            port        : '',
        },
        ip          : '',
        //实际的访问路径
        path        : '',
        name        : '',
        headers     : {},
        //实际执行请求的路径
        routepath   : '/',
        param        : {},
        query       : {},
        body   : {},
        isUpload    : false,
        group       : '',
        rawBody     : '',
        files       : {},
        requestCall : null,
        helper: helper,

        request     : null,
        response    : null,

        res         : {
            statusCode  : 200,
            body        : '',
            encoding    : 'utf8'
        },

        box : {},
        routerObj: null,
    };
    ctx.getFile = function(name, ind = 0) {
        if (ind < 0) {return ctx.files[name] || [];}

        if (ctx.files[name] === undefined) {return null;}
        
        if (ind >= ctx.files[name].length) {return null;}

        return ctx.files[name][ind];
    };

    ctx.res.setHeader = function (name, val) {
        ctx.response.setHeader(name, val);
    };

    ctx.res.status = function(stcode = null) {
        if (stcode === null) { return ctx.response.statusCode; }
        if(ctx.response) { ctx.response.statusCode = stcode; }
    };
    ctx.moveFile = helper.moveFile;

    return ctx;
};

module.exports = context;
