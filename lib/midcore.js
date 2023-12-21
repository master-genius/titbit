'use strict';

class midCore {

  constructor (options = {}) {
    this.debug = true;
    if (options.debug !== undefined) {
      this.debug = options.debug;
    }

    this.errorHandle = options.errorHandle;
    
    if (typeof this.errorHandle !== 'function') {
      this.errorHandle = (err, errname) => {
        this.debug && console.error(errname, err);
      };
    }

    this.globalKey = `_GLOBAL_0129_${Math.random().toString(16).substring(2)}_`;

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
  initGroup(group, fromGroup='') {
    this.midGroup[group] = [];
    let mids = this.midGroup[this.globalKey];
    
    /* if (fromGroup && group !== fromGroup && this.midGroup[fromGroup])
      mids = this.midGroup[fromGroup]; */

    for(let i=0; i < mids.length; i++) {
      this.midGroup[group].push(mids[i]);
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
      throw new Error('callback and middleware function must use async');
    }
    
    let pathname = null;
    let group = null;
    let method = null;
    //let from_group = '';
    if (typeof options === 'string') {
      options = [options];
    }

    if (Array.isArray(options)) {
      pathname = options;
    } if (typeof options === 'object') {
      if (options.name !== undefined) {
        if (typeof options.name === 'string') {
          pathname = [options.name];
        } else if (Array.isArray(options.name) && options.name.length > 0) {
          pathname = options.name;
        }
      }

      if (options.group !== undefined && typeof options.group === 'string') {
        group = options.group;
      }

      /* if (options.from && typeof options.from === 'string') {
        from_group = options.from;
      } */

      if (options.method !== undefined) {
        if (typeof options.method === 'string' && options.method.length > 0) {
          method = [options.method];
        } else if (Array.isArray(options.method) && options.method.length > 0) {
          method = options.method;
        }
        //请求方法如果传递了小写，都转换为大写。
        method && method.forEach((m, index) => {
          method[index] = m.toUpperCase();
        });
      }
    }

    let self = this;
    let makeRealMid = (prev_mid, grp) => {
      let nextcall = self.midGroup[grp][prev_mid];

      if (method === null && pathname === null) {
        return async (ctx) => { await midcall(ctx, nextcall.bind(null, ctx)); };
      }

      let methodTable = null;
      method && (methodTable = {}) && method.forEach(a => { methodTable[a] = true; });

      let nameTable = null;
      pathname && (nameTable = {}) && pathname.forEach(a => { nameTable[a] = true; });

      return async (ctx) => {
        if (methodTable && methodTable[ctx.method] === undefined) {
          return await nextcall(ctx);
        }

        if (nameTable && nameTable[ctx.name] === undefined) {
          return await nextcall(ctx);
        }

        return await midcall(ctx, nextcall.bind(null, ctx));
      };
    };

    let last = 0;
    if (group) {
      if (!this.midGroup[group]) {
        this.initGroup(group);
        //this.initGroup(group, from_group);
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

  exec(ctx, group='') {
    if (!group || this.midGroup[group] === undefined) {
      group = this.globalKey;
    }

    let last = this.midGroup[group].length - 1;
    return this.midGroup[group][last](ctx);
  }

}

module.exports = midCore;
