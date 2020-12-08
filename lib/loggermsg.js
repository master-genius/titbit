const fs = require('fs');

class loggermsg {
  constructor (options) {
    this.config = options;

    this.out = null;

    this.stdout = null;
    this.stderr = null;

    this.watchReset = false;
  }

  //在init之后运行
  watch () {

    if (this.config.logType !== 'file') {
      return;
    }

    let wtf = (curr, prev) => {
      if (curr.nlink == 0 && prev.nlink > 0) {
        if (this.watchReset) {
          return;
        }
        this.watchReset = true;
        this.destroy();
        this.init();
        this.watchReset = false;
      }
    };

    fs.watchFile(this.config.logFile, wtf);
    fs.watchFile(this.config.errorLogFile, wtf);
  }

  destroy () {
    try {
      if (this.stdout && !this.stdout.destroyed) {
        this.stdout.destroy();
      }
      if (this.stderr && !this.stderr.destroyed) {
        this.stderr.destroy();
      }
    } catch (err) {

    }
    this.stdout = this.stderr = null;
    this.out = null;
  }

  init () {
    if (this.config.logType == 'file') {
      try {
        let ofd = fs.openSync(this.config.logFile, 'a+');
        let out_log = fs.createWriteStream(this.config.logFile, {flags: 'a+', fd : ofd});
  
        let efd = fs.openSync(this.config.errorLogFile, 'a+');
        let err_log = fs.createWriteStream(this.config.errorLogFile, {flags: 'a+', fd : efd});
  
        this.out = new console.Console(out_log, err_log);
        this.stdout = out_log;
        this.stderr = err_log;

      } catch (err) {
        if (this.config.debug) {
          console.error(err);
        }
        
        this.out = null;
      }
    } else if (this.config.logType == 'stdio') {
      let opts = {stdout:process.stdout, stderr: process.stderr};
      this.out = new console.Console(opts);
    }
  }

  msgEvent () {
    
    //this.config.logType === 'self'
    if (typeof this.config.logHandle === 'function') {
      return this.config.logHandle;
    }
    
    let self = this;
    return (w, msg, handle = undefined) => {
      if (self.out) {
        msg.success ? self.out.log(msg.log) : self.out.error(msg.log);
      }
    };
  }

}

module.exports = loggermsg;
