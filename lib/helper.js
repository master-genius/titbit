/**
  module router
  Copyright (C) 2019.08 BraveWang
  This program is free software; you can redistribute it and/or modify
  it under the terms of the GNU General Public License as published by
  the Free Software Foundation; either version 3 of the License , or
  (at your option) any later version.
 */

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
helper.makeFileName = function(filename = '', pre_str='') {
  var org_name = `${pre_str}${Date.now()}`;
  var hash = crypto.createHash('sha1');
  hash.update(org_name);
  return hash.digest('hex') + ((filename=='') ? '' : helper.extName(filename));
};

/**
 * @param {object} ctx 请求上下文对象
 * @param {object} upf 通过getFile获取的文件对象
 * @param {options} 选项，包括target(目标文件名)和path(目标目录)
 */
helper.moveFile = async function (ctx, upf, options) {
  if (options.filename === undefined) {
    options.filename = helper.makeFileName(upf.filename,
      `${(Math.random()*10000).toFixed(0)}`);
  }
  var target = options.path + '/' + options.filename;
  let fd = await new Promise((rv, rj) => {
    fs.open(target, 'w+', 0o644, (err, fd) => {
      if (err) { rj(err); }
      else { rv(fd); }
    });
  });
  return new Promise((rv, rj) => {
    fs.write(fd, ctx.rawBody, upf.start, upf.length, 
      (err,bytesWritten,buffer) => {
        if (err) { rj(err); }
        else { rv(bytesWritten); }
      });
  })
  .then(d => {
    return {target:target, filename: options.filename, bytes: d};
  }, e => { throw e; })
  .finally(() => {
    fs.close(fd, (err) => {});
  });
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
    ".js"     : "text/json",
    ".html"   : "text/html",
    ".css"    : "text/css",
    ".xml"    : "text/xml"
  };
  if (tmap[extname] === undefined) {
    return '';
  }
  return tmap[extname];
};

/*
 *key 必须是32位
 * */
helper.aesEncrypt = function (data, key, iv='1234567890123456', options = {}) {
  var h = crypto.createCipheriv('aes-256-cbc', key, iv, options);
  let hd = h.update(data, 'utf8', 'hex');
  hd += h.final('hex');
  return hd;
};

helper.aesDecrypt = function (data, key, iv='1234567890123456', options = {}) {
  var h = crypto.createDecipheriv('aes-256-cbc', key, iv, options);
  let hd = h.update(data, 'hex', 'utf8');
  hd += h.final('utf8');
  return hd;
};

helper.md5 = (data) => {
  var h = crypto.createHash('md5');
  h.update(data);
  return h.digest('hex');
};

helper.sha1 = (data) => {
  var h = crypto.createHash('sha1');
  h.update(data);
  return h.digest('hex');
};

helper.sha512 = function (data) {
  var h = crypto.createHash('sha512');
  h.update(data);
  return h.digest('hex');
};

helper.makeSalt = function (length = 8) {
  var saltArr = [
    'a','b','c','d','e','f','g',
    'h','i','j','k','l','m','n',
    'o','p','q','r','s','t','u',
    'v','w','x','y','z','1','2',
    '3','4','5','6','7','8','9'
  ];

  let total = saltArr.length;
  let saltstr = '';
  let ind = 0;

  for(let i=0; i<length; i++) {
    ind = parseInt( Math.random() * 10000) % total;
    saltstr += saltArr[ ind ];
  }
  return saltstr;
};

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

helper.uuid = (pre = '', cstr = '', bits = 32) => {
  let hstr = `${cstr}${Date.now()}${Math.random()}`;
  if (bits == 40) {
  return `${pre}${helper.sha1(hstr)}`;
  } else {
  return `${pre}${helper.md5(hstr)}`;
  }
};

module.exports = helper;
