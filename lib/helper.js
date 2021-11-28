'use strict';

const crypto = require('crypto');
const fs = require('fs');

const helper = {};

/**
 * @param {string} fname 文件名称
 */
helper.extName = function (fname) {
  let ind = fname.length - 2

  while (ind > 0 && fname[ind] !== '.') {
    ind -= 1
  }

  if (ind <= 0) {
    return ''
  }

  return fname.substring(ind)
};

/**
 * @param {string} filename 文件名称
 * @param {string} pre_str 前缀字符串
 */
helper.makeName = function(filename = '', type = 'time') {
  if (type == 'time') {
    let tm = new Date();

    let orgname = `${tm.getFullYear()}-${tm.getMonth()+1}-${tm.getDate()}_`
        + `${tm.getHours()}-${tm.getMinutes()}-${tm.getSeconds()}`
        + `_${parseInt(Math.random() * 100000) + 10000}`;
    
    if (filename) return (orgname + helper.extName(filename));

    return orgname;

  } else {
    let org_name = `${Math.random()}${Date.now()}${Math.random()}`;
    let hash = crypto.createHash('sha1');
    hash.update(org_name);
    return hash.digest('hex') + ((!filename) ? '' : helper.extName(filename));
  }
};

/**
 * @param {string} filename 文件名
 * @param {string} encoding 文件编码
 */
helper.readFile = function (filename, encoding = 'utf8') {
  return new Promise((rv, rj) => {
    fs.readFile(filename, {encoding:encoding}, (err, data) => {
      if (err) {
        rj(err);
      } else {
        rv(data);
      }
    });
  });
};

helper.readb = (filename) => {
  return new Promise((rv,rj) => {
    fs.readFile(filename,(err,data) => {
      if (err) {
        rj(err);
      } else {
        rv(data);
      }
    });
  });
};

/**
 * @param {string} filename 文件名
 * @param {string} encoding 文件编码
 */
helper.writeFile = function (filename, data, encoding = 'utf8') {
  return new Promise((rv, rj) => {
    fs.writeFile(filename, data, {encoding:encoding}, err => {
      if (err) {
        rj(err);
      } else {
        rv(data);
      }
    });
  });
};

let _ctype_map = {
  ".png"    : "image/png",
  ".jpeg"   : "image/jpeg",
  ".jpg"    : "image/jpeg",
  ".gif"    : "image/gif",
  ".ico"    : "image/x-icon",
  ".bmp"    : "image/bmp",
  ".svg"    : "image/svg+xml",
  ".webp"   : "image/webp",

  ".js"     : "text/javascript",
  ".html"   : "text/html",
  ".css"    : "text/css",
  ".xml"    : "text/xml",
  ".json"   : "application/json",
  ".txt"    : "text/plain",
  ".c"      : "text/plain",
  ".h"      : "text/plain",
  ".sh"     : "text/plain",

  ".crt"    : "application/x-x509-ca-cert",
  ".cert"   : "application/x-x509-ca-cert",
  ".cer"    : "application/x-x509-ca-cert",
  ".zip"    : "application/zip",
  ".tgz"    : "application/x-compressed",
  ".gz"     : "application/x-gzip",

  ".mp3"    : "audio/mpeg",
  ".wav"    : "audio/wav",
  ".midi"   : "audio/midi",
  ".wav"    : "audio/wav",
  
  ".mp4"    : "video/mp4",
  ".webm"   : "video/webm",

  '.ttf'    : 'font/ttf',
  '.wtf'    : 'font/wtf',
  '.woff'   : 'font/woff',
  '.woff2'  : 'font/woff2',
  '.ttc'    : 'font/ttc',
};

/**
 * @param {string} extname 文件扩展名
 */
helper.ctype = function (extname) {

  if (_ctype_map[extname] === undefined) {
    return 'application/octet-stream';
  }

  return _ctype_map[extname];
};

helper._aesIV = '1283634750392757';

Object.defineProperty(helper, 'aesIv', {
  set: (iv) => {
    helper._aesIV = iv;
  },

  get: () => {
    return helper._aesIV;
  }
});

/*
 *key 必须是32位
 * */
helper.aesEncrypt = function (data, key, encoding = 'base64') {
  var h = crypto.createCipheriv('aes-256-cbc', key, helper._aesIV);
  let hd = h.update(data, 'utf8', encoding);
  hd += h.final('base64');
  return hd;
};

helper.aesDecrypt = function (data, key, encoding = 'base64') {
  var h = crypto.createDecipheriv('aes-256-cbc', key, helper._aesIV);
  let hd = h.update(data, encoding, 'utf8');
  hd += h.final('utf8');
  return hd;
};

helper.md5 = (data, encoding = 'hex') => {
  let h = crypto.createHash('md5');
  h.update(data);
  return h.digest(encoding);
};

helper.sha1 = (data, encoding = 'hex') => {
  let h = crypto.createHash('sha1');
  h.update(data);
  return h.digest(encoding);
};

helper.sha256 = (data, encoding = 'hex') => {
  let h = crypto.createHash('sha256');
  h.update(data);
  return h.digest(encoding);
};

helper.sha512 = function (data, encoding = 'hex') {
  let h = crypto.createHash('sha512');
  h.update(data);
  return h.digest(encoding);
};

helper.hmacsha1 = function (data, key, encoding = 'hex') {
  let h = crypto.createHmac('sha1', key);
  h.update(data);
  return h.digest(encoding);
};

let saltArr = [
  'a','b','c','d','e','f','g',
  'h','i','j','k','l','m','n',
  'o','p','q','r','s','t','u',
  'v','w','x','y','z','1','2',
  '3','4','5','6','7','8','9'
];

let _saltLength = saltArr.length;

function randstring (length = 8) {

  let saltstr = '';
  let ind = 0;

  for(let i = 0; i < length; i++) {
    ind = parseInt( Math.random() * _saltLength);
    saltstr += saltArr[ ind ];
  }

  return saltstr;
};

helper.makeSalt = randstring;

helper.timestr = function (m = 'long') {
  let t = new Date();
  let year = t.getFullYear();
  let month = t.getMonth()+1;
  let day = t.getDate();
  let hour = t.getHours();
  let min = t.getMinutes();
  let sec = t.getSeconds();

  let mt = `${year}-${month > 9 ? '' : '0'}${month}-${day > 9 ? '' : '0'}${day}`;

  if (m === 'short') {
    return mt;
  }

  let md = `${mt}_${hour > 9 ? '' : '0'}${hour}`;
  if (m === 'middle') {
    return md;
  }

  return `${md}-${min > 9 ? '' : '0'}${min}-${sec > 9 ? '' : '0'}${sec}`;
};

helper.nrand = function (f, t) {
  let discount = t - f;
  return parseInt((Math.random() * discount) + f);
};

//8-4-4-4-12
helper.uuid = (short = false) => {
  
  let tmstr = Math.random().toString(16).substring(2);

  if (tmstr.length > 8) {
    tmstr = tmstr.substring(tmstr.length - 8);
  } else if (tmstr.length < 8) {
    tmstr += randstring(8 - tmstr.length)
  }

  let midstr;
  let laststr;

  if (short) {
    midstr = `${randstring(2)}-${randstring(2)}-${randstring(2)}`;

    return `${tmstr}-${midstr}-${randstring(2)}${helper.nrand(10, 99)}`;
  }

  midstr = `${randstring(4)}-${randstring(4)}-${randstring(4)}`;
  laststr = `${randstring(7)}${helper.nrand(10000, 99999)}`;

  return `${tmstr}-${midstr}-${laststr}`;

};

helper.makeId = (length = 12) => {

  let tmstr = Math.random().toString(16).substring(2);

  if (tmstr.length === length) {
    return tmstr;
  }

  if (tmstr.length < length) {
    return `${tmstr}${randstring(length - tmstr.length)}`;
  }

  if (tmstr.length > length) {
    return tmstr.substring(tmstr.length - length);
  }

};

helper.pipe = (filename, dest, options = {}) => {
    let fread = fs.createReadStream(filename, options)
  
    let end_writer = options.endWriter === undefined ? true : options.endWriter;

    return new Promise((rv, rj) => {

      fread.pipe(dest, {end: end_writer})

      fread.on('error', err => {
        rj(err)
      })

      fread.on('end', () => {
        rv()
      })
      
    })
};

module.exports = helper;

