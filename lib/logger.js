module.exports = function (msg) {
  let log_data = {
    type  : '_log',
    success : true,
    log : `@ ${msg.method} | ${msg.link} | ${msg.status} | `
      + `${(new Date()).toLocaleString('zh-CN')} | ${msg.ip} | ${msg.agent}\n`
  };

  if (msg.status != 200) { log_data.success = false; }

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
