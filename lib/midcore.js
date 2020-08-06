
'use strict';

class midCore {

  constructor (options = {}) {
    this.debug = true;
    this.noargs = true;

    if (options.debug !== undefined) {
      this.debug = options.debug;
    }

    if (options.nextMode !== undefined) {
      if (options.nextMode == 'args') {
      this.noargs = false;
      }
    }

    this.mid_chain = [];

    this.globalKey = '*GLOBAL*';
    
    this.mid_group = {};

    this.mid_group[this.globalKey] = [
      async (ctx) => {
        return await ctx.requestCall(ctx);
      }
    ];

    this.stack_cache = [];
  }

  /**
   * @param {function} midcall 回调函数
   * @param {array|object|string} 选项
   */
  addCache(midcall, options = {}) {
    this.stack_cache.push({
      callback: midcall,
      options: options
    });
  };

  /**
   * @param {object} groupTable 路由分组表
   */
  addFromCache() {
    for (let i = this.stack_cache.length-1; i>=0; i--) {
      this.add(this.stack_cache[i].callback, this.stack_cache[i].options);
    }
    this.stack_cache = [];
  };

  //如果某一分组添加时，已经有全局中间件，需要先把全局中间件添加到此分组。
  initGroup(group) {
    this.mid_group[group] = [];
    for(let i=0; i < this.mid_group[this.globalKey].length; i++) {
      this.mid_group[group].push(this.mid_group[this.globalKey][i]);
    }
  };

  /**
   * 添加中间件。
   * @param {async function} midcall 接受参数(ctx, next)。
   * @param {string|Array|object} options 选项。
   * options如果是字符串则表示针对分组添加中间件，如果是数组或正则表达式则表示匹配规则。
   * 如果你想针对某一分组添加中间件，同时还要设置匹配规则，则可以使用以下形式：
   * {
   *   pathname  : string | Array,
   *   group : string
   * }
   */
  add(midcall, options = {}) {
    if (typeof midcall !== 'function' || midcall.constructor.name !== 'AsyncFunction') {
      throw new Error('callback and middleware fucntion must use async');
    }
    var pathname = null;
    var group = null;
    var method = null;
    if (typeof options === 'string') {
      options = [options];
    }

    if (options instanceof Array) {
      pathname = options;

    } if (typeof options === 'object') {

      if (options.name !== undefined) {
        if (typeof options.name === 'string') {
          pathname = [options.name];
        } else if (options.name instanceof Array) {
          pathname = options.name;
        }
      }

      if (options.group !== undefined && typeof options.group === 'string') {
        group = options.group;
      }

      if (options.method !== undefined) {
        if (typeof options.method === 'string') {
          method = [options.method];
        } else if (options.method instanceof Array) {
          method = options.method;
        }
      }
    }

    var self = this;
    //生成中间件函数，并根据noargs确定是否生成next需要传递参数的情况。
    var makeRealMid = (prev_mid, grp) => {
      let nextcall = self.mid_group[grp][prev_mid];

      if (method === null && pathname === null) {
        if (self.noargs) {
          return async (ctx) => { await midcall(ctx, nextcall.bind(null, ctx)); };
        }
        return async (ctx) => { await midcall(ctx, nextcall); };
      }

      if (self.noargs) {
        return async (ctx) => {
          if (method !==null && method.indexOf(ctx.method) < 0) {
            return await nextcall(ctx);
          }
          if (pathname !== null && pathname.indexOf(ctx.name) < 0) {
            return await nextcall(ctx);
          }
          return await midcall(ctx, nextcall.bind(null, ctx));
        };
      }

      return async (ctx) => {
        if (method !==null && method.indexOf(ctx.method) < 0) {
          return await nextcall(ctx);
        }
        if (pathname !== null && pathname.indexOf(ctx.name) < 0) {
          return await nextcall(ctx);
        }
        return await midcall(ctx, nextcall);
      };
    };

    var last = 0;
    if (group) {
      if (!this.mid_group[group]) {
        this.initGroup(group);
      }
      last = this.mid_group[group].length - 1;
      this.mid_group[group].push(makeRealMid(last, group));
    } else {
      //全局添加中间件
      for (let k in this.mid_group) {
        last = this.mid_group[k].length - 1;
        this.mid_group[k].push(makeRealMid(last, k));
      }
    }
    return this;
  }

}

module.exports = midCore;
