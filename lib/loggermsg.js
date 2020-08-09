const fs = require('fs');

class loggermsg {
  constructor (options) {
    this.config = options;

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
      } catch (err) {
        console.error(err);
        this.out = null;
      }
    } else if (this.config.logType == 'stdio') {
      let opts = {stdout:process.stdout, stderr: process.stderr};
      this.out = new console.Console(opts);
    }
  }

  msgEvent () {
    let self = this;
    return (w, msg) => {
      if (self.out) {
        msg.success ? self.out.log(msg.log) : self.out.error(msg.log);
      }
    };
  }

}

module.exports = loggermsg;
