'use strict';

const crypto = require('crypto');
const fs = require('fs');
const randstring = require('./randstring.js');
const makeId = require('./makeId.js');

const helper = {}

helper.randstring = randstring
helper.makeId = makeId.serialId
helper.serialId = makeId.serialId
helper.bigId = makeId.bigId

/**
 * @param {string} fname 文件名称
 */
helper.extName = function (fname) {
  let ind = fname.length - 2

  while (ind > 0 && fname[ind] !== '.') {
    ind -= 1
  }

  if (ind <= 0) return ''

  return fname.substring(ind)
}

let fmtbits = n => {
  return n < 10 ? `0${n}` : n
}

/**
 * @param {string} filename 文件名称
 * @param {string} pre_str 前缀字符串
 */
helper.makeName = function(filename = '') {
  let tm = new Date()

  let orgname = `${tm.getFullYear()}-${fmtbits(tm.getMonth()+1)}-${fmtbits(tm.getDate())}_`
      + `${fmtbits(tm.getHours())}-${fmtbits(tm.getMinutes())}-${fmtbits(tm.getSeconds())}`
      + `_${tm.getMilliseconds()}`
      + `${parseInt(Math.random() * 1000) + 1}${parseInt(Math.random() * 100000) + 10000}`
  
  if (filename) return (orgname + helper.extName(filename))

  return orgname
}

/**
 * @param {string} filename 文件名
 * @param {string} encoding 文件编码
 */
helper.readFile = function (filename, encoding = 'utf8') {
  return new Promise((rv, rj) => {
    fs.readFile(filename, {encoding:encoding}, (err, data) => {
      if (err) {
        rj(err)
      } else {
        rv(data)
      }
    })
  })
}

helper.readb = (filename) => {
  return new Promise((rv,rj) => {
    fs.readFile(filename,(err,data) => {
      if (err) {
        rj(err)
      } else {
        rv(data)
      }
    })
  })
}

/**
 * @param {string} filename 文件名
 * @param {string} encoding 文件编码
 */
helper.writeFile = function (filename, data, encoding = 'utf8') {
  return new Promise((rv, rj) => {
    fs.writeFile(filename, data, {encoding:encoding}, err => {
      if (err) {
        rj(err)
      } else {
        rv(data)
      }
    })
  })
}

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
  ".flac"   : "audio/flac",
  
  ".mp4"    : "video/mp4",
  ".webm"   : "video/webm",

  '.ttf'    : 'font/ttf',
  '.wtf'    : 'font/wtf',
  '.woff'   : 'font/woff',
  '.woff2'  : 'font/woff2',
  '.ttc'    : 'font/ttc',
}

let ctype_extname = {}

for (let k in _ctype_map) {
  ctype_extname[_ctype_map[k]] = k
}

/**
 * @param {string} extname 文件扩展名
 */
helper.ctype = (extname) => {
  if (_ctype_map[extname] === undefined) {
    return 'application/octet-stream'
  }

  return _ctype_map[extname]
}

helper.extnameType = (ctype) => {
  return ctype_extname[ctype] || ''
}

let __aesIV = '1283634750392757'
let __aag = 'aes-256-cbc'

Object.defineProperty(helper, 'aesIv', {
  set: (iv) => {
    __aesIV = iv
  },

  get: () => {
    return __aesIV
  }
})

Object.defineProperty(helper, 'algorithm', {
  set: (a) => {
    __aag = a
  },

  get: () => {
    return __aag
  }
})

/*
 *key 必须是32位
 * */
helper.aesEncrypt = function (data, key, encoding = 'base64url') {
  var h = crypto.createCipheriv(__aag, key, __aesIV)
  let hd = h.update(data, 'utf8', encoding)
  hd += h.final(encoding)
  return hd
}

helper.aesDecrypt = function (data, key, encoding = 'base64url') {
  var h = crypto.createDecipheriv(__aag, key, __aesIV)
  let hd = h.update(data, encoding, 'utf8')
  hd += h.final('utf8')
  return hd
}

helper.md5 = (data, encoding = 'hex') => {
  let h = crypto.createHash('md5')
  h.update(data)
  return h.digest(encoding)
}

helper.sha1 = (data, encoding = 'hex') => {
  let h = crypto.createHash('sha1')
  h.update(data)
  return h.digest(encoding)
}

helper.sha256 = (data, encoding = 'hex') => {
  let h = crypto.createHash('sha256')
  h.update(data)
  return h.digest(encoding)
}

helper.sha512 = (data, encoding = 'hex') => {
  let h = crypto.createHash('sha512')
  h.update(data)
  return h.digest(encoding)
}

helper.sm3 = (data, encoding = 'hex') => {
  let h = crypto.createHash('sm3')
  h.update(data)
  return h.digest(encoding)
}

helper.hmacsha1 = (data, key, encoding = 'hex') => {
  let h = crypto.createHmac('sha1', key)
  h.update(data)
  return h.digest(encoding)
}

helper.timestr = function (m = 'long') {
  let t = new Date()

  let year = t.getFullYear()
  let month = t.getMonth() + 1
  let day = t.getDate()
  let hour = t.getHours()
  let min = t.getMinutes()
  let sec = t.getSeconds()

  let mt = `${year}-${month > 9 ? '' : '0'}${month}-${day > 9 ? '' : '0'}${day}`

  if (m === 'short') {
    return mt
  }

  let md = `${mt}_${hour > 9 ? '' : '0'}${hour}`

  if (m === 'middle') {
    return md
  }

  return `${md}-${min > 9 ? '' : '0'}${min}-${sec > 9 ? '' : '0'}${sec}`
}

helper.nrand = function (f, t) {
  let discount = t - f
  return parseInt((Math.random() * discount) + f)
}

let uuidSerial = makeId.serialId

//8-4-4-4-12
helper.uuid = (short_mode=false) => {
  if (short_mode) {
    let id = uuidSerial(18)

    return id.substring(0,8) + '-' + id.substring(8,10) + '-' + id.substring(10,12) + '-'
          + id.substring(12, 14) + '-' + id.substring(14,18)
  }

  let id = uuidSerial(20)

  return id.substring(0,8) + '-' + id.substring(8,12) + '-' + id.substring(12,16) + '-' + id.substring(16, 20)
          + '-' + makeId(12)
}

helper.pipe = (filename, dest, options={}) => {
    let fread
    if (!options || typeof options !== 'object') otpions = {}

    if (typeof filename === 'string') {
      fread = fs.createReadStream(filename, options)
    } else if (filename instanceof fs.ReadStream) {
      fread = filename
    } else {
      throw new Error(`${filename}：filename必须是字符串或fs.ReadStream实例。`)
    }
  
    let end_writer = options.endWrite === undefined ? true : !!options.endWrite

    return new Promise((rv, rj) => {
      fread.pipe(dest, {end: end_writer})

      fread.on('error', err => {
        rj(err)
      })

      fread.on('end', () => {
        rv()
      })
      
    })
}

helper.delay = (tms=100) => {
  return new Promise((rv, rj) => {
    setTimeout(() => {
      rv()
    }, tms)
  })
}

module.exports = helper
