'use strict';

const fs = require('fs');
const path = require('path');

const fsp = fs.promises;

let fmtTime = () => {
  let t = new Date();
  let m = t.getMonth() + 1;
  let d = t.getDate();
  let h = t.getHours();
  let mt = t.getMinutes();
  let sec = t.getSeconds();

  return `${t.getFullYear()}-${m < 10 ? '0' : ''}${m}-${d < 10 ? '0' : ''}${d}`
      + `_${h < 10 ? '0' : ''}${h}-${mt < 10 ? '0' : ''}${mt}`
      + `-${sec < 10 ? '0' : ''}${sec}`;
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

    this.checkLock = false;

    this.historyList = [];
    this.errHistoryList = [];

    this.logfile = '';
    this.logDir = '';
    this.errfile = '';
    this.errLogDir = '';

    this.parseLogPath();

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

  init () {
    if (this.config.logType == 'file') {
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

    } else if (this.config.logType == 'stdio') {
      let opts = {
            stdout: process.stdout,
            stderr: process.stderr
          };

      this.out = new console.Console(opts);
    }
  }

  async _checkAndInit (k, ct, fname, curname, dirname, hlist) {
    if (!this[k]) return;
    
    if (this[ct] < this.maxLines) return;

    let history_logfile = `${this[dirname]}/${fmtTime()}_${this[curname]}`;

    let st = true;

    await fsp.rename(fname, history_logfile).catch(err => {
        st = false;
        //检测是否还存在日志文件，若没有则初始化。
        fs.access(fname, err => {
          if (!err) return;
          this[k].destroy();
          this[ct] = 0;
          this.init();
        });
    });

    if (!st) return;

    this[hlist].push(history_logfile);
    this[k].destroy();
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
            err && this.config.errorHandle(err, '--ERR-UNLINK-LOG--')
          });

          i += 1;
        }
    }
  }

  msgEvent () {
    
    if (typeof this.config.logHandle === 'function') {
      return this.config.logHandle;
    }
    
    let self = this;
    return (w, msg, handle = undefined) => {
        if (self.out) {
          msg.success ? self.out.log(msg.log) : self.out.error(msg.log);
        } else {
          if (msg.success) {
            self.fout && self.fout.write(msg.log) && (self.count += 1);
          } else {
            self.ferr && self.ferr.write(msg.log) && (self.errCount += 1);
          }

          if (!self.fout || !self.ferr) {
            self.init();
          }

          self.checkLog();
        }
    };
  }

}

module.exports = loggermsg;
