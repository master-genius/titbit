'use strict';

const fs = require('node:fs');
const path = require('node:path');

const fsp = fs.promises;

let fmtTime = () => {
  let t = new Date();
  let m = t.getMonth() + 1;
  let d = t.getDate();
  let h = t.getHours();
  let mt = t.getMinutes();
  let sec = t.getSeconds();

  return `${t.getFullYear()}_${m < 10 ? '0' : ''}${m}_${d < 10 ? '0' : ''}${d}`
      + `_${h < 10 ? '0' : ''}${h}_${mt < 10 ? '0' : ''}${mt}`
      + `_${sec < 10 ? '0' : ''}${sec}`;
};

class loggermsg {

  constructor (options) {
    this.config = options;

    this.out = null;

    this.fout = null;
    this.ferr = null;

    this.watchReset = false;

    this.count = 0;

    this.errCount = 0;

    this.maxLines = this.config.logMaxLines;

    this.maxSize = 200 * this.maxLines;

    this.checkLock = false;

    this.historyList = [];
    this.errHistoryList = [];

    this.logfile = '';
    this.logDir = '';
    this.errfile = '';
    this.errLogDir = '';

    this.prefix = '';
    this.eprefix = '';

    this.premap = {
      logfile: 'prefix',
      errfile: 'eprefix'
    };

    this.parseLogPath();
    this.parsePrefix();
  }

  parsePrefix() {
    let keys = ['logfile', 'errfile'];
 
    keys.forEach(a => {
      let leng = this[a].length
      let extname = this[a].substring(leng-4).toLowerCase()
      let k = this.premap[a]

      if (extname === '.log') {
        this[k] = this[a].substring(0, leng-4) + '_'
      } else {
        this[k] = this[a] + '_'
      }

    })
  }

  parseLogPath () {
    if (this.config.logType !== 'file') return;

    this.logfile = path.basename(this.config.logFile);
    this.errfile = path.basename(this.config.errorLogFile);
    this.logDir = path.resolve( path.dirname(this.config.logFile) );
    this.errLogDir = path.resolve( path.dirname(this.config.errorLogFile) );
  }

  //在init之后运行
  watch () {
    if (this.config.logType !== 'file') {
      return;
    }

    let wtf = (evt, fname) => {
      if (this.watchReset) {
        return;
      }

      if (evt === 'rename') {
        if (fname !== this.logfile && fname !== this.errfile ) {
          return;
        }
        this.watchReset = true;
        this.destroy();
        this.init();
        this.watchReset = false;
      }
    };

    try {
      fs.watch(this.logDir, wtf);
    } catch (err) {}

    if (this.logDir !== this.errLogDir) {
      try {
        fs.watch(this.errLogDir, wtf);
      } catch (err) {}
    }

  }

  destroy () {
    try {
      if (this.fout && !this.fout.destroyed) {
        this.fout.destroy();
      }
      if (this.ferr && !this.ferr.destroyed) {
        this.ferr.destroy();
      }
    } catch (err) {}

    this.fout = this.ferr = this.out = null;
  }

  /**
   * 用于init之前的检测工作，主要检测日志文件是否已经超过了最大限制，
   * 如果服务进程反复运行，会导致日志文件不断增大。
   * 解决方案就是如果初始检测发现日志文件已经存在并且已经超过最大限制，
   * 则直接设置计数为maxLines，让日志处理程序自动把它保存为备份日志文件。
   * */
  async _checkBeforeInit () {
    if (this.config.logType !== 'file') return;

    try {
      await fsp.access(this.config.logFile);
      let fa = await fsp.stat(this.config.logFile);

      if (fa.size >= this.maxSize) {
        this.count = this.maxLines;
      }
    } catch (err) {

    }

    try {
      await fsp.access(this.config.errorLogFile);
      let fb = await fsp.stat(this.config.errorLogFile);
      if (fb.size >= this.maxSize) {
        this.errCount = this.maxLines;
      }
    } catch (err) {

    }

  }

  init () {
    if (this.config.logType === 'file') {
      this.out = null;

      if (this.fout === null) {
          try {
            this.fout = fs.createWriteStream(this.config.logFile, { flags: 'a+', mode: 0o644 });
            
            this.fout.on('close', () => {
              this.fout = null;
            });

            this.fout.on('error', err => {
              this.fout = null;
            });
          } catch (err) {
            this.config.errorHandle(err, '--ERR-LOGGER-INIT--');
          }
      }

      if (this.ferr === null) {
          try {
              this.ferr = fs.createWriteStream(this.config.errorLogFile, { flags: 'a+', mode: 0o644 });

              this.ferr.on('close', () => {
                this.ferr = null;
              });

              this.ferr.on('error', err => {
                this.ferr = null;
              });

          } catch (err) {
            this.config.errorHandle(err, '--ERR-LOGGER-INIT--');
          }
      }

    } else if (this.config.logType === 'stdio') {
      if (!this.out) {
        let opts = {
              stdout: process.stdout,
              stderr: process.stderr
            };

        this.out = new console.Console(opts);
      }
    }
  }

  async _checkAndInit (k, ct, fname, curname, dirname, hlist) {
    if (!this[k]) return;
    if (this[ct] < this.maxLines) return;

    let prename = this.premap[curname];

    let history_logfile = `${this[dirname]}/${this[prename]}${fmtTime()}.log`;

    let st = true;

    await fsp.rename(fname, history_logfile).catch(err => {
        st = false;
        //检测是否还存在日志文件，若没有则初始化。
        fs.access(fname, err => {
          if (!err) return;
          this[k] && !this[k].destroyed && this[k].destroy();
          this[ct] = 0;
          this.init();
        });
    });

    if (!st) return;

    this[hlist].push(history_logfile);
    this[k] && !this[k].destroyed && this[k].destroy();
    this[k] = null;
    this[ct] = 0;

    this.init();
  }

  async checkLog () {
    if (this.checkLock) return;

    this.checkLock = true;
    try {
      this.clearHistoryList('historyList');
      this.clearHistoryList('errHistoryList');

      await this._checkAndInit('fout', 'count',
                this.config.logFile,
                'logfile',
                'logDir',
                'historyList');
      
      await this._checkAndInit('ferr', 'errCount',
                this.config.errorLogFile,
                'errfile',
                'errLogDir',
                'errHistoryList');

    } catch (err) {
      this.config.errorHandle(err, '--ERR-CHECK-LOG--');
    } finally {
      this.checkLock = false;
    }

  }

  clearHistoryList(k) {
    let hlist = this[k];
    
    if (!hlist || !Array.isArray(hlist)) return;

    if (hlist.length > (this.config.logHistory + 2)) {
        let hfile;
        let i=0;
        let total = 3;
        while (i < total) {
          hfile = hlist.shift();
          
          if (!hfile) return;

          fs.unlink(hfile, err => {
            err && (!err.code || err.code !== 'ENOENT') && this.config.errorHandle(err, '--ERR-UNLINK-LOG--')
          });

          i += 1;
        }
    }
  }

  msgEvent () {
    if (typeof this.config.logHandle === 'function') {
      return this.config.logHandle
    }
    
    let handle_none = (w, msg, handle) => {}

    if (this.config.logType === '') {
      return handle_none
    }

    let handle_file = (w, msg, handle) => {
        if (msg.success) {
          this.fout && this.fout.write(msg.log) && (this.count += 1);
        } else {
          this.ferr && this.ferr.write(msg.log) && (this.errCount += 1);
        }

        if (!this.fout || !this.ferr) {
          this.init();
        }

        this.checkLog();
    }

    let handle_stdio = (w, msg, handle) => {
        if (this.out) {
          msg.success ? this.out.log(msg.log) : this.out.error(msg.log);
        } else {
          this.init();
        }
    }

    if (this.config.logType === 'file') {
      return handle_file
    }

    /*
    if (this.config.logType === 'mix') {
      return (w, msg, handle) => {
        handle_file(w, msg, handle)
        handle_stdio(w, msg, handle)
      }
    }*/

    return handle_stdio
  }

}

module.exports = loggermsg;
