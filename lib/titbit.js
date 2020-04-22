/**
  titbit Copyright (C) 2019.08 BraveWang
  This program is free software; you can redistribute it and/or modify
  it under the terms of the GNU General Public License as published by
  the Free Software Foundation; either version 3 of the License , or
  (at your option) any later version.
*/
'use strict';

const fs = require('fs');
const cluster = require('cluster');
const os = require('os');
const {spawn} = require('child_process');

const bodyParser = require('./bodyparser');
const middleware1 = require('./middleware1');
const middleware2 = require('./middleware2');
const router = require('./router');
const helper = require('./helper');
const connfilter = require('./connfilter');
const http1 = require('./http1');
const httpt = require('./http2');

/**
 * @param {object} options 初始化选项，参考值如下：
 * - ignoreSlash，忽略末尾的/，默认为true
 * - debug 调试模式，默认为false
 * - maxConn 最大连接数，使用daemon接口，则每个进程都可以最多处理maxConn限制数量，0表示不限制。
 * - deny  {Array} IP字符串数组，表示要拒绝访问的IP。
 * - maxIPRequest {number} 单个IP单元时间内最大访问次数。
 * - peerTime {number} 单元时间，配合maxIPRequest，默认为1表示1秒钟清空一次。
 * - maxIPCache {number} 最大IP缓存个数，配合限制IP访问次数使用，默认为15000。
 * - allow   {Array} 限制IP请求次数的白名单。
 * - useLimit {bool} 启用连接限制，用于限制请求的选项需要启用此选项才会生效。
 * - timeout {number} 超时。
 * - cert {string} 启用HTTPS要使用的证书文件路径。
 * - key  {string} 启用HTTPS的密钥文件路径。
 * - globalLog {bool} 启用全局日志。
 * - bodyMaxSize {number} 表示POST/PUT提交表单的最大字节数，包括上传文件。
 * - maxFiles {number} 最大上传文件数量，超过则不处理。
 * - daemon {bool} 启用守护进程模式。
 * - pidFile {string} 保存Master进程PID的文件路径。
 * - logFile {string} 日志文件。
 * - errorLogFile {string} 错误日志文件。
 * - logType {string} 日志类型，支持stdio、file、ignore
 * - server {object}  服务器选项，参考http2.createSecureServer
 * - pageNotFound {string} 404页面数据。
 * - parseBody {bool} 自动解析上传文件数据，默认为true。
 * - http2 {bool} 默认false。
 * - loadInfoFile {string} daemon为true，负载信息会输出到设置的文件，默认为./loadinfo.log
 */
var titbit = function (options = {}) {
  if (! (this instanceof titbit) ) {return new titbit(options);}
  this.config = {
    //此配置表示POST/PUT提交表单的最大字节数，也是上传文件的最大限制，
    bodyMaxSize   : 8000000,
    maxFiles      : 15,
    daemon        : false, //开启守护进程
    /* cors      : null,
    optionsReturn   : true, */
    /*
      开启守护进程模式后，如果设置路径不为空字符串，则会把pid写入到此文件，可用于服务管理。
    */
    pidFile       : '',
    logFile       : './access.log',
    errorLogFile  : './error.log',
    /*
      日志类型：stdio   标准输入输出，可用于调试
          ignore  没有
          file  文件，此时会使用log_file以及error_log_file的路径
    */
    logType     : 'ignore',

    //开启HTTPS
    https       : false,

    http2   : false,

    //HTTPS密钥和证书的路径
    key   : '',
    cert  : '',

    //服务器选项，参考http2.createSecureServer
    server : {
      peerMaxConcurrentStreams : 100,
      handshakeTimeout: 4200, //TLS握手连接（HANDSHAKE）超时
      //sessionTimeout: 350,
    },
    //设置服务器超时，毫秒单位，在具体的请求中，可以通过stream设置具体请求的超时时间。
    timeout   : 16000,
    debug     : false,
    pageNotFound  : 'page not found',
    //展示负载信息，必须使用daemon接口
    showLoadInfo  : false,
    loadInfoType  : 'tableText', // tableText | json

    ignoreSlash: true,
    parseBody: true,

    useLimit: false,
    globalLog: false, //启用全局日志
    loadInfoFile: '',
  };

  this.limit = {
    maxConn       : 1024, //限制最大连接数，如果设置为0表示不限制
    deny          : [], //拒绝请求的IP。
    maxIPRequest  : 0, //每秒单个IP可以进行请求次数的上限，0表示不限制。
    peerTime      : 1, //IP访问次数限制的时间单元，1表示每隔1秒钟检测一次。
    maxIPCache    : 50000, //存储IP最大个数，是req_ip_table的上限，过高于性能有损。
    allow         : [], //限制IP请求次数的白名单。
  };

  if (typeof options !== 'object') { options = {}; }
  for(var k in options) {
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
      case 'peerTime':
        if (parseInt(options.peerTime) > 0) {
          this.limit.peerTime = parseInt(options.peerTime);
        } break;
      case 'maxIPCache':
        if (parseInt(options.maxIPCache) >= 1024) {
          this.limit.maxIPCache = parseInt(options.maxIPCache);
        } break;
      
      case 'allow':
        this.limit.allow = options.allow; break;

      case 'showLoadInfo':
      case 'logType':
      case 'daemon':
      case 'maxFiles':
      case 'bodyMaxSize':
      case 'pageNotFound':
      case 'debug':
      case 'timeout':
      case 'globalLog':
      case 'logFile':
      case 'errorLogFile':
      case 'ignoreSlash':
      case 'parseBody':
      case 'useLimit':
      case 'http2':
      case 'loadInfoFile':
      case 'pidFile':
      case 'loadInfoType':
        this.config[k] = options[k]; break;
      default:;
    }
  }

  if (!this.config.http2) {
    this.config.server = {};
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

  /**
   * 记录当前的运行情况
   * conn 目前废弃不用
   */
  this.rundata = {
    conn : 0,
    platform : os.platform()
  };

  this.helper = helper;
  this.bodyparser = new bodyParser({maxFiles: this.config.maxFiles});
  this.router = new router(options);

  if (this.config.http2) {
    this.midware = new middleware2(options);
  } else {
    this.midware = new middleware1(options);
  }

  //必须要封装起来，使用this.middleware调用，否则会导致this指向错误。
  this.add = function (midcall, options = {}) {
    return this.midware.add(midcall, this.router.group(), options);
  };

  this.use = function (midcall, options = {}) {
    return this.midware.addCache(midcall, options);
  };

  //运行时服务，需要在全局添加一些服务插件可以放在此处。
  //如果需要把app相关配置信息，router等传递给请求上下文可以放在此处。
  this.service = {};

  this.httpServ = null;
  var opts = {
    config: this.config,
    events: this.eventTable,
    router: this.router,
    midware: this.midware,
    service: this.service,
  };
  if (this.config.http2) {
    this.httpServ = new httpt(opts);
  } else {
    this.httpServ = new http1(opts);
  }

  let m = '';
  for(let k in this.router.apiTable) {
    m = k.toLowerCase();
    this[m] = this.router[m].bind(this.router);
  }

};

/**
 * 绑定事件的暂存结构和方法
 */
titbit.prototype.eventTable = {};
titbit.prototype.on = function(evt, callback) {
  this.eventTable[evt] = callback;
};

titbit.prototype.hooks = [];
titbit.prototype.addHook = function(hookcall, options = {}) {
  if (typeof hookcall === 'function' && hookcall.constructor.name === 'AsyncFunction')
  {
    this.hooks.push({
      callback: hookcall,
      options: options
    });
  }
};

/** 
 * 根据配置情况确定运行HTTP/1.1还是HTTP/2
 * @param {number} port 端口号
 * @param {string} host IP地址，可以是IPv4或IPv6
 * 0.0.0.0 对应使用IPv6则是::
*/
titbit.prototype.run = function(port = 2020, host = '0.0.0.0') {
  this.midware.addFromCache(this.router.group());

  if (this.config.parseBody) {
    this.add(this.bodyparser.middleware());
  }

  this.add(this.httpServ.requestMidware);

  //add hooks
  for(let i=this.hooks.length-1; i>=0; i--) {
    this.add(this.hooks[i].callback, this.hooks[i].options);
  }
  
  this.midware.addFinal(this.router.group()); //必须放在最后，用于返回最终数据。

  if (this.config.useLimit) {
    var connlimit = new connfilter(this.limit, this.rundata);
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
   * 输出路由表，如果是启用了cluster，也就是调用了daemon接口，
   * 则会通过发送消息的方式让master进程输出。
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
      process.send({type:'route-table', 
        route : this.router.getRouteTable(),
        listen : `Listen: ${host}${host.length > 0 ? ':' : ''}${port}, `,
        protocol : `Protocol: ${protocol}`
      });
    }
  }

  return this.httpServ.run(port, host);
};

/**保存进程负载情况 */
titbit.prototype.loadInfo = [];

titbit.prototype.fmtLoadInfo = function (type = 'tableText') {
  let oavg = os.loadavg();

  if (type == 'tableText') {
    let oscpu = `  CPU Loadavg  1m: ${oavg[0].toFixed(2)}  `
                + `5m: ${oavg[1].toFixed(2)}  15m: ${oavg[2].toFixed(2)}\n`;

    let cols = '  PID       CPU       MEM, HEAP, HEAPUSED   CONN\n';
    let tmp = '';
    let t = '';

    for (let i=0; i < this.loadInfo.length; i++) {
      tmp = (this.loadInfo[i].pid).toString() + '      ';
      tmp = tmp.substring(0, 10);

      t = this.loadInfo[i].cpu.user + this.loadInfo[i].cpu.system;
      t = (t/102400).toFixed(2);
      tmp += t + '%     ';
      tmp = tmp.substring(0, 20);

      tmp += (this.loadInfo[i].mem.rss / (1024*1024)).toFixed(1) + ', ';
      tmp += (this.loadInfo[i].mem.heapTotal / (1024*1024)).toFixed(1) + ',';
      tmp += (this.loadInfo[i].mem.heapUsed / (1024*1024)).toFixed(1);
      tmp += 'M         ';
      tmp = tmp.substring(0, 42);

      tmp += this.loadInfo[i].conn.toString();
      cols += `  ${tmp}\n`;
    }
    cols += `  Master PID: ${process.pid}\n`;
    cols += `  Listen ${this.loadInfo[0].host}:${this.loadInfo[0].port}\n`;

    return `${oscpu}${cols}`;
  }

  if (type == 'json') {
    let loadjson = {
      masterPid : process.pid,
      listen : `${this.loadInfo[0].host}:${this.loadInfo[0].port}`,
      CPULoadavg : {
        '1m' : `${oavg[0].toFixed(2)}`,
        '5m' : `${oavg[1].toFixed(2)}`,
        '15m' : `${oavg[2].toFixed(2)}`
      },
      workers : []
    };
    for (let i=0; i < this.loadInfo.length; i++) {
      loadjson.workers.push({
        pid : this.loadInfo[i].pid,
        cpu : `${((this.loadInfo[i].cpu.user + this.loadInfo[i].cpu.system)/102400).toFixed(2)}%`,
        mem : {
          rss : (this.loadInfo[i].mem.rss / (1024*1024)).toFixed(1),
          heap : (this.loadInfo[i].mem.heapTotal / (1024*1024)).toFixed(1),
          heapused : (this.loadInfo[i].mem.heapUsed / (1024*1024)).toFixed(1)
        },
        conn : this.loadInfo[i].conn
      });
    }
    return JSON.stringify(loadjson);
  }
  
  return '';
};

//保存负载信息文本
//titbit.prototype.loadInfoText = '';

/**
 * 通过loadInfo保存的数据计算并显示进程和系统的负载情况。
 * 这个函数只能在Master进程中调用。
 * @param {object} w 子进程发送的数据。
 */
titbit.prototype.showLoadInfo = function (w) {

  var total = Object.keys(cluster.workers).length;

  if (this.loadInfo.length >= total) {
    this.loadInfo.sort((a, b) => {
      if (a.pid < b.pid) {
        return -1;
      } else if (a.pid > b.pid) {
        return 1;
      }
      return 0;
    });
    if (!this.config.daemon && !this.config.loadInfoFile) { console.clear(); }

    let loadText = this.fmtLoadInfo( this.config.loadInfoType );

    /*
    if (this.config.loadInfoFile == '--msg') {
      this.loadInfoText = loadText;
      return;
    }*/

    if (this.config.daemon || this.config.loadInfoFile.length > 0) {
      fs.writeFile(this.config.loadInfoFile, loadText, (err) => {
        if (err && this.config.debug)
          console.error(err.message);
      });
    } else {
      console.log(loadText);
    }
    this.loadInfo = [w];
  } else {
    this.loadInfo.push(w);
  }
};

/**
 * Master进程调用的函数，用于监听消息事件。
 */
titbit.prototype.daemonMessage = function () {
  var the = this;
  var logger = null;
  if (this.config.logType == 'file') {
    let out_log;
    let err_log;
    try {
      //fs.accessSync(this.config.logFile, fs.constants.F_OK);
      out_log = fs.createWriteStream(this.config.logFile, {flags: 'a+'});
    } catch (err) { console.error(err); }

    try {
      //fs.accessSync(this.config.errorLogFile, fs.constants.F_OK);
      err_log = fs.createWriteStream(this.config.errorLogFile, {flags: 'a+'});
    } catch (err){ console.error(err); }

    logger = new console.Console({stdout:out_log, stderr: err_log});
  } else if (this.config.logType == 'stdio') {
    let opts = {stdout:process.stdout, stderr: process.stderr};
    logger = new console.Console(opts);
  }
  
  let routeCount = 0;
  cluster.on('message', (worker, msg, handle) => {
    try {
      switch(msg.type) {
        case 'log':
          if (!logger) break;
          msg.success 
          ? logger.log(JSON.stringify(msg)) 
          : logger.error(JSON.stringify(msg));
          break;
       case 'route-table':
          if (routeCount == 0) {
            routeCount += 1;
            console.log(msg.route);
            console.log('PID:', process.pid, msg.listen, msg.protocol);
          }break;

        case 'load':
          the.showLoadInfo(msg); break;

        /*
        case 'loadmsg':
          worker.send(the.loadInfoText); break;
        */

        case 'eaddr':
          console.log('端口已被使用，请先停止正在运行的进程。\n'
              +'(在Linux/Unix上，可通过ps -e -o user,pid,ppid,comm | grep node'
              +' 或 ss -utlp 查看相关进程)'
            );
          process.kill(0, 'SIGABRT');
          //process.exit(1);

        default:;
      }
    } catch (err) { if (the.config.debug) {console.error(err);} }
  });
};

/*
 * workers记录了在cluster模式，每个worker的启动时间，
 * 这可以在disconnect事件中检测是否是
 * */
titbit.prototype.workers = {};

//如果worker运行在workerErrorTime时间内退出说明可能存在问题
//这时候则终止master进程并立即给出错误信息。
//注意这是在运行开始就要判断并解决的问题。
//设置值最好不低于200，也不要高于3000。
titbit.prototype.workerErrorTime = 990;

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

  var the = this;

  if (process.argv.indexOf('--daemon--') > 0) {
  } else if (this.config.daemon) {
    var args = process.argv.slice(1);
    args.push('--daemon--');
    const serv = spawn (
        process.argv[0], args,
        {detached : true, stdio : ['ignore', 1, 2]}
      );
    serv.unref();
    process.exit(0);
  }
  let handle_sig = (sig) => {
    console.log('signal', sig);
  };
  //默认收到SIGTERM和SIGINT不退出
  //在开启调试模式则会退出
  if (!this.config.debug) {
    process.on('SIGTERM', handle_sig);
    process.on('SIGINT', handle_sig);
    process.on('SIGALRM', handle_sig);
  }
  
  if (cluster.isMaster) {
    if (num <= 0) {
      num = os.cpus().length;
      //如果CPU核心数超过2个，则使用核心数-1的子进程处理请求，
      //在进程调度时少一个上下文切换反而会带来更高的效率。
      if (num > 2) {
        num -= 1;
      }
    }
    if (typeof this.config.pidFile === 'string' && this.config.pidFile.length > 0) {
      fs.writeFile(this.config.pidFile, process.pid, (err) => {
        if (err) { console.error(err); }
      });
    }
    this.daemonMessage();

    //clear router and service
    this.service = {};
    this.router.clear();
    this.midware.mid_group = {};

    cluster.on('listening', (worker, addr) => {
      this.workers[ worker.id ] = {
        startTime : Date.now(),
        address : addr,
        id : worker.id
      };
    });

    cluster.on('exit', (worker, code, signal) => {
      let w = this.workers[worker.id];
      if (w) {
        let tm = Date.now();

        if (tm - w.startTime <= this.workerErrorTime) {
          console.error('worker进程在限制的最短时间内(',
            this.workerErrorTime,
            'ms )退出，请检测代码是否存在错误。');
          process.kill(0, 'SIGABRT');
          //process.exit(1);
        } else {
          delete this.workers[w.id];
        }
      }
    });


    process.on('SIGABRT', (sig) => {
      console.error('abort');
      process.exit(1);
    });
    
    process.on('SIGHUP', (sig) => {
      process.exit(0);
    });

    for(let i=0; i<num; i++) { cluster.fork(); }
    
    /**
     * 也许cluster的exit或disconnect事件更好，
     * 但是在测试中，如果worker被kill，则会出现master进程退出的情况。
     * 这引发了EPIPE错误，定位是在子进程send时出错的。
     * */
    
    if (cluster.isMaster) {
      process.on('SIGCHLD', (sig) => {
        
        let num_dis = num - Object.keys(cluster.workers).length;

        if (num_dis <= 0) return;

        for(let i=0; i<num_dis; i++)
          cluster.fork();
        
      });
      /*
      setInterval(() => {
        let num_dis = num - Object.keys(cluster.workers).length;

        for(let i=0; i<num_dis; i++) { cluster.fork(); }
      }, 1248);
      */
    }

  } else if (cluster.isWorker) {
    
    this.run(port, host);

    if (this.config.showLoadInfo) {
      var cpuLast = {user: 0, system: 0};
      var cpuTime = {};
      setInterval(() => {
        cpuTime = process.cpuUsage(cpuLast);
        process.send({
          type : 'load',
          pid  : process.pid,
          cpu  : cpuTime,
          mem  : process.memoryUsage(),
          conn : the.rundata.conn,
          host : host,
          port : port
        });
        cpuLast = process.cpuUsage();
      }, 1024);
    }
  }
};

module.exports = titbit;

