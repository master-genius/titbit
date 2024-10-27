'use strict'

const fs = require('node:fs')
const process = require('node:process')

/**
 * autoExit 表示如果不是Worker进程，是否自动退出。
 */

module.exports = (type, msg, options = {autoExit: false}) => {
  try {
    if (process.send && typeof process.send === 'function') {
      process.send({
        type: type,
        message: msg
      });
    }

    if (options.autoExit) {
      process.exit(options.exitCode || 0);
    }

  } catch (err) {

  }

};
