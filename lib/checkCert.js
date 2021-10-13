'use strict'

const fs = require('fs')

module.exports = (cert, key) => {
  try {
    fs.accessSync(cert, fs.constants.F_OK | fs.constants.R_OK);
    fs.accessSync(key, fs.constants.F_OK | fs.constants.R_OK);
    return true;
  } catch (err) {
    if (process.send && typeof process.send === 'function') {
      process.send({
        type: '_cert-error',
        message: `${err.message}\n证书或密钥文件不存在或不具备可读权限。\n`
      });
      process.exit(1);
    } else {
      console.error(err.message);
      console.error('证书或密钥文件不存在或不具备可读权限。');
      process.exit(1);
    }
  }
  return false;
};

