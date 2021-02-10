'use strict';

const fs = require('fs');
const cluster = require('cluster');
const os = require('os');
const {spawn} = require('child_process');

const bodyParser = require('./bodyparser');
const middleware1 = require('./middleware1');
const middleware2 = require('./middleware2');
const router = require('./router');
const connfilter = require('./connfilter');
const http1 = require('./http1');
const httpt = require('./http2');
const loggermsg = require('./loggermsg');
const monitor = require('./monitor');
const strong = require('./strong');

/**
 * @param {object} options 初始化选项，参考值如下：
 * - ignoreSlash，忽略末尾的/，默认为true
 * - debug 调试模式，默认为false
 * - maxConn 最大连接数，使用daemon接口，则每个进程都可以最多处理maxConn限制数量，0表示不限制。
 * - deny  {Array} IP字符串数组，表示要拒绝访问的IP。
 * - maxIPRequest {number} 单个IP单元时间内最大访问次数。
 * - unitTime {number} 单元时间，配合maxIPRequest，默认为1表示1秒钟清空一次。
 * - maxIPCache {number} 最大IP缓存个数，配合限制IP访问次数使用，默认为15000。
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
 * - server {object}  服务器选项，参考http2.createSecureServer
 * - notFound {string} 404页面数据。
 * - parseBody {bool} 自动解析上传文件数据，默认为true。
 * - http2 {bool} 默认false。
 * - loadInfoFile {string} daemon为true，负载信息会输出到设置的文件，默认为空
 * - memFactor {number} 控制内存最大使用量的系数，范围从 -0.48 ～ 0.36，会使用基本系数加上此值并乘以内存总量。默认值0.28。
 *      RSS基本系数是0.52。不要设置的太低，提供比较低的值是为了测试使用。
 * - maxUrlLength 最大URL长度，包括path和querystring
 * - maxpool 请求上下文的最大缓存池数量。
 * - monitorTimeSlice 子进程获取系统占用资源的定时器时间片，毫秒值，默认为640。
 * - maxQuery 最大允许的querystring的参数，默认为12。
 * - fastParseQuery 快速解析querystring，默认为false，会把多个重名的解析为数组，true表示快速解析，不允许重复的名字，否则仅第一个生效。
 * - maxFormLength 在multipart/form-data类型提交数据时，单个form项的最大值，默认为1000000字节。
 */

var titbit = function (options = {}) {
  if (! (this instanceof titbit) ) {
    return new titbit(options);
  }

  this.config = {
    //此配置表示POST/PUT提交表单的最大字节数，也是上传文件的最大限制，
    maxBody   : 8000000,
    maxFiles      : 12,
    daemon        : false, //开启守护进程

    //开启守护进程模式后，如果设置路径不为空字符串，则会把pid写入到此文件，可用于服务管理。
    pidFile       : '',
    logFile       : '',
    errorLogFile  : '',
    
    // stdio or file
    logType     : 'stdio',

    //开启HTTPS
    https       : false,

    http2   : false,

    //HTTPS密钥和证书的路径
    key   : '',
    cert  : '',

    //服务器选项，参考http2.createSecureServer、tls.createServer
    server : {
      handshakeTimeout: 5000, //TLS握手连接（HANDSHAKE）超时
    },
    //设置服务器超时，毫秒单位。
    timeout   : 8000,

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
    monitorTimeSlice: 640,

    //querystring最大个数
    maxQuery: 12,

    //快速解析querystring，多个同名的值会仅设置第一个，不会解析成数组。
    fastParseQuery: false,

    strong : false,

    //在multipart格式中，限制单个表单项的最大长度。
    maxFormLength: 1000000,
  };

  this.whoami = 'titbit';

  this.limit = {
    maxConn       : 1024,
    deny          : [],
    //每秒单个IP可以进行请求次数的上限，0表示不限制。
    maxIPRequest  : 0, 
    unitTime      : 1,
    maxIPCache    : 58000,
    allow         : [],
  };

  if (typeof options !== 'object') { options = {}; }

  for(let k in options) {
    switch (k) {
      case 'maxConn':
        if (typeof options.maxConn=='number' 
          && parseInt(options.maxConn) >= 0)
        {
          this.limit.maxConn = options.maxConn;
        } break;
      case 'deny':
        this.limit.deny = options.deny; break;
      
      case 'maxIPRequest':
        if (parseInt(options.maxIPRequest) >= 0) {
          this.limit.maxIPRequest = parseInt(options.maxIPRequest);
        } break;
      case 'unitTime':
        if (typeof options.unitTime === 'number' && options.unitTime >= 1) {
          this.limit.unitTime = parseInt(options.unitTime * 1000);
        } break;

      case 'maxIPCache':
        if (parseInt(options.maxIPCache) >= 1024) {
          this.limit.maxIPCache = parseInt(options.maxIPCache);
        } break;
      
      case 'allow':
        this.limit.allow = options.allow; break;

      case 'logHandle':
        if (typeof options.logHandle === 'function') {
          this.config.logHandle = options.logHandle;
        }
        break;

      case 'memFactor':
        if (typeof options.memFactor === 'number') {
          let factor = parseFloat(options.memFactor);
          if ( factor >= -0.48 && factor <= 0.36 ) {
            this.config.memFactor = factor;
          }
        }
        break;

      case 'maxUrlLength':
        if (typeof options[k] === 'number' && options[k] > 0 && options[k] <= 4096) {
          this.config.maxUrlLength = options[k];
        }
        break;
      
      case 'maxpool':
        if (typeof options[k] === 'number' && options[k] > 1 && options[k] <= 20000) {
          this.config.maxpool = options[k];
        }
        break;

      case 'timeout':
        if (typeof options[k] === 'number' && options[k] >= 0) {
          this.config.timeout = options[k];
        }
        break;

      case 'monitorTimeSlice':
        if (typeof options[k] === 'number' && options[k] >= 5 && options[k] <= 10000) {
          this.config.monitorTimeSlice = options[k];
        }
        break;

      case 'maxQuery':
        if (typeof options[k] === 'number') {
          this.config.maxQuery = options[k];
        }
        break;

      case 'maxFormLength':
      case 'showLoadInfo':
      case 'logType':
      case 'daemon':
      case 'maxFiles':
      case 'maxBody':
      case 'notFound':
      case 'badRequest':
      case 'debug':
      case 'globalLog':
      case 'logFile':
      case 'errorLogFile':
      case 'ignoreSlash':
      case 'parseBody':
      case 'useLimit':
      case 'http2':
      case 'https':
      case 'loadInfoFile':
      case 'pidFile':
      case 'loadInfoType':
      case 'autoDecodeQuery':
      case 'realIP':
      case 'fastParseQuery':
      case 'strong':
        this.config[k] = options[k]; break;
      default:;
    }
  }

  if (options.server !== undefined && typeof options.server === 'object') {
    for(let x in options.server) {
      this.config.server[x] = options.server[x];
    }
  }

  if (options.key && options.cert) {
    this.config.cert = options.cert;
    this.config.key = options.key;
    this.config.https = true;
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
      external : 0
    },
    cpus : 0
  };
  
  /*
   * 用于限制在daemon模式，子进程如果真的超出最大内存限制则会重启子进程。
   * 因为RSS包括了Buffer的占用，所以maxrss包括Buffer默认的最大限制。
   * 在Node 12+版本测试默认heaptotal可以稍微超过2G。
   * */
  this.totalmem = os.totalmem();
  this.topmem = 2147483648;
  if (this.topmem > this.totalmem) {
    this.topmem = parseInt(this.totalmem * 0.85);
  }

  this.secure = {
    //minmem : 50000 超过最大内存限制则只有在连接数为0时才会重启进程
    //而超过diemem则直接kill 这限制的是对heap的使用
    //parseInt(this.topmem * (0.5 + this.config.memFactor) )
    diemem : this.topmem,

    //parseInt(this.topmem * (0.5 + this.config.memFactor) )
    maxmem : parseInt(this.topmem * 0.9),

    maxrss : parseInt(this.totalmem * (0.52 + this.config.memFactor) )

  };
  
  //运行时服务，需要在全局添加一些服务插件可以放在此处。
  //如果需要把app相关配置信息，router等传递给请求上下文可以放在此处。
  this.service = {};

  this.bodyparser = new bodyParser({
    maxFiles: this.config.maxFiles,
    maxFormLength: this.config.maxFormLength
  });

  this.router = new router(this.config);

  //连接过滤和计数以及超时控制。
  this.connfilter = connfilter;

  if (this.config.http2) {
    this.midware = new middleware2(options);
  } else {
    this.midware = new middleware1(options);
  }

  let opts = {
    config: this.config,
    events: this.eventTable,
    router: this.router,
    midware: this.midware,
    service: this.service
  };

  if (this.config.http2) {
    this.httpServ = new httpt(opts);
  } else {
    this.httpServ = new http1(opts);
  }

  let mth = '';
  for(let k in this.router.apiTable) {
    mth = k.toLowerCase();
    this[mth] = this.router[mth].bind(this.router);
  }

  this.map = this.router.map.bind(this.router);
  this.any = this.router.any.bind(this.router);

  this.logger = null;
  this.monitor = null;
  this.init();
};

titbit.prototype.init = function () {
  if (this.config.globalLog) {
    this.logger = new loggermsg(this.config);
    if (cluster.isMaster) {
      this.logger.init();
      this.setMsgEvent('_log', this.logger.msgEvent());
      this.logger.watch();
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

    if (cluster.isMaster) {
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
  
};

/**
 * 绑定事件的暂存结构和方法
 */
titbit.prototype.eventTable = {};
titbit.prototype.on = function(evt, callback) {
  if (evt === 'requestError') {
    if (typeof callback === 'function') {
      this.httpServ.requestError = callback;
    }
  }
  this.eventTable[evt] = callback;
};

/**
 * @param {function} midcall 
 * @param {object} options 
 */
titbit.prototype.add = function (midcall, options = {}) {
  this.midware.add(midcall, options);
  return this;
};

/**
 * @param {function} midcall 
 * @param {object} options 
 */
titbit.prototype.use = function (midcall, options = {}) {
  if (typeof options === 'object' && options.pre !== undefined) {
    if (options.pre) {
      delete options.pre;
      return this.pre(midcall, options);
    }
  }
  this.midware.addCache(midcall, options);
  return this;
};

titbit.prototype.hooks = [];

titbit.prototype.pre = function(hookcall, options = {}) {

  this.hooks.push({
    callback: hookcall,
    options: options
  });

  return this;
};

/**
 * 
 * @param {string} key 
 * @param {string|object|array|function} serv 
 */
titbit.prototype.addService = function (key, serv) {
  this.service[key] = serv;
};

/** 
 * 根据配置情况确定运行HTTP/1.1还是HTTP/2
 * @param {number} port 端口号
 * @param {string} host IP地址，可以是IPv4或IPv6
 * 0.0.0.0 对应使用IPv6则是::
*/
titbit.prototype.run = function(port = 2022, host = '0.0.0.0') {

  this.rundata.host = (typeof port == 'number' ? host : '');
  this.rundata.port = port;

  //如果没有添加路由则添加默认路由
  if (this.router.count === 0) {
    this.router.get('/*', async c => {
      c.setHeader('content-type', 'text/html; charset=utf-8');
      c.res.body = `<!DOCTYPE html><html>
        <head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
        <body>
          <div style="width:86%;margin:auto;margin-top:1rem;color:#4a4a4f;">
            <h2>titbit</h2><h3>success</h3></div>
        </body>
      </html>`;
    });
  }

  //如果发现更改了service指向，则让this.httpServ.service重新指向this.service。
  if (this.service !== this.httpServ.service) {
    //console.log('!=')
    this.httpServ.service = this.service;
  }

  this.midware.addFromCache();

  if (this.config.parseBody) {
    this.add(this.bodyparser.middleware());
  }

  this.add(this.httpServ.middleware());

  //add hooks
  let m = null;
  while((m = this.hooks.pop()) !== undefined) {
    this.add(m.callback, m.options);
  }
  
  //必须放在最后，用于返回最终数据。
  this.midware.addFinal();

  if (this.config.useLimit) {
    let connlimit = new this.connfilter(this.limit, this.rundata);
    this.on('connection', connlimit.callback);
  } else {
    this.on('connection', (sock) => {

      this.rundata.conn += 1;

      sock.on('close', () => {
        this.rundata.conn -= 1;
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
    let protocol = this.config.http2 ? 'http2' : (this.config.https ? 'https' : 'http');
    if (cluster.isMaster) { 
      this.router.printTable();
      console.log(`PID: ${process.pid}, listen ${host}:${port}, protocol: ${protocol}\n`);
    } else {
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
 * 提供一个守护进程消息事件监听机制，记录对应事件和函数，并进行回调处理，
 * 进而抽离出负载、日志等功能作为独立的模块。消息必须是JSON对象，type字段说明了事件类型。
 */
titbit.prototype.daeMsgEvent = {
  '_eaddr' : {
    count : 0,
    overflow : 0,
    mode : 'once',
    callback : (w, msg, handle = undefined) => {
      let errmsg = '端口已被使用，请先停止正在运行的进程。\n(在Linux/Unix上，可通过'
        +'ps -e -o user,pid,ppid,comm,args | grep node | grep -v node'
        +' 或 ss -utlp 查看相关进程，在Windows上通过任务管理器查找并结束相关进程)';

      console.error(errmsg);
      process.kill(0, 'SIGTERM');
    }
  },

  '_route-table' : {
    count : 0,
    overflow : 0,
    mode : 'once',
    callback : (w, msg, handle = undefined) => {
      console.log(msg.route);
      console.log('PID:', process.pid, msg.listen, msg.protocol);
    }
  }
};

titbit.prototype.setMsgEvent = function (evt, callback, mode = 'always') {
  if (cluster.isWorker) {
    return;
  }
  if (typeof callback !== 'function') {
    console.error('callback not a function');
    return false;
  }
  this.daeMsgEvent[evt] = {
    count : 0,
    mode : mode,
    overflow : 0,
    callback : callback
  };
  return true;
};

titbit.prototype.daemonMessage = function () {
  if (cluster.isWorker) {
    return;
  }

  var self = this;
  for (let k in this.daeMsgEvent) {
    this.daeMsgEvent[k].count = 0;
    this.daeMsgEvent[k].overflow = 0;
  }

  cluster.on('message', (worker, msg, handle) => {
    try {
      if (typeof msg === 'object' && msg.type !== undefined) {
        if (self.daeMsgEvent[msg.type] === undefined) {
          return;
        }
        let devt = self.daeMsgEvent[msg.type];
        if (devt.mode === 'once' && devt.count > 0) {
          return;
        }
        devt.count += 1;
        if (devt.count <= 0) {
          devt.count = 0;
          devt.overflow += 1;
        }
        
        devt.callback(worker, msg, handle);
      }

    } catch (err) {
      if (self.config.debug)
        console.error(err);
    }
  });
};

//workers记录了在cluster模式，每个worker的启动时间，这可以在disconnect事件中检测。
titbit.prototype.workers = {};

//如果worker运行在很短时间内退出说明可能存在问题，这时候则终止master进程并立即给出错误信息。
//注意这是在运行开始就要判断并解决的问题。设置值最好不低于200，也不要高于2000。
titbit.prototype.workerErrorTime = 976;
titbit.prototype.errorBreakCount = 0;

titbit.prototype.workerCount = {
  total : 0,
  cur : 0,
  max : 0
};

titbit.prototype.keepWorkersTimer = null;

titbit.prototype.autoWorker = function (max) {
  if (typeof max === 'number' && max > 0) {
    this.workerCount.max = max;
  } else {
    throw new Error('autoWorker参数必须是一个大于0的数字，表示最大允许创建多少个子进程处理请求。');
  }
};

/**
 * 调度类型，默认不做任何设置，采用Node.js cluster模块的默认设置。
 * 
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
    var args = process.argv.slice(1);
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
    this.workerCount.cur += 1;

    worker.on('error', err => {
      if (this.config.debug) {
        console.error('--DEBUG-WORKER-ERR:',err);
      }
    });

    worker.process.on('error', err => {
      if (this.config.debug) {
        console.error('--DEBUG-WORKER-ERR:',err);
      }
    });

    this.workers[ worker.id ] = {
      startTime : Date.now(),
      address : addr,
      id : worker.id,
      pid : worker.process.pid,
      conn: 0,
      mem: {
        rss : 0,
        heapTotal: 0,
        heapUsed: 0
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

  cluster.on('exit', (worker, code, signal) => {
    this.workerCount.cur -= 1;
    let w = this.workers[worker.id];
    if (w) {
      let tm = Date.now();
      if (tm - w.startTime <= this.workerErrorTime && this.errorBreakCount <= 0) {
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

    for(let i = 0; i < num_dis; i++) {
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

titbit.prototype.server = {};

/**
 * 这个函数是可以用于运维部署，此函数默认会根据CPU核数创建对应的子进程处理请求。
 * @param {number} port 端口号
 * @param {string} IP地址，IPv4或IPv6，如果检测为数字，则会把数字赋值给num。
 * @param {number} num，要创建的子进程数量，0表示自动，这时候根据CPU核心数量创建。
*/
titbit.prototype.daemon = function(port = 2020, host = '0.0.0.0', num = 0) {
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
        if (err) { console.error(err); }
      });
    }

    this.daemonMessage();

    //clear router and service
    this.service = {};
    this.router.clear();
    this.midware.midGroup = {};

    this.workerEventHandle();

    this.keepWorkers();

    for(let i = 0; i < num; i++) {
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

module.exports = titbit;
