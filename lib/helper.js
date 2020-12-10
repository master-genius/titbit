'use strict';

const crypto = require('crypto');
const fs = require('fs');

var helper = {};

/**
 * @param {string} filename 文件名称
 */
helper.extName = function (filename) {
  if (filename.indexOf(".") < 0) {
    return '';
  }
  var name_slice = filename.split('.');
  if (name_slice.length <= 0) {
    return '';
  }
  return '.' + name_slice[name_slice.length-1];
};

/**
 * @param {string} filename 文件名称
 * @param {string} pre_str 前缀字符串
 */
helper.makeName = function(filename = '', endstr = '', type = 'time') {
  if (type == 'time') {
    let tm = new Date();

    let orgname = `${tm.getFullYear()}-${tm.getMonth()+1}-${tm.getDate()}_`
        + `${tm.getHours()}-${tm.getMinutes()}-${tm.getSeconds()}`
        + `_${parseInt(Math.random() * 100000) + 1}${endstr}`;

    return `${orgname}${filename == '' ? '' : helper.extName(filename)}`;

  } else {
    let org_name = `${Math.random()}${Date.now()}${endstr}`;
    let hash = crypto.createHash('sha1');
    hash.update(org_name);
    return hash.digest('hex') + ((filename=='') ? '' : helper.extName(filename));
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

/**
 * @param {string} extname 文件扩展名
 */
helper.ctype = function (extname) {
  var tmap = {
    ".png"    : "image/png",
    ".jpeg"   : "image/jpeg",
    ".jpg"    : "image/jpeg",
    ".gif"    : "image/gif",
    ".ico"    : "image/x-icon",
    ".bmp"    : "image/bmp",
    ".svg"    : "image/svg+xml",
    ".webp"   : "image/webp",

    ".js"     : "text/json",
    ".html"   : "text/html",
    ".css"    : "text/css",
    ".xml"    : "text/xml",
    ".json"   : "text/json",

    ".mp3"    : "audio/mpeg",
    ".wav"    : "audio/wav",
    ".midi"   : "audio/midi",
    
    ".mp4"    : "video/mp4",
    ".webm"   : "video/webm",
  };

  if (tmap[extname] === undefined) {
    return '';
  }
  return tmap[extname];
};

helper._aesIV = '1283634750392757';

/*
 *key 必须是32位
 * */
helper.aesEncrypt = function (data, key, iv = null) {
  var h = crypto.createCipheriv('aes-256-cbc', key, iv || helper._aesIV);
  let hd = h.update(data, 'utf8', 'base64');
  hd += h.final('base64');
  return hd;
};

helper.aesDecrypt = function (data, key, iv = null) {
  var h = crypto.createDecipheriv('aes-256-cbc', key, iv || helper._aesIV);
  let hd = h.update(data, 'base64', 'utf8');
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

function randstring (length = 8) {

  let total = saltArr.length;
  let saltstr = '';
  let ind = 0;

  for(let i=0; i<length; i++) {
    //这比 parseInt( Math.random() * total)快。
    ind = parseInt( Math.random() * 1000) % total;
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
  
  let tm = Date.now() 

  //tm = tm ^ (tm * helper.nrand(10, 1000));
  tm = (tm * helper.nrand(10, 1111)) ^ helper.nrand(100000, 999999999);
  
  if (tm < 0) {
    tm = -tm;
  }

  let tmstr = tm.toString(16);

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

  let tm = Date.now();

  tm = (tm * helper.nrand(10, 1111)) ^ helper.nrand(100000, 999999999);

  if (tm < 0) {
    tm = -tm;
  }

  let tmstr = tm.toString(16);

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


module.exports = helper;
