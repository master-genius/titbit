'use strict';

class midCore {

  constructor (options = {}) {
    this.debug = true;
    if (options.debug !== undefined) {
      this.debug = options.debug;
    }

    this.globalKey = '*GLOBAL*';

    this.midGroup = {};

    this.midGroup[ this.globalKey ] = [
      async (ctx) => {
        if (typeof ctx.requestCall === 'function') {
          return await ctx.requestCall(ctx);
        }
      }
    ];

    this.stackCache = [];
  }

  /**
   * @param {function} midcall 回调函数
   * @param {array|object|string} 选项
   */
  addCache(midcall, options = {}) {
    this.stackCache.push({
      callback: midcall,
      options: options
    });
  };

  /**
   * @param {object} groupTable 路由分组表
   */
  addFromCache() {
    let m = null;
    while((m = this.stackCache.pop()) !== undefined) {
      this.add(m.callback, m.options);
    }
  };

  //如果某一分组添加时，已经有全局中间件，需要先把全局中间件添加到此分组。
  initGroup(group) {
    this.midGroup[group] = [];
    for(let i=0; i < this.midGroup[this.globalKey].length; i++) {
      this.midGroup[group].push(this.midGroup[this.globalKey][i]);
    }
  };

  /**
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
    if (typeof midcall === 'object') {
      if (midcall.mid && typeof midcall.mid === 'function') {
        
        midcall = midcall.mid();

      } else if (midcall.middleware
            && typeof midcall.middleware === 'function'
            && midcall.middleware.constructor.name === 'AsyncFunction')
      {
        midcall = midcall.middleware.bind(midcall);
      }

    }

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
    var makeRealMid = (prev_mid, grp) => {
      let nextcall = self.midGroup[grp][prev_mid];

      if (method === null && pathname === null) {
        return async (ctx) => { await midcall(ctx, nextcall.bind(null, ctx)); };
      }

      return async (ctx) => {
        if (method !==null && method.indexOf(ctx.method) < 0) {
          return await nextcall(ctx);
        }
        if (pathname !== null && pathname.indexOf(ctx.name) < 0) {
          return await nextcall(ctx);
        }
        return await midcall(ctx, nextcall.bind(null, ctx));
      };
    };

    let last = 0;
    if (group) {
      if (!this.midGroup[group]) {
        this.initGroup(group);
      }
      last = this.midGroup[group].length - 1;
      this.midGroup[group].push(makeRealMid(last, group));
    } else {
      //全局添加中间件
      for (let k in this.midGroup) {
        last = this.midGroup[k].length - 1;
        this.midGroup[k].push(makeRealMid(last, k));
      }
    }
    return this;
  }

  async exec (ctx, group = '*GLOBAL*') {
    if (!group || this.midGroup[group] === undefined) {
      group = this.globalKey;
    }
    let last = this.midGroup[group].length - 1;
    return await this.midGroup[group][last](ctx);

  }

}

module.exports = midCore;

/**
 * 因为两种方式的支持比较复杂，代码会比较乱，请求处理中间件也需要判断，所以屏蔽掉了。
    var makeRealMid = (prev_mid, grp) => {
      let nextcall = self.midGroup[grp][prev_mid];

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
 */
