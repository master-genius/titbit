/**
 * module router
 * Copyright (c) [2019.08] BraveWang
 * This software is licensed under the MPL-2.0.
 * You can use this software according to the terms and conditions of the MPL-2.0.
 * See the MPL for more details:
 *     https://www.mozilla.org/en-US/MPL/2.0/
 */
'use strict';

class router {

    constructor (options = {}) {
        this.ignoreSlash = true;
        this.methodList = ['GET', 'POST', 'DELETE', 'OPTIONS'];
        this.apiTable = {
            'GET'   : {},
            'POST'  : {},
            'PUT'   : {},
            'DELETE': {},
            'OPTIONS': {},
        };

        //记录api的分组，只有在分组内的路径才会去处理，
        //这是为了避免不是通过分组添加但是仍然使用和分组相同前缀的路由也被当作分组内路由处理。
        this.apiGroup = {};

        if (options.ignoreSlash !== undefined) {
            this.ignoreSlash = options.ignoreSlash;
        }
    }

    /*
        由于在路由匹配时会使用/分割路径，所以在添加路由时先处理好。
        允许:表示变量，*表示任何路由，但是二者不能共存，因为无法知道后面的是变量还是路由。
        比如：/static/*可以作为静态文件所在目录，但是后面的就直接作为*表示的路径，
        并不进行参数解析。
    */
    /**
     * @param {string} api_path 路由字符串
     * @param {string} method 请求方法类型
     * @param {function} callback 执行请求的回调函数
     * @param {string} name 请求名称，可以不填写
     * @param {string|bool} group 路由归为哪一组，可以是字符串，
     *                          或者是bool值true表示使用/分割的第一个字符串。
     */
    addPath (api_path, method, callback, name = '', group = null) {
        if (typeof callback !== 'function'
            || callback.constructor.name !== 'AsyncFunction'
        ) {
            throw new Error(`${method} ${api_path}: callback must use async statement`);
        }
        if (api_path[0] !== '/') { api_path = `/${api_path}`; }

        if (api_path.length > 1
            && api_path[api_path.length-1] == '/'
            && this.ignoreSlash
        ) {
            api_path = api_path.substring(0, api_path.length-1);
        }

        if (typeof name === 'object') {
            if (name.group !==undefined) {
                group = name.group;
            }
            if (name.name !== undefined) {
                name = name.name;
            } else {
                name = '';
            }
        } else if (typeof name === 'string' && name.length > 0 && name[0] == '@') {
            group = name;
            name = '';
        }

        var add_req = {
                isArgs:  false,
                isStar:  false,
                routeArr: [],
                reqCall: callback,
                name : name,
                groupName : ''
            };
        if (api_path.indexOf(':') >= 0) {
            add_req.isArgs = true;
        }
        if (api_path.indexOf('*') >= 0) {
            add_req.isStar = true;
        }

        if (add_req.isStar 
            && add_req.isArgs
        ) {
            throw new Error(`Error: ": *" can not in two places at once > ${api_path}`);
        }

        add_req.routeArr = api_path.split('/').filter(p => p.length > 0);
        if(typeof group === 'string' && group.length > 0) {
            add_req.groupName = group;
        } else if (group === true) {
            add_req.groupName = `/${add_req.routeArr[0]}`;
        } else {
            add_req.groupName = '';
        }
        if (add_req.groupName !== '') {
            if (this.apiGroup[add_req.groupName] === undefined) {
                this.apiGroup[add_req.groupName] = [];
            }
            this.apiGroup[add_req.groupName].push(api_path);
        }

        switch (method) {
            case 'GET':
            case 'POST':
            case 'PUT':
            case 'DELETE':
            case 'OPTIONS':
                if (this.apiTable[method][api_path]) {
                    throw new Error(`${api_path} conflict`);
                }
                this.apiTable[method][api_path] = add_req;
                break;
            default:
                return ;
        }
    }

    get (api_path, callback, name='', group=null) {
        this.addPath(api_path, 'GET', callback, name, group);
    }

    post (api_path, callback, name='', group=null) {
        this.addPath(api_path, 'POST', callback, name, group);
    }

    put (api_path, callback, name='', group=null) {
        this.addPath(api_path, 'PUT', callback, name, group);
    }

    delete (api_path, callback, name='', group=null) {
        this.addPath(api_path, 'DELETE', callback, name, group);
    }

    options (api_path, callback, name = '', group=null) {
        this.addPath(api_path, 'OPTIONS', callback, name, group);
    }

    map (marr, api_path, callback, name='', group=null) {
        for(var i=0; i<marr.length; i++) {
            this.addPath(api_path, marr[i], callback, name, group);
        }
    }

    any (api_path, callback, name='', group=null) {
        this.map(this.methodList, api_path, callback, name, group);
    }

    group () {
        return this.apiGroup;
    }

    routeTable () {
        return this.apiTable;
    }

    /**
     * findPath只是用来查找带参数的路由。
     * @param {string} path 路由字符串。
     * @param {string} method 请求类型。
     */
    findPath (path, method) {
        if (!this.apiTable[method]) {
            return null;
        }
        if (path.length > 2042) {
            return null;
        }
        var path_split = path.split('/');
        path_split = path_split.filter(p => p.length > 0);
        if (path_split.length > 9) {
            return null;
        }

        var next = 0;
        var args = {};
        var r = null;
        for (var k in this.apiTable[method]) {
            r = this.apiTable[method][k];
            if (r.isArgs === false && r.isStar === false) {
                continue;
            }

            if (
                (r.routeArr.length !== path_split.length && r.isStar === false)
                ||
                (r.isStar && r.routeArr.length > path_split.length+1)
            ) {
                continue;
            }

            next = false;
            args = {};
            if (r.isStar) {
                for(var i=0; i<r.routeArr.length; i++) {
                    if (r.routeArr[i] == '*') {
                        args.starPath = path_split.slice(i).join('/');
                    } else if(r.routeArr[i] !== path_split[i]) {
                        next = true;
                        break;
                    }
                }
            } else {
                for(var i=0; i<r.routeArr.length; i++) {
                    if (r.routeArr[i][0] == ':') {
                        args[r.routeArr[i].substring(1)] = path_split[i];
                    } else if (r.routeArr[i] !== path_split[i]) {
                        next = true;
                        break;
                    }
                }
            }

            if (next) { continue; }

            return {key: k, args: args};
        }
        return null;
    };

    findRealPath (path, method) {
        var route_path = null;
        if (path.length > 1
            && path[path.length-1] == '/'
            && this.ignoreSlash
        ) {
            path = path.substring(0, path.length-1);
        }

        if (this.apiTable[method][path] !== undefined) {
            route_path = path;
        }

        if (route_path && route_path.indexOf('/:') >= 0) {
            route_path = null;
        }
        
        var parg = null;
        if (route_path === null) {
            parg = this.findPath(path, method);
        } else {
            parg = {args : {}, key: route_path};
        }
        if (parg !== null) {
            parg.reqcall = this.apiTable[method][parg.key];
        };
        return parg;
    };

    /**
     * @param {function} next 下层中间件
     * @param {object} ctx 请求上文对象
     */
    setContext (ctx) {
        ctx.routepath = ctx.routerObj.key;
        ctx.requestCall = ctx.routerObj.reqcall.reqCall;
        ctx.name = ctx.routerObj.reqcall.name;
        ctx.group = ctx.routerObj.reqcall.groupName;
        ctx.param = ctx.routerObj.args;
        ctx.routerObj = null;
        if (!this.apiGroup[ctx.group] 
            || !this.apiGroup[ctx.group][ctx.routepath])
        {
            ctx.group = '';
        }
    }

}

module.exports = router;
