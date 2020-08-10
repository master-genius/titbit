'use strict';

const cluster = require('cluster');
const os = require('os');
const fs = require('fs');

class monitor {

  constructor (options) {
    this.config = options.config;
    this.workers = options.workers;
    this.rundata = options.rundata;
    this.secure = options.secure;

    this.loadCount = 0;
    this.loadInfo = {};

    this.sendInterval = null;
  }

  msgEvent () {
    let self = this;
    return (w, msg) => {
      if (self.checkMem(msg)) {
        self.showLoadInfo(msg, w.id);
      }
    };
  }

  workerSend () {
    this.sendInterval = setInterval(() => {
      this.rundata.cpuTime = process.cpuUsage(this.rundata.cpuLast);
      this.rundata.mem = process.memoryUsage();
      process.send({
        type : '_load',
        pid  : process.pid,
        cpu  : this.rundata.cpuTime,
        mem  : this.rundata.mem,
        conn : this.rundata.conn
      });
      this.rundata.cpuLast = process.cpuUsage();
    }, 1000);
  }

  showLoadInfo (w, id) {

    if (this.config.loadInfoType == '--null') {
      return;
    }
  
    if (this.workers[id] === undefined) {
      return ;
    }
  
    let total = Object.keys(cluster.workers).length;
  
    this.workers[id].cpu.user = w.cpu.user;
    this.workers[id].cpu.system = w.cpu.system;
    this.workers[id].mem.rss = w.mem.rss;
    this.workers[id].mem.heapTotal = w.mem.heapTotal;
    this.workers[id].mem.heapUsed = w.mem.heapUsed;
    this.workers[id].mem.external = w.mem.external;
    this.workers[id].conn = w.conn;
  
    this.loadCount += 1;
    if (this.loadCount < total) {
      return ;
    }
    
    let loadText = this.fmtLoadInfo( this.config.loadInfoType );
  
    if (!this.config.daemon && this.config.loadInfoFile == '')
      console.clear();
  
    if (this.config.loadInfoFile.length > 0) {
      fs.writeFile(this.config.loadInfoFile, loadText, (err) => {
        if (err && this.config.debug) { console.error(err.message); }
      });
    } else {
      console.log(loadText);
    }
  
    this.loadCount = 0;
  
  }

  checkMem (msg) {

    if (this.secure.maxrss > 0 && this.secure.maxrss <= msg.mem.rss) {
      process.kill(msg.pid, 'SIGABRT');
      return false;
    }
  
    if (this.secure.diemem > 0 && this.secure.diemem <= msg.mem.heapTotal) {
      process.kill(msg.pid, 'SIGABRT');
      return false;
    }
  
    if (this.secure.maxmem > 0 
      && this.secure.maxmem <= msg.mem.heapTotal
      && msg.conn == 0)
    {
      process.kill(msg.pid, 'SIGABRT');
      return false;
    }
    return true;
  }

  fmtLoadInfo (type = 'text') {
    let oavg = os.loadavg();
  
    let p = null;
  
    if (type == 'text') {
      let oscpu = `CPU Loadavg  1m: ${oavg[0].toFixed(2)}  `
                  + `5m: ${oavg[1].toFixed(2)}  15m: ${oavg[2].toFixed(2)}\n`;
  
      let cols = ' PID      CPU      CONN   MEM,   HEAP,  USED,  EXTERNAL\n';
      let tmp = '';
      let t = '';
      let p = null;
  
      for (let id in this.workers) {
        
        p = this.workers[id];
  
        tmp = ` ${p.pid}      `;
        tmp = tmp.substring(0, 10);
  
        t = p.cpu.user + p.cpu.system;
        t = (t/100000).toFixed(2);
        tmp += t + '%      ';
        tmp = tmp.substring(0, 20);
  
        tmp += `${p.conn}       `;
        tmp = tmp.substring(0,26);
  
        tmp += (p.mem.rss / 1048576).toFixed(1) + ',  ';
        tmp += (p.mem.heapTotal / 1048576).toFixed(1) + ',  ';
        tmp += (p.mem.heapUsed / 1048576).toFixed(1)+',   ';
        tmp += (p.mem.external / 1048576).toFixed(1);
        tmp += 'M';
  
        cols += `${tmp}\n`;
      }
      cols += `  Master PID: ${process.pid}\n`;
      cols += `  Listen ${this.rundata.host}:${this.rundata.port}\n`;
  
      return `${oscpu}${cols}`;
    }
  
    if (type == 'json') {
      let loadjson = {
        masterPid : process.pid,
        listen : `${this.rundata.host}:${this.rundata.port}`,
        CPULoadavg : {
          '1m' : `${oavg[0].toFixed(2)}`,
          '5m' : `${oavg[1].toFixed(2)}`,
          '15m' : `${oavg[2].toFixed(2)}`
        },
        workers : []
      };
      for (let id in this.workers) {
        p = this.workers[id];
  
        loadjson.workers.push({
          pid : p.pid,
          cpu : `${((p.cpu.user + p.cpu.system)/100000).toFixed(2)}%`,
          mem : {
            rss : (p.mem.rss / 1048576).toFixed(1),
            heap : (p.mem.heapTotal / 1048576).toFixed(1),
            heapused : (p.mem.heapUsed / 1048576).toFixed(1),
            external :  (p.mem.external / 1048576).toFixed(1),
          },
          conn : p.conn
        });
      }
      return JSON.stringify(loadjson);
    }
  
    if (type == 'orgjson') {
      let loadjson = {
        masterPid : process.pid,
        listen : `${this.rundata.host}:${this.rundata.port}`,
        CPULoadavg : {
          '1m' : `${oavg[0].toFixed(2)}`,
          '5m' : `${oavg[1].toFixed(2)}`,
          '15m' : `${oavg[2].toFixed(2)}`
        },
        workers : this.workers
      };
      return JSON.stringify(loadjson);
    }
    
    return '';
  }

}

module.exports = monitor;
