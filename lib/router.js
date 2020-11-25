'use strict';

class router {

  constructor (options = {}) {
    this.ignoreSlash = true;

    this.maxPath = 1024;

    this.count = 0;

    this.apiTable = {
      'GET'   : {},
      'POST'  : {},
      'PUT'   : {},
      'DELETE'  : {},
      'OPTIONS' : {},
      'HEAD'  : {},
      'PATCH' : {},
      'TRACE' : {}
    };

    /**
     * 2020.7.31 优化方案：
     *  通过数组记录每个类型带参数请求的路由，这样可以直接遍历。
     * */
    this.argsRoute = {
      'GET'   : [],
      'POST'  : [],
      'PUT'   : [],
      'DELETE'  : [],
      'OPTIONS' : [],
      'HEAD'  : [],
      'PATCH'   : [],
      'TRACE'   : []
    };

    this.methods = Object.keys(this.apiTable);

    //记录api的分组，只有在分组内的路径才会去处理，
    //这是为了避免不是通过分组添加但是仍然使用和分组相同前缀的路由也被当作分组内路由处理。
    this.apiGroup = {};

    this.nameTable = {};

    if (options.ignoreSlash !== undefined) {
      this.ignoreSlash = options.ignoreSlash;
    }
  }

  //预解析路由参数并记录，保证查找的性能
  parsePathParam (p, path) {
    if (p.isArgs) {
      //记录参数名称映射，不必在匹配时进行substring
      for (let i = 0; i < p.routeArr.length; i++) {
        if (p.routeArr[i][0] != ':') {
          continue;
        }
        if (p.routeArr[i].length < 2) {
          throw new Error(`${path} : 参数不能没有名称，请在:后添加名称`);
        }
        
        p.argsTable[ p.routeArr[i] ] = p.routeArr[i].substring(1);
      }
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
   *              或者是bool值true表示使用/分割的第一个字符串。
   */
  addPath (api_path, method, callback, name = '') {
    if (typeof callback !== 'function' || callback.constructor.name !== 'AsyncFunction')
    {
      throw new Error(`${method} ${api_path}: 回调函数必须使用async声明`);
    }

    if (api_path === '') {
      api_path = '/';
    }
    
    if (api_path[0] !== '/') { api_path = `/${api_path}`; }

    if (api_path.length > 1 && api_path[api_path.length-1] == '/' && this.ignoreSlash) {
      api_path = api_path.substring(0, api_path.length-1);
    }

    var group = '';
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

    var add_req = {
        isArgs:  false,
        isStar:  false,
        routeArr: [],
        argsTable : {},
        starPrePath : '',
        starLength : 0,
        reqCall: callback,
        name : name,
        group : ''
      };

    if (api_path.indexOf(':') >= 0) {
      add_req.isArgs = true;
    }
    if (api_path.indexOf('*') >= 0) {
      add_req.isStar = true;
      if (api_path[api_path.length - 1] != '*') {
        throw new Error(`${api_path} : 任意匹配参数 * 只能出现在最后`);
      }
    }

    if (add_req.isStar && add_req.isArgs) {
      throw new Error(`${api_path} 参数:和*不能同时出现`);
    }

    if (name !== '' && this.nameTable[name]) {
      throw new Error(`路由命名${name} 已经存在。`);
    }

    add_req.routeArr = api_path.split('/').filter(p => p.length > 0);
    if(typeof group === 'string' && group.length > 0) {
      add_req.group = group;
    }

    if (add_req.isArgs || add_req.isStar) {
      this.parsePathParam(add_req, api_path);
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
        this.argsRoute[method].push(api_path);
      }
    }
  }

  get (api_path, callback, name='') {
    this.addPath(api_path, 'GET', callback, name);
  }

  post (api_path, callback, name='') {
    this.addPath(api_path, 'POST', callback, name);
  }

  put (api_path, callback, name='') {
    this.addPath(api_path, 'PUT', callback, name);
  }

  delete (api_path, callback, name='') {
    this.addPath(api_path, 'DELETE', callback, name);
  }

  options (api_path, callback, name = '') {
    this.addPath(api_path, 'OPTIONS', callback, name);
  }

  patch (api_path, callback, name = '') {
    this.addPath(api_path, 'PATCH', callback, name);
  }

  head (api_path, callback, name = '') {
    this.addPath(api_path, 'HEAD', callback, name);
  }

  trace (api_path, callback, name = '') {
    this.addPath(api_path, 'TRACE', callback, name);
  }

  map (marr, api_path, callback, name='') {
    for(let i = 0; i < marr.length; i++) {
      this.addPath(api_path, marr[i], callback, name);
    }
  }

  any (api_path, callback, name='') {
    this.map(this.methods, api_path, callback, name);
  }

  group () {
    return this.apiGroup;
  }

  routeTable () {
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

  getTable () {
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
  findPath (path, method) {
    if (!this.apiTable[method]) {
      return null;
    }

    let path_split = path.split('/').filter(p => p.length > 0);
    if (path_split.length > 9) {
      return null;
    }

    let next = 0;
    let args = {};
    let r = null;
    let alength = this.argsRoute[method].length;

    for (let i=0; i < alength; i++) {

      r = this.apiTable[method][ this.argsRoute[method][i] ];

      if ( (r.routeArr.length !== path_split.length && r.isStar === false)
        || (r.isStar && r.routeArr.length > path_split.length+1) )
      {
        continue;
      }

      next = false;
      //args = {};
      
      if (r.isStar) {
        for(let i=0; i < r.routeArr.length; i++) {
          if (r.routeArr[i] == '*') {
            //args.starPath = path_split.slice(i).join('/');
          } else if(r.routeArr[i] !== path_split[i]) {
            next = true;
            break;
          }
        }

        if (!next) {
          args.starPath = path.substring(r.starLength);
        }

      } else {
        for(let i=0; i < r.routeArr.length; i++) {
          if (r.routeArr[i][0] === ':') {
            //args[ r.argsTable[ r.routeArr[i] ] ] = path_split[i];
            //args[r.routeArr[i].substring(1)] = path_split[i];
          } else if (r.routeArr[i] !== path_split[i]) {
            next = true;
            break;
          }
        }
        //如果next为false，则表示匹配成功，此时解析出所有的参数。
        if (!next) {
          for (let i=0; i < r.routeArr.length; i++) {
            if (r.routeArr[i][0] === ':') {
              args[ r.argsTable[ r.routeArr[i] ] ] = path_split[i];
            }
          }
        }

      } // end else

      if (next) { continue; }

      return {key: this.argsRoute[method][i], args: args};
    }
    return null;
  }

  /**
   * 
   * @param {string} path 
   * @param {string} method 
   */
  findRealPath (path, method) {

    if (path.length > this.maxPath) {
      return null;
    }

    if (this.apiTable[method] === undefined) {
      return null;
    }

    let route_path = null;

    if (this.ignoreSlash && path.length > 1 && path[path.length-1] === '/') {
      path = path.substring(0, path.length-1);
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
    };
    
    return parg;
  }

}

module.exports = router;

/* setPre(pre) {
    if (pre.trim().length > 0 && pre != '/') {
      pre = pre.trim();
      if (pre[0] != '/') {
        pre = `/${pre}`;
      }
      if (pre[ pre.length-1 ] == '/') {
        pre = pre.substring(0, pre.length-1);
      }
      
      this.pre = pre;
    }
  } */
