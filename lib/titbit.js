'use strict';

const fs = require('node:fs');
const cluster = require('node:cluster');
const os = require('node:os');
const {spawn} = require('node:child_process');
const bodyParser = require('./bodyparser.js');
const middleware1 = require('./middleware1.js');
const middleware2 = require('./middleware2.js');
const router = require('./router.js');
const connfilter = require('./connfilter.js');
const http1 = require('./http1.js');
const httpt = require('./http2.js');
const httpc = require('./httpc.js');
const loggermsg = require('./loggermsg.js');
const monitor = require('./monitor.js');
const strong = require('./strong.js');
const optionsCheck = require('./optionsCheck.js');
const versionCheck = require('./versionCheck.js');
const context1 = require('./context1.js');
const context2 = require('./context2.js');
const helper = require('./helper.js');

let __instance__ = 0;

let vchk = versionCheck();

if (vchk.stat === false) {
  console.error(vchk.errmsg);
  process.exit(1);
}

let _titbit_server_running = `
:.:.:.:.:.:.titbit in service.:.:.:.:.:.:
`;

let _titbit_home_page = `<!DOCTYPE html><html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body>
  <div style="width:90%;margin:auto;margin-top:1rem;color:#4a4a4f;">
    <div style="text-align:center;">
      <h1>titbit</h1>
      <br>
      <p>功能强大、简洁高效的Web开发框架。</p>
      <p>文档 & 仓库：
        <a style="text-decoration:none;color:#345689;" href="https://gitee.com/daoio/titbit" target=_blank>
          titbit</a></p>
    </div>
  </div>
</body>
</html>`;

function sigExit() {
    process.kill(0, 'SIGTERM');
    
    //防止有监听SIGTERM不退出的情况。
    setTimeout(() => {
      process.kill(0, 'SIGKILL');
    }, 5);
}

function makeSubAppForGroup(app, grp_name) {
  let makeOptions = (grp, opts) => {
    if (!opts || typeof opts !== 'object') {
      return {group: grp}
    }

    let options = {...opts}
    
    options.group = grp

    return options
  }

  let subapp = {
    /* middleware: (mids, options=null) => {
      if (!Array.isArray(mids)) mids = [mids]

      for (let m of mids) {
        app.use(m, makeOptions(grp_name, options))
      }

      return subapp
    }, */

    pre: (mid, options=null) => {
      app.pre(mid, makeOptions(grp_name, options))
      return subapp
    },

    use: (mid, options=null) => {
      app.use(mid, makeOptions(grp_name, options))
      return subapp
    }
  }

  Object.defineProperties(subapp, {
    __mids__: {
      enumerable: false,
      writable: true,
      value:[]
    },
    __prefix__: {
      enumerable: false,
      writable: true,
      value: ''
    },
    __group__: {
      enumerable: false,
      writable: true,
      value: ''
    },
  })

  return subapp
}

/**
 * @param {object} options 初始化选项，参考值如下：
 * - debug 调试模式，默认为false
 * - maxConn 最大连接数，使用daemon接口，则每个进程都可以最多处理maxConn限制数量，0表示不限制。
 * - deny  {Array} IP字符串数组，表示要拒绝访问的IP。
 * - maxIPRequest {number} 单个IP单元时间内最大访问次数。
 * - unitTime {number} 单元时间，配合maxIPRequest，默认为1表示1秒钟清空一次。
 * - maxIPCache {number} 最大IP缓存个数，配合限制IP访问次数使用，默认为50000。
 * - allow   {Array} 限制IP请求次数的白名单。
 * - useLimit {bool} 启用连接限制，用于限制请求的选项需要启用此选项才会生效。
 * - timeout {number} 超时。
 * - cert {string} 启用HTTPS要使用的证书文件路径。
 * - key  {string} 启用HTTPS的密钥文件路径。
 * - globalLog {bool} 启用全局日志。
 * - maxBody {number} 表示POST/PUT提交表单的最大字节数，包括上传文件。
 * - maxFiles {number} 最大上传文件数量，超过则不处理。
 * - daemon {bool} 启用守护进程模式。
 * - pidFile {string} 保存Master进程PID的文件路径。
 * - logFile {string} 日志文件。
 * - errorLogFile {string} 错误日志文件。
 * - logType {string} 日志类型，支持stdio、file、self
 * - logHandle {function} 自定义日志处理函数，接收参数为worker和msg（json格式的日志）
 * - logHistory {number} 最大日志文件数量，默认为50。
 * - server {object}  服务器选项，参考http2.createSecureServer
 * - notFound {string} 404页面数据。
 * - parseBody {bool} 自动解析上传文件数据，默认为true。
 * - http2 {bool} 默认false。
 * - allowHTTP1 {bool} 默认为false。
 * - loadInfoFile {string} daemon为true，负载信息会输出到设置的文件，默认为空
 * - memFactor {number} 控制内存最大使用量的系数，范围从 -0.48 ～ 0.36，会使用基本系数加上此值并乘以内存总量。默认值0.28。
 *      RSS基本系数是0.52。不要设置的太低，提供比较低的值是为了测试使用。
 * - maxUrlLength 最大URL长度，包括path和querystring
 * - maxpool 请求上下文的最大缓存池数量。
 * - loadMonitor true|false，表示是否启用负载监控功能，在daemon模式有效，默认为true。
 * - monitorTimeSlice 子进程获取系统占用资源的定时器时间片，毫秒值，默认为500。
 * - maxQuery 最大允许的querystring的参数，默认为12。
 * - fastParseQuery 快速解析querystring，默认为false，会把多个重名的解析为数组，true表示快速解析，不允许重复的名字，否则仅第一个生效。
 * - maxFormLength 在multipart/form-data类型提交数据时，单个form项的最大值，默认为1000000字节。
 * - errorHandle 收集错误并处理的函数，默认是输出错误信息，接收参数为两个，第一个是错误信息，第二个是错误的名字描述。
 * - ignoreSlash 忽略末尾的/，默认为true。
 * - maxLoadRate 在自动创建子进程平衡负载模式，最大子进程负载率限制：25 ～ 98表示百分比。
 * - streamTimeout http2Stream超时，若不设置，默认采用timeout的设置。
 */

let titbit = function (options = {}) {

  if (! (this instanceof titbit) ) {
    return new titbit(options);
  }

  if (__instance__ > 0) throw new Error('titbit遵循单例模式，不能构造多次，多个实例是错误的使用方式。你可以在多进程或多线程中构造新的实例。');

  __instance__ += 1;

  this.config = {
    //此配置表示POST/PUT提交表单的最大字节数，也是上传文件的最大限制，
    maxBody   : 50_000_000,
    maxFiles      : 12,
    daemon        : false, //开启守护进程

    //开启守护进程模式后，如果设置路径不为空字符串，则会把pid写入到此文件，可用于服务管理。
    pidFile       : '',
    logFile       : '',
    errorLogFile  : '',

    //最大日志文件数量
    logHistory    : 50,

    logMaxLines   : 50000,
    
    // stdio or file
    logType     : 'stdio',

    //开启HTTPS
    https       : false,

    http2       : false,

    allowHTTP1  : false,

    //HTTPS密钥和证书的路径
    key   : '',
    cert  : '',

    //服务器选项，参考http2.createSecureServer、tls.createServer
    server : {
      //TLS握手连接（HANDSHAKE）超时
      handshakeTimeout: 9000
    },

    //设置服务器超时，毫秒单位。
    timeout   : 20000,

    debug     : false,
    
    notFound  : 'not found',
    badRequest : 'bad request',
    //展示负载信息，必须使用daemon接口
    showLoadInfo  : true,
    loadInfoType  : 'text', // text | json | orgjson | --null
    loadInfoFile  : '',

    ignoreSlash: true,
    parseBody: true,

    useLimit: false,

    //启用全局日志
    globalLog: false,
    logHandle : null,
    realIP: false,

    //内存使用控制系数，-0.35 ~ 0.35
    memFactor : 0.28,

    autoDecodeQuery : true,

    maxUrlLength: 1152,

    maxpool : 4096,

    //子进程汇报资源信息的定时器毫秒数。
    monitorTimeSlice: 500,

    //querystring最大个数
    maxQuery: 15,

    //快速解析querystring，多个同名的值会仅设置第一个，不会解析成数组。
    fastParseQuery: false,

    strong : false,

    //在multipart格式中，限制单个表单项的最大长度。
    maxFormLength: 1000000,

    //允许的最大表单键值个数。
    maxFormKey: 100,

    errorHandle: (err, errname = '') => {
      if (err) {
        if (err.code === 'HPE_INVALID_EOF_STATE' || err.code === 'ERR_HTTP_REQUEST_TIMEOUT') {
          return;
        }
      }

      this.config.debug && console.error(errname, err);
    },

    //-1表示使用timeout的设置。
    streamTimeout: -1,

    requestTimeout: 100000,

    maxLoadRate: 75
  };

  this.whoami = 'titbit';

  this.limit = {
    maxConn       : 1024,
    deny          : null,
    deny_type     : 'o',
    //每秒单个IP可以进行请求次数的上限，0表示不限制。
    maxIPRequest  : 0,
    unitTime      : 1000,
    maxIPCache    : 50000,
    allow         : null,
    allow_type    : 'o',
  };

  if (typeof options !== 'object') options = {};

  for(let k in options) {
    switch (k) {
      case 'maxConn':
        optionsCheck(k, options[k], this.limit, {type: 'number', min: 0});
        break;

      case 'deny':
        optionsCheck(k, options[k], this.limit, {type: ['object', 'function']});
        this.limit.deny_type = (typeof options[k])[0];
        break;
      
      case 'maxIPRequest':
        optionsCheck(k, options[k], this.limit, {type: 'number', min: 0});
        break;

      case 'unitTime':
        if (typeof options[k] === 'number' && options[k] >= 0.1 && options[k] <= 86400) {
          this.limit.unitTime = parseInt(options[k] * 1000);
        }
        break;

      case 'maxIPCache':
        optionsCheck(k, options[k], this.limit, {type: 'number', min: 1024});
        break;
      
      case 'allow':
        optionsCheck(k, options[k], this.limit, {type: ['object', 'function']});
        this.limit.allow_type = (typeof options[k])[0];
        break;

      case 'logHandle':
      case 'errorHandle':
        optionsCheck(k, options[k], this.config, {type: 'function'});
        break;
      
      case 'logMaxLines':
        optionsCheck(k, options[k], this.config, {type: 'number', min: 1, max: 5000000});
        break;

      case 'memFactor':
        optionsCheck(k, options[k], this.config, {type: 'number', min: -0.58, max: 0.36});
        break;

      case 'maxUrlLength':
        optionsCheck(k, options[k], this.config, {type: 'number', min: 1, max: 4096});
        break;
      
      case 'maxpool':
        optionsCheck(k, options[k], this.config, {type: 'number', min: 2, max: 50000});
        break;

      case 'monitorTimeSlice':
        optionsCheck(k, options[k], this.config, {type: 'number', min: 5, max: 5000});
        break;

      case 'maxLoadRate':
        optionsCheck(k, options[k], this.config, {type: 'number', min: 25, max: 98});
        break;

      case 'maxFiles':
      case 'maxBody':
      case 'maxQuery':
      case 'requestTimeout':
      case 'timeout':
      case 'streamTimeout':
        optionsCheck(k, options[k], this.config, {type: 'number', min: 0});
        break;

      case 'maxFormLength':
      case 'maxFormKey':
      case 'logHistory':
        optionsCheck(k, options[k], this.config, {type: 'number', min: 1});
        break;

      case 'logType':
        optionsCheck(k, options[k], this.config, {list: ['stdio','file', '']});
        break;
      
      case 'loadInfoType':
        optionsCheck(k, options[k], this.config, {list: ['--null', 'text', 'json', 'orgjson']});
        break;

      case 'loadMonitor':
        this.config.showLoadInfo = !!options[k];
        break;

      case 'showLoadInfo':
      case 'daemon':
      case 'debug':
      case 'globalLog':
      case 'ignoreSlash':
      case 'parseBody':
      case 'useLimit':
      case 'http2':
      case 'https':
      case 'autoDecodeQuery':
      case 'realIP':
      case 'fastParseQuery':
      case 'allowHTTP1':
        this.config[k] = !!options[k]; break;

      case 'notFound':
      case 'badRequest':
      case 'logFile':
      case 'errorLogFile':
      case 'loadInfoFile':
      case 'pidFile':
        optionsCheck(k, options[k], this.config, {type: 'string'});
        break;

      case 'strong':
        this.config[k] = options[k]; break;

      default:
        if (this.config[k] === undefined) {
          setTimeout(() => {
            console.error(`\x1b[7m!!未知选项: ${k}\n!!请查看文档使用正确的选项。\n\x1b[0m`);
          }, 500);
        }
    }
  }

  if (options.server && typeof options.server === 'object') {
    for (let x in options.server) {
      this.config.server[x] = options.server[x];
    }
  }

  if (options.key && options.cert) {
    this.config.cert = options.cert;
    this.config.key = options.key;
    this.config.https = true;
  } else if (this.config.server.SNICallback && typeof this.config.server.SNICallback === 'function') {
    this.config.https = true;
  }

  if (this.config.streamTimeout < 0) {
    this.config.streamTimeout = this.config.timeout;
  }

  //记录当前的运行情况
  this.rundata = {
    conn : 0,
    platform : os.platform(),
    host : '',
    port : 0,
    cpuLast : {user:0,system:0},
    cpuTime : {user:0,system:0},
    mem : {
      rss : 0,
      heapTotal: 0,
      heapUsed : 0,
      external : 0,
      //rss + external
      total: 0,
      arrayBuffers: 0
    },
    cpus : 0
  };
  
  /**
   * 用于限制在daemon模式，子进程如果真的超出最大内存限制则会重启子进程。
   * 因为RSS包括了Buffer的占用，所以maxrss包括Buffer默认的最大限制。
   * 在Node 12+版本测试默认heaptotal可以稍微超过2G。
   * */
  this.totalmem = os.totalmem();
  this.topmem = 2147483648;

  if (this.topmem > this.totalmem) {
    this.topmem = parseInt(this.totalmem * 0.9);
  }

  this.secure = {
    //minmem : 50000 超过最大内存限制则只有在连接数为0时才会重启进程
    //而超过diemem则直接kill 这限制的是对heap的使用
    //parseInt(this.topmem * (0.5 + this.config.memFactor) )
    diemem : this.topmem,

    //parseInt(this.topmem * (0.5 + this.config.memFactor) )
    maxmem : parseInt(this.topmem * 0.95),

    maxrss : parseInt(this.totalmem * (0.52 + this.config.memFactor) )
  };
  
  //运行时服务，需要在全局添加一些服务插件可以放在此处。
  //如果需要把app相关配置信息，router等传递给请求上下文可以放在此处。
  Object.defineProperty(this, 'service', {
    enumerable: false,
    writable: false,
    configurable: false,
    value: Object.create(null)
  });

  this.bodyparser = new bodyParser({
    maxFormKey: this.config.maxFormKey,
    maxFiles: this.config.maxFiles,
    maxFormLength: this.config.maxFormLength
  });

  this.router = new router(this.config);
  this.router.__subapp__ = makeSubAppForGroup.bind(this,this);

  //连接过滤和计数以及超时控制。
  this.connfilter = connfilter;

  if (this.config.http2) {
    if (this.config.allowHTTP1) {
      this.config.server.allowHTTP1 = true;
    } else if (this.config.server.allowHTTP1) {
      this.config.allowHTTP1 = true;
    }
  }

  if (this.config.http2 && !this.config.allowHTTP1) {
    this.midware = new middleware2(this.config);
  } else {
    this.midware = new middleware1(this.config);
  }

  this.eventTable = {};
  this.server = {};
  this.__pre_mids__ = [];
  let opts = {
    config: this.config,
    events: this.eventTable,
    router: this.router,
    midware: this.midware,
    service: this.service,
    isWorker: this.isWorker,
  };

  if (this.config.http2 && !this.config.allowHTTP1) {
    this.httpServ = new httpt(opts);
  } else {
    this.httpServ = new http1(opts);
    if (this.config.http2 && this.config.allowHTTP1) {
      let hc = new httpc();
      hc.init(this);
    }
  }

  this.logger = null;
  this.monitor = null;

  this.__init__();
};

/**
 * 
 * @param {string} path 路由字符串
 * @param {function} cb 回调函数
 * @param {object|string} options 选项
 */
titbit.prototype.get = function(path, cb, options='') {
  return this.router.get(path, cb, options)
}

/**
 * 
 * @param {string} path 路由字符串
 * @param {function} cb 回调函数
 * @param {object|string} options 选项
 */
titbit.prototype.post = function(path, cb, options='') {
  return this.router.post(path, cb, options)
}

/**
 * 
 * @param {string} path 路由字符串
 * @param {function} cb 回调函数
 * @param {object|string} options 选项
 */
titbit.prototype.put = function(path, cb, options='') {
  return this.router.put(path, cb, options)
}

/**
 * 
 * @param {string} path 路由字符串
 * @param {function} cb 回调函数
 * @param {object|string} options 选项
 */
titbit.prototype.delete = function(path, cb, options='') {
  return this.router.delete(path, cb, options)
}

/**
 * 
 * @param {string} path 路由字符串
 * @param {function} cb 回调函数
 * @param {object|string} options 选项
 */
titbit.prototype.options = function(path, cb, options='') {
  return this.router.options(path, cb, options)
}

/**
 * 
 * @param {string} path 路由字符串
 * @param {function} cb 回调函数
 * @param {object|string} options 选项
 */
titbit.prototype.patch = function(path, cb, options='') {
  return this.router.patch(path, cb, options)
}

/**
 * 
 * @param {string} path 路由字符串
 * @param {function} cb 回调函数
 * @param {object|string} options 选项
 */
titbit.prototype.head = function(path, cb, options='') {
  return this.router.head(path, cb, options)
}

/**
 * 
 * @param {string} path 路由字符串
 * @param {function} cb 回调函数
 * @param {object|string} options 选项
 */
titbit.prototype.trace = function(path, cb, options='') {
  return this.router.trace(path, cb, options)
}

/**
 * 
 * @param {string} grp_name 路由分组名称
 * @param {function} cb 回调函数
 * @param {boolean} prefix 是否作为前缀路经，默认为true，当检测到路由是合法的模式会自动设置为前缀路径
 */
titbit.prototype.group = function(grp_name, cb, prefix=true) {
  return this.router.group(grp_name, cb, prefix)
}

/**
 * 
 * @param {Array} mids 
 * @returns {object} - 属性值group函数
 */
titbit.prototype.middleware = function(mids, options=null) {
  let submid = {
    group: (grp_name, cb, prefix=true) => {
      let subapp = makeSubAppForGroup(this, grp_name);
      subapp.__mids__.push({
        mids: mids,
        options: options
      });

      subapp.__group__ = grp_name.trim();

      return this.router.__group__(grp_name, cb, subapp, prefix, this.router.__subapp__);
    }
  }

  return submid;
}

/**
 * @param {array} marr method数组，示例['GET','HEAD']。
 * @param {string} path 路由字符串。 
 * @param {function} callback 请求处理回调函数，必须是async声明。
 * @param {string} name 请求命名，默认为空字符串，可以不写。
 */
titbit.prototype.map = function (marr, path, callback, name = '') {
  return this.router.map(marr, name, callback, name);
};

/**
 * @param {string} path 路由字符串。 
 * @param {function} callback 请求处理回调函数，必须是async声明。
 * @param {string} name 请求命名，默认为空字符串，可以不写。
 */
titbit.prototype.any = function (path, callback, name = '') {
  return this.router.any(name, callback, name);
};

titbit.prototype.__init__ = function () {
  if (this.__init_flag__) return false;
  //workers记录了在cluster模式，每个worker的启动时间，这可以在disconnect事件中检测。
  Object.defineProperties(this, {
    workers: {
      enumerable: false,
      configurable: false,
      writable: false,
      value: Object.create(null)
    },
    workerCount: {
      enumerable: false,
      configurable: false,
      writable: false,
      value: {
        total : 0,
        cur : 0,
        max : 0,
        canAutoFork: true,
      }
    },

    msgEvent: {
      enumerable: false,
      configurable: false,
      writable: false,
      value: Object.create(null)
    }
  });

  //如果worker运行在很短时间内退出说明可能存在问题，这时候则终止master进程并立即给出错误信息。
  //注意这是在运行开始就要判断并解决的问题。设置值最好不低于100，也不要太高。
  this.workerErrorTime = 500;
  this.errorBreakCount = 0;
  this.keepWorkersTimer = null;

  if (this.config.globalLog) {
    this.logger = new loggermsg(this.config);
    if (this.isMaster) {
      this.logger._checkBeforeInit();
      this.logger.init();
      this.setMsgEvent('_log', this.logger.msgEvent());
    }
  }

  if (this.config.showLoadInfo) {
    this.monitor = new monitor({
      config : this.config,
      secure : this.secure,
      workers : this.workers,
      rundata : this.rundata,
      workerCount : this.workerCount
    });

    if (this.isMaster) {
      this.setMsgEvent('_load', this.monitor.msgEvent());
    }
  }

  if (this.config.strong === true) {
    this.config.strong = {}
  }

  if (this.config.strong && this.config.strong.toString() === '[object Object]') {
    let no_exit = new strong(this.config.strong);
    no_exit.init();
  }

  this.helper = helper;
  this.ext = helper;

  this.context = (type = '') => {
    if (type === 1 || type === '1') return new context1();
    else if (type === 2 || type === '2') return new context2();
    return (this.config.http2 && !this.config.allowHTTP1) ? new context2() : new context1();
  };

  this.initMsgEvent();
  this.__init_flag__ = true;
};

/**
 * 提供一个守护进程消息事件监听机制，记录对应事件和函数，并进行回调处理，
 * 进而抽离出负载、日志等功能作为独立的模块。消息必须是JSON对象，type字段说明了事件类型。
 */
titbit.prototype.initMsgEvent = function () {
  this.setMsgEvent('_eaddr', (w, msg, handle = undefined) => {
      let errmsg = '\x1b[1;35m端口已被使用，请先停止正在运行的进程。\n在Linux/Unix上，可通过\n\t'
        +'ps -e -o user,pid,ppid,comm,args | grep node | grep -v grep\n'
        +' 或\n\tss -utlp\n查看相关进程。在Windows上通过任务管理器查找并结束相关进程。\x1b[0m';

      console.error(errmsg);
      sigExit();
  }, 'once');

  this.setMsgEvent('_route-table', (w, msg, handle = undefined) => {
      console.log(msg.route);
      console.log('PID:', process.pid, msg.listen, msg.protocol);
      console.log(_titbit_server_running);
  }, 'once');

  this.setMsgEvent('_server-error', (w, msg, handle=undefined) => {
      let hintText = '出现这种情况说明遇到了错误情况不得不终止服务，请根据错误提示信息排查解决。';
      console.error(`\x1b[1;35m${msg.message}\n${hintText}\x1b[0m`);
      sigExit();
  }, 'once');

};

/**
 * @param {string} - evt
 * @param {function} - callback
 * */
titbit.prototype.on = function(evt, callback) {
  if (evt === 'requestError') {
    if (typeof callback === 'function') {
      this.httpServ.requestError = callback;
    }
    return;
  }
  
  if (!this.eventTable[evt]) {
    this.eventTable[evt] = [ callback ];
  } else {
    this.eventTable[evt].push(callback);
  }
};

/**
 * @param {function} midcall 
 * @param {object} options 支持选项：group、name。 
 */
titbit.prototype.add = function (midcall, options = {}) {
  this.midware.add(midcall, options);
  return this;
};

/**
 * @param {function} midcall 
 * @param {object} options 支持选项：group、name、pre。
 */
titbit.prototype.use = function (midcall, options = {}) {
  if (typeof options === 'object' && options.pre !== undefined) {
    if (options.pre) {
      return this.pre(midcall, options);
    }
  }

  this.midware.addCache(midcall, options);
  return this;
};

/**
 * @param {function} midcall 
 * @param {object} options 支持选项：group、name。
 */
titbit.prototype.pre = function(midcall, options = {}) {
  this.__pre_mids__.push({
    callback: midcall,
    options: options
  });

  return this;
};

/**
 * 
 * @param {string|symbol} key
 * @param {string|object|array|boolean|number|function} serv 
 */
titbit.prototype.addService = function (key, serv) {
  if (typeof key === 'object') {
    for (let k in key) {
      this.service[k] = key[k];
    }
    return this;
  }

  this.service[key] = serv;
  return this;
};

titbit.prototype.getService = function (key) {
  return this.service[key] || null;
};

titbit.prototype.clearService = function () {
  for (let k in this.service) delete this.service[k];
};

/** 
 * 根据配置情况确定运行HTTP/1.1还是HTTP/2
 * @param {number} port 端口号
 * @param {string} host IP地址，可以是IPv4或IPv6
 * 0.0.0.0 对应使用IPv6则是::
*/
titbit.prototype.run = function(port = 2368, host = '0.0.0.0') {
  if (this.config.server.SNICallback && typeof this.config.server.SNICallback === 'function' && !this.config.https) {
    this.config.https = true;
  }

  this.router.argsRouteSort();

  this.rundata.host = (typeof port == 'number' ? host : '');
  this.rundata.port = port;

  //如果没有添加路由则添加默认路由
  if (this.router.count === 0) {
    this.router.get('/*', async c => {
      c.setHeader('content-type', 'text/html; charset=utf-8');
      c.res.body = _titbit_home_page;
    });
  }

  //如果发现更改了service指向，则让this.httpServ.service重新指向this.service。
  if (this.service !== this.httpServ.service) {
    this.httpServ.service = this.service;
  }

  this.midware.addFromCache();

  this.config.parseBody && this.add(this.bodyparser);

  this.add(this.httpServ);

  let m = null;
  while((m = this.__pre_mids__.pop()) !== undefined) {
    this.add(m.callback, m.options);
  }
  
  //必须放在最后，用于返回最终数据。
  this.midware.addFinal();

  if (this.config.useLimit) {
    let connlimit = new this.connfilter(this.limit, this.rundata);
    this.on('connection', connlimit.callback);
  } else {
    this.on('connection', (sock) => {
      this.rundata.conn++;
      sock.on('close', () => {
        this.rundata.conn--;
      });

    });
  }
  
  /**
   * 输出路由表，如果是启用了cluster，则通过发送消息的方式让master进程输出。
   * */
  if (this.config.debug) {
    if (typeof port === 'string' && port.indexOf('.sock') > 0) {
      host = '';
    }

    let is_https = this.config.https;

    let protocol = this.config.http2
                    ? ('http2' + (is_https ? '[https]' : ''))
                    : (is_https ? 'https' : 'http');

    if (cluster.isMaster) { 
      this.router.printTable();
      console.log(`PID: ${process.pid}, Listen ${host}:${port}, Protocol: ${protocol}`);
      console.log(_titbit_server_running);
    } else if (process.send && typeof process.send === 'function') {
      process.send({type:'_route-table', 
        route : this.router.getTable(),
        listen : `Listen: ${host}${host.length > 0 ? ':' : ''}${port}, `,
        protocol : `Protocol: ${protocol}`
      });
    }
  }

  this.server = this.httpServ.run(port, host);
  return this.server;
};
//run end

/**
 * @param {string} evt
 * @param {function} callback
 * @param {string} mode always | once，默认always。
 * */
titbit.prototype.setMsgEvent = function (evt, callback, mode = 'always') {
  if (cluster.isWorker) {
    return;
  }

  if (typeof callback !== 'function') {
    console.error('setMsgEvent: callback not a function');
    return false;
  }

  this.msgEvent[evt] = {
    count : 0,
    mode : mode,
    callback : callback
  };
  return true;
};

titbit.prototype.getMsgEvent = function (evt) {
  if (this.msgEvent[evt]) return this.msgEvent[evt];
  return null;
};

titbit.prototype.removeMsgEvent = function (evt) {
  if (this.msgEvent[evt]) {
    let e = this.msgEvent[evt];
    delete this.msgEvent[evt];
    return e;
  }

  return false;
};

/** 
 * worker用于快速发送消息给master进程。
 * @param {string} evtname 要发送消息的事件名称。
 * @param {string|object} msg 要发送的消息。
 * */
titbit.prototype.send = function (evtname, msg, handle = undefined) {
  if (!cluster.isWorker || !process.send || typeof process.send !== 'function') return;

  if (!msg) return;

  let typn = typeof msg;

  if (typn === 'string' || typn === 'number') msg = {msg: msg};

  msg.type = evtname;

  process.send(msg, handle);
};

titbit.prototype.workerMsg = function (callback) {
  if (cluster.isWorker && callback && typeof callback === 'function') {
    process.on('message', callback);
  }
};

titbit.prototype.daemonMessage = function () {
  if (cluster.isWorker) {
    return;
  }

  let self = this;
  for (let k in this.msgEvent) {
    this.msgEvent[k].count = 0;
  }

  cluster.on('message', (worker, msg, handle) => {
    try {
      if (typeof msg === 'object' && msg.type !== undefined) {
        if (self.msgEvent[msg.type] === undefined) {
          return;
        }
        let devt = self.msgEvent[msg.type];
        if (devt.mode === 'once' && devt.count > 0) {
          return;
        }

        if (devt.count < 30000000000) {
          devt.count += 1;
        }
        
        devt.callback(worker, msg, handle);
      }

    } catch (err) {
      self.config.debug && console.error(err);
    }
  });
};

titbit.prototype.autoWorker = function (max) {
  if (typeof max === 'number' && max > 0) {
    this.workerCount.max = max;
  } else {
    throw new Error('autoWorker参数必须是一个大于0的数字，表示最大允许创建多少个子进程处理请求。');
  }
};

/**
 * 调度类型，默认不做任何设置，采用Node.js cluster模块的默认设置。
 * @param {string} sch 
 */
titbit.prototype.sched = function (sch = '') {
  if (sch === 'rr') {
    cluster.schedulingPolicy = cluster.SCHED_RR;
  } else if (sch === 'none') {
    cluster.schedulingPolicy = cluster.SCHED_NONE;
  } else {
    return cluster.schedulingPolicy;
  }
};

titbit.prototype._checkDaemonArgs = function () {

  if (process.argv.indexOf('--daemon') > 0) {
  } else if (this.config.daemon) {
    let args = process.argv.slice(1);
    args.push('--daemon');

    const serv = spawn (process.argv[0], args, {
      detached: true,
      stdio: ['ignore', 1, 2]
    });

    serv.unref();
    process.exit(0);
  }

};

titbit.prototype.workerEventHandle = function () {
  cluster.on('listening', (worker, addr) => {
    this.workerCount.canAutoFork = true;
    this.workerCount.cur += 1;

    let onerr = err => {
      this.config.errorHandle(err, '--ERR-WORKER--');
    };

    worker.on('error', onerr);
    worker.process.on('error', onerr);

    this.workers[ worker.id ] = {
      startTime : Date.now(),
      address : addr,
      id : worker.id,
      pid : worker.process.pid,
      conn: 0,
      mem: {
        rss : 0,
        heapTotal: 0,
        heapUsed: 0,
        external: 0,
        total: 0
      },
      cpu: {user:0, system:0},
      cputm : 1000
    };
    
  });

  let exitTip = () => {
    setTimeout(() => {
      let errmsg = `worker进程在限制的最短时间内(${this.workerErrorTime}ms)退出，请检测代码是否存在错误。`;
      console.error(errmsg);
      process.kill(0, 'SIGTERM');
    }, 15);
  };

  cluster.on('disconnect', worker => {
    worker.kill('SIGTERM');
  });

  cluster.on('exit', (worker, code, signal) => {
    this.workerCount.canAutoFork = true;
    this.workerCount.cur -= 1;
    let w = this.workers[worker.id];
    if (w) {
      let tm = Date.now();
      if (tm - w.startTime <= this.workerErrorTime && this.errorBreakCount <= 0 && code) {
        exitTip();
      } else {
        delete this.workers[w.id];
      }
      this.errorBreakCount = 1;
    } else {
      exitTip();
    }
  });

};

titbit.prototype.keepWorkers = function () {
  let keepworkers = () => {
    let num_dis = this.workerCount.total - Object.keys(cluster.workers).length;

    if (num_dis <= 0) return;

    for (let i = 0; i < num_dis; i++) {
      cluster.fork();
    }
  };

  process.on('SIGCHLD', (sig) => {
    if (this.workerCount.cur >= this.workerCount.total) {
      return;
    }

    cluster.fork();

    //测试kill多个子进程会有信号丢失的情况，设置定时器做最后的检测。
    if (this.keepWorkersTimer === null) {
      this.keepWorkersTimer = setTimeout (() => {
        this.keepWorkersTimer = null;
        keepworkers();
      }, 2000);
    }

  });

  if (process.platform === 'win32') {
    setInterval(() => {
      keepworkers();
    }, 1024);
  }

};

/**
 * 这个函数是可以用于运维部署，此函数默认会根据CPU核数创建对应的子进程处理请求。
 * @param {number} port 端口号
 * @param {string} IP地址，IPv4或IPv6，如果检测为数字，则会把数字赋值给num。
 * @param {number} num，要创建的子进程数量，0表示自动，这时候根据CPU核心数量创建。
*/
titbit.prototype.daemon = function(port = 2368, host = '0.0.0.0', num = 0) {
  if (typeof host === 'number') {
    num = host;
    host = '0.0.0.0';
  }

  //确保自动创建的worker在终止时不会误认为是系统错误。
  setTimeout(() => {
    this.errorBreakCount += 1;
  }, this.workerErrorTime + 120);

  this._checkDaemonArgs();
  
  if (cluster.isMaster) {
    let osCPUS = os.cpus().length;
    if (num > (osCPUS*2) ) {
      num = 0;
    }

    if (num <= 0) {
      num = osCPUS;
      //如果CPU核心数超过2个，则使用核心数-1的子进程处理请求。
      if (num > 2) {
        num -= 1;
      }
    }

    this.workerCount.total = num;

    this.rundata.port = port;

    this.rundata.host = (typeof port === 'number' ? host : '');

    if (typeof this.config.loadInfoFile !== 'string') {
      this.config.loadInfoFile = '';
    }

    if (typeof this.config.pidFile === 'string' && this.config.pidFile.length > 0) {
      fs.writeFile(this.config.pidFile, `${process.pid}`, (err) => {
        err && console.error(err);
      });
    }

    this.daemonMessage();

    //clear router and service
    this.clearService();
    this.router.clear();
    this.midware.midGroup = {};

    this.workerEventHandle();

    this.keepWorkers();

    for (let i = 0; i < num; i++) {
      cluster.fork();
    }

    return this;

  } else if (cluster.isWorker) {

    if (this.config.showLoadInfo) {
      this.monitor.workerSend();
    }

    this.server = this.run(port, host);
    return this.server;
  }
};

Object.defineProperty(titbit.prototype, 'isMaster', {
  get: () => {
    return cluster.isPrimary || cluster.isMaster;
  }
});

Object.defineProperty(titbit.prototype, 'isPrimary', {
  get: () => {
    return cluster.isPrimary || cluster.isMaster;
  }
});

Object.defineProperty(titbit.prototype, 'isWorker', {
  get: () => {
    return cluster.isWorker;
  }
});

module.exports = titbit;
