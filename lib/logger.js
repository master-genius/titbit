'use strict'
const process = require('node:process');

module.exports = function (msg) {
  let tm = new Date();
  let tmstr = 
    `${tm.getFullYear()}-${tm.getMonth()+1}-${tm.getDate()} ${tm.getHours()}:${tm.getMinutes()}:${tm.getSeconds()}`;

  let log_data = {
    type  : '_log',
    success : true,
    status : msg.status,
    method: msg.method,
    ip: msg.ip,
    real_ip: msg.real_ip,
    log : `@ ${msg.method} | ${msg.link} | ${msg.status} | ${tmstr} | ${msg.ip} | ${msg.agent} | ${msg.real_ip}\n`
  };

  if (msg.status >= 400) {
    log_data.success = false;
  }

  if (process.send && typeof process.send === 'function') {
    process.send(log_data);
  } else {
    if (log_data.success) {
      console.log(log_data.log);
    } else {
      console.error(log_data.log);
    }
  }
};
