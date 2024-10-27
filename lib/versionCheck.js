'use strict'

const process = require('node:process')

/**
 * 仅支持14.18以上版本。
 */

let _err_info = '请使用Node.js v14.18 以上版本。(Please use Node.js v14.18+)'

module.exports = function (minVersion = 14) {
  try {
    let cur = parseInt(process.version.substring(1))

    if (cur < minVersion) return {
      stat: false,
      errmsg: _err_info
    }

    return {
      stat: true,
    }

  } catch (err) {
    //不要因为小错误导致不能启动。
    return {
      stat: true,
      errmsg: err.message
    }
  }
}
