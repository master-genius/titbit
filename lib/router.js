'use strict';

/**
 * 
 * @param {string} grp_name 
 * @param {function|null} callback 
 * @param {object} app - 创建子应用需要的原始应用实例
 * @param {string} prefix 
 * @param {function} createApp 
 * @returns 
 */
function router_group(grp_name, callback, app=null, prefix=true, createApp, deep=1) {
  if (!app || typeof app !== 'object') {
    throw new Error('必须传递app实例，或者是一个普通的object。')
  }

  let self = this

  grp_name = grp_name.trim()

  let prefix_regex = /^\/?[a-z0-9_\-\/]{1,500}$/i

  let methods = [
    'get', 'post', 'put', 'delete', 'patch', 'options', 'head', 'trace', 'any'
  ]

  let pre_path = (app&&app.__prefix__) ? app.__prefix__ : '';
  let ds = '';

  if (prefix && prefix_regex.test(app.__group__)) {
    pre_path += '/' + app.__group__;
    pre_path = pre_path.replace(/\/{2,}/g, '/');
    ds = '/';
    if (pre_path[pre_path.length-1] === '/') ds = '';
  }

  let makeOptions = (name, commonOptions=null) => {
      let opts

      if (commonOptions && typeof commonOptions === 'object') {
        opts = {...commonOptions, group: grp_name}
      } else {
        opts = {group: grp_name}
      }

      if (name) {
        if (typeof name === 'string') {
          opts.name = name
        } else if (typeof name === 'object' && name.name) {
          opts.name = name.name
        }
      }

      return opts
  }

  let makeSubApp = (grp, cgrp) => {
    let subapp = (createApp && typeof createApp === 'function')
                ? createApp(grp)
                : null;
    //每次都带上当前的路由，以及整体的可配置路径，用于递归调用。
    if (subapp) {
      subapp.__prefix__ = pre_path;
      subapp.__group__ = cgrp.trim();
    }

    if (app && app.__mids__) {
      app.__mids__.forEach(x => {
        subapp.__mids__.push(x)
      })
    }

    return subapp
  }

  let makeSubGroup = (grp) => {
    let ds = '/';
    if (grp_name[grp_name.length-1] === '/' || grp[0] === '/') {
      ds = '';
    }

    let real_grp = `${grp_name}${ds}${grp}`

    return real_grp
  }

  //可以调用app上的pre和use
  let route = Object.create(app)

  methods.forEach(x => {
    route[x] = (path, cb, name='') => {
      return this[x](`${pre_path}${ds}${path}`, cb, makeOptions(name))
    }
  })

  route.map = (marr, path, cb, name='') => {
    return this.map(marr, `${pre_path}${ds}${path}`, cb, makeOptions(name))
  }

  route.group = (grp, cb, prefix=true) => {
    ;(typeof cb === 'boolean') && (prefix = cb);

    if (deep > 9) {
      throw new Error('group调用嵌套过多，请勿递归或深度嵌套调用group指派路由。')
    }

    let real_grp = makeSubGroup(grp)

    let bind_rg = router_group.bind(self)

    return bind_rg(real_grp, cb, makeSubApp(real_grp, grp), prefix, createApp, deep+1)
  }

  route.middleware = (mids, options=null) => {
    return {
      group: (grp, cb, prefix=true) => {
        ;(typeof cb === 'boolean') && (prefix = cb);
        let real_grp = makeSubGroup(grp)
        let subapp = makeSubApp(real_grp, grp)
        
        if (mids) {
          subapp.__mids__.push({
            mids: mids,
            options: options
          })
        }

        return router_group.bind(self)(real_grp, cb, subapp, prefix, createApp, deep+1)
      }
    }
  }

  if (app && app.__mids__ && Array.isArray(app.__mids__)) {
    app.__mids__.forEach(x => {
      let mlist = x.mids

      if (!Array.isArray(x.mids)) mlist = [x.mids]
     
      let opts = makeOptions('', x.options)

      mlist.forEach(m => {
          if (Array.isArray(m)) {
            m[0]
             &&
            app.use(m[0], (m[1] && typeof m[1] === 'object') ? {...opts, ...m[1]} : opts)
          } else {
            app.use(m, opts)
          }
      })
      
    })
  }

  callback && (typeof callback === 'function') && callback(route);

  return route
}

class Router {

  constructor(options = {}) {
    this.ignoreSlash = true;

    this.maxPath = 1000;

    this.count = 0;

    this.maxDepth = 13

    this.apiTable = {
      GET     : {},
      POST    : {},
      PUT     : {},
      DELETE  : {},
      OPTIONS : {},
      HEAD    : {},
      PATCH   : {},
      TRACE   : {}
    };

    /**
     * 2020.7.31 优化方案：
     *  通过数组记录每个类型带参数请求的路由，这样可以直接遍历。
     * */
    this.argsRoute = {
      GET     : [],
      POST    : [],
      PUT     : [],
      DELETE  : [],
      OPTIONS : [],
      HEAD    : [],
      PATCH   : [],
      TRACE   : []
    };

    this.methods = Object.keys(this.apiTable);

    //记录api的分组，只有在分组内的路径才会去处理，
    //这是为了避免不是通过分组添加但是仍然使用和分组相同前缀的路由也被当作分组内路由处理。
    this.apiGroup = {};

    this.nameTable = {};

    if (options.ignoreSlash !== undefined) {
      this.ignoreSlash = options.ignoreSlash;
    }

    this.path_preg = /^[a-z0-9_\-\/\:\*\.\@]{1,1000}$/i;

    Object.defineProperty(this, '__subapp__', {
      enumerable: false,
      configurable: false,
      writable: true,
      value: null
    });

    Object.defineProperty(this, '__group__', {
      enumerable: false,
      configurable: false,
      writable: false,
      value: router_group.bind(this)
    });
  }

  fmtArgsString(p) {
    let arr = [];
    let count = 1;
    for (let a of p.routeArr) {
      if (a[0] === ':') {
        arr.push(':x' + count);
        count++;
      } else {
        arr.push(a);
      }
    }
    return arr.join('/');
  }

  compareArgsPath(a, b) {
    return this.fmtArgsString(a) === this.fmtArgsString(b);
  }

  conflictCheck(p, path, method) {
    let routes = this.apiTable[method];
    if (routes.length === 0 || !p.isArgs) return true;

    let r
    for (let k in routes) {
      r = routes[k]
      if (!r.isArgs || r.routeArr.length !== p.routeArr.length) continue;

      if (this.compareArgsPath(r, p)) {
        console.error(`\x1b[7;31;47mError: ${method} ${path} 和已有路由 ${k} 模式冲突。 \x1b[0m\n`);
        throw new Error(`${path} 和 ${k}模式一致，存在冲突。`);
      }
    }

    return true;
  }

  //预解析路由参数并记录，保证查找的性能
  parsePathParam(p, path, method) {
    if (p.isArgs) {
      //记录参数名称映射，不必在匹配时进行substring
      for (let i = 0; i < p.routeArr.length; i++) {
        let t = {
          path: p.routeArr[i],
          isArgs: p.routeArr[i][0] === ':',
          name: p.routeArr[i][0] === ':' ? p.routeArr[i].substring(1) : p.routeArr[i]
        };

        p.routePath.push(t);

        if (p.routeArr[i][0] != ':') {
          continue;
        }

        if (p.routeArr[i].length < 2) {
          throw new Error(`${path} : 参数不能没有名称，请在:后添加名称`);
        }

        if (t.isArgs) p.argsCount++;
      }

      this.conflictCheck(p, path, method);
    } else {
      let starCount = 0;
      for (let i = 0; i < path.length; i++) {
        if (path[i] == '*') {
          starCount += 1;
        }
      }
      if (starCount > 1) {
        throw new Error(`${path} : 多个 * 导致冲突`);
      }
      p.starPrePath = path.substring(0, path.length - 1);
      p.starLength = p.starPrePath.length;
      for (let i = 0; i < p.routeArr.length; i++) {
        p.routePath.push({path: p.routeArr[i], isStar: p.routeArr[i] === '*'})
      }
    }
  }

  /*
    由于在路由匹配时会使用/分割路径，所以在添加路由时先处理好。
    允许:表示变量，*表示任何路由，但是二者不能共存，因为无法知道后面的是变量还是路由。
    比如：/static/*可以作为静态文件所在目录，但是后面的就直接作为*表示的路径，
    并不进行参数解析。
  */
  /**
   * @param {string} path 路由字符串
   * @param {string} method 请求方法类型
   * @param {function} callback 执行请求的回调函数
   * @param {string} name 请求名称，可以不填写
   * @param {string|bool} group 路由归为哪一组，可以是字符串，
   *              或者是bool值true表示使用/分割的第一个字符串。
   */
  addPath(path, method, callback, name = '') {
    if (typeof callback !== 'function' || callback.constructor.name !== 'AsyncFunction')
    {
      throw new Error(`${method} ${path}: 回调函数必须使用async声明`);
    }

    let api_path = path.trim().replace(/\/{2,}/g, '/');
    if (api_path === '') {
      api_path = '/';
    }

    if (!this.path_preg.test(api_path)) {
      throw new Error(`路由字符串 ${path} 存在非法字符，路由字符串允许 '字母 数字 - _ : * /'，最大长度${this.maxPath}\n`);
    }
    
    if (api_path[0] !== '/') { api_path = `/${api_path}`; }

    if (api_path.length > 1 && api_path[api_path.length-1] == '/' && this.ignoreSlash) {
      api_path = api_path.substring(0, api_path.length-1);
    }

    let group = '';
    if (typeof name === 'object') {
      if (name.group !==undefined) {
        group = name.group;
      }
      if (name.name !== undefined) {
        name = name.name;
      } else {
        name = '';
      }
    } else if (typeof name === 'string') {
      if (name.length > 1 && name[0] == '@') {
        group = name.substring(1);
        name = '';
      }
    } else {
      name = '';
    }

    let add_req = {
        isArgs:  false,
        isStar:  false,
        argsCount: 0,
        routeArr: [],
        routePath: [],
        starPrePath : '',
        starLength : 0,
        reqCall: callback,
        name : name,
        group : '',
        path: api_path
    };

    if (api_path.indexOf('/:') >= 0) {
      add_req.isArgs = true;
    }

    if (api_path.indexOf('/*') >= 0) {
      let last_char = api_path[api_path.length - 1];
      if (api_path.indexOf('/*/') >= 0) {
        throw new Error(`${api_path} : 任意匹配参数 * 只能出现在最后`);
      }
      if (last_char === '*') add_req.isStar = true;
    }

    if (add_req.isStar && add_req.isArgs) {
      console.error(`\x1b[7;31;47mError: path中 : 和 * 不能同时出现 \x1b[0m\n`);
      throw new Error(`${api_path} 参数 : 和 * 不能同时出现`);
    }

    if (name !== '' && this.nameTable[name]) {
      throw new Error(`路由命名${name} 已经存在。`);
    }

    add_req.routeArr = api_path.split('/').filter(p => p.length > 0);
    if(typeof group === 'string' && group.length > 0) {
      add_req.group = group;
    }

    if (add_req.isArgs || add_req.isStar) {
      this.parsePathParam(add_req, api_path, method);
    }

    if (add_req.group !== '') {
      if (this.apiGroup[add_req.group] === undefined) {
        this.apiGroup[add_req.group] = [];
      }
      this.apiGroup[add_req.group].push({
        method: method,
        path: api_path
      });
    }

    if (this.methods.indexOf(method) >= 0) {
      if (this.apiTable[method][api_path]) {
        throw new Error(`${api_path}冲突，多次添加`);
      }
      
      this.count += 1;

      this.apiTable[method][api_path] = add_req;
      if (name.length > 0) {
        this.nameTable[name] = api_path;
      }
      //记录带参数路由
      if (add_req.isArgs || add_req.isStar) {
        this.argsRoute[method].push(add_req);
      }
    }
  }

  argsRouteSort() {
    for (let m in this.argsRoute) {
      this.argsRoute[m].sort((a, b) => {
        if (a.isStar && b.isStar) {
          return b.routeArr.length - a.routeArr.length
        }

        if (a.isStar && b.isArgs) {
          return 1
        }

        if (a.isArgs && b.isStar) {
          return -1
        }

        return 0
      });

      this.argsRoute[m].sort((a, b) => {
        if (a.isArgs && b.isArgs) {
          return a.argsCount - b.argsCount
        }

        return 0
      });
    }
  }

  /**
   * 
   * @param {string} grp_name 
   * @param {function} callback 
   * @param {boolean} prefix 是否用作路经前缀，默认为true
   */
  group(grp_name, callback, prefix=true) {
    let subapp = this.__subapp__ && typeof this.__subapp__ === 'function'
                ? this.__subapp__(grp_name)
                : null;

    subapp.__group__ = grp_name.trim();
    return this.__group__(grp_name, callback, subapp, prefix, this.__subapp__);
  }

  get(api_path, callback, name='') {
    this.addPath(api_path, 'GET', callback, name);
  }

  post(api_path, callback, name='') {
    this.addPath(api_path, 'POST', callback, name);
  }

  put(api_path, callback, name='') {
    this.addPath(api_path, 'PUT', callback, name);
  }

  delete(api_path, callback, name='') {
    this.addPath(api_path, 'DELETE', callback, name);
  }

  options (api_path, callback, name = '') {
    this.addPath(api_path, 'OPTIONS', callback, name);
  }
  
  patch(api_path, callback, name = '') {
    this.addPath(api_path, 'PATCH', callback, name);
  }

  head(api_path, callback, name = '') {
    this.addPath(api_path, 'HEAD', callback, name);
  }

  trace(api_path, callback, name = '') {
    this.addPath(api_path, 'TRACE', callback, name);
  }

  /**
   * @param [array] marr method数组，示例['GET','HEAD']。
   * @param {string} api_path 路由字符串。
   * @param {function} callback 请求处理回调函数，必须是async声明。
   * @param {string} name 请求命名，默认为空字符串，可以不写。
   * */
  map(marr, api_path, callback, name='') {
    for(let i = 0; i < marr.length; i++) {
      this.addPath(api_path, marr[i], callback, name);
    }
  }
  
  any(api_path, callback, name='') {
    this.map(this.methods, api_path, callback, name);
  }

  getGroup() {
    return this.apiGroup;
  }

  routeTable() {
    return this.apiTable;
  }

  /** 清理路由表等 */
  clear() {
    for(let k in this.apiTable) {
      this.apiTable[k] = {};
      this.argsRoute[k] = [];
    }
    this.apiGroup = {};
    this.nameTable = {};
  }

  /** 
   * 输出路由表
  */
  printTable() {
    console.log(this.getTable());
  }

  getTable() {
    let rtext = '';
    let ptmp = '';

    for (let k in this.apiTable) {
      for (let p in this.apiTable[k]) {
        ptmp = `${k}          `;
        rtext += `${ptmp.substring(0,8)} ----  ${p}\n`;
      }
    }
    return rtext;
  }

  /**
   * findPath只是用来查找带参数的路由。
   * @param {string} path 路由字符串。
   * @param {string} method 请求类型。
   */
  findPath(path, method) {
    if (!this.apiTable[method]) {
      return null;
    }

    let path_split = path.split('/').filter(p => p.length > 0);
    if (path_split.length > this.maxDepth) {
      return null;
    }

    let next = 0;
    let args = {};
    let r = null;
    let margs = this.argsRoute[method];
    let alength = margs.length;
    let cur_path;
    let path_split_max = path_split.length + 1;

    for (let i=0; i < alength; i++) {
      r = margs[i];

      if ( (r.routePath.length !== path_split.length && r.isStar===false)
        || (r.isStar && r.routePath.length > path_split_max) )
      {
        continue;
      }

      next = false;
      
      if (r.isStar) {
        for (let i = 0; i < r.routePath.length; i++) {
          cur_path = r.routePath[i];
          if(!cur_path.isStar && cur_path.path !== path_split[i]) {
            next = true;
            break;
          }
        }

        if (!next) {
          args.starPath = path.substring(r.starLength);
        }

      } else {
        for(let i=0; i < r.routePath.length; i++) {
          cur_path = r.routePath[i];
          if (!cur_path.isArgs && cur_path.path !== path_split[i]) {
            next = true;
            break;
          }
        }
        //如果next为false，则表示匹配成功，此时解析出所有的参数。
        if (!next) {
          for (let i=0; i < r.routePath.length; i++) {
            cur_path = r.routePath[i];
            if (cur_path.isArgs) {
              args[ cur_path.name ] = path_split[i];
            }
          }
        }

      } // end else

      if (next) continue;

      return {key: r.path, args: args};
    }
    return null;
  }

  /**
   * 
   * @param {string} path 
   * @param {string} method 
   */
  findRealPath(path, method) {
    let plen = path.length;

    if (plen > this.maxPath) {
      return null;
    }

    if (this.apiTable[method] === undefined) {
      return null;
    }

    let route_path = null;

    if (this.ignoreSlash && plen > 1 && path[plen-1] === '/') {
      path = path.substring(0, plen-1);
    }

    let mp = this.apiTable[method][path];

    if (mp !== undefined) {
      route_path = path;
    }

    if (route_path && (mp.isArgs || mp.isStar) ) {
      route_path = null;
    }
    
    let parg = null;
    if (route_path === null) {
      parg = this.findPath(path, method);
    } else {
      parg = {args : {}, key: route_path};
    }

    if (parg !== null) {
      parg.reqcall = this.apiTable[method][parg.key];
    }
    
    return parg;
  }

}

module.exports = Router;

