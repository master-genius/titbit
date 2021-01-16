'use strict'

const helper = require('./helper')
const moveFile = require('./movefile')

class context {

  constructor () {

    this.version = '1.1'

    //主版本号
    this.major = 1

    this.maxBody = 0

    this.method    = ''

    this.host = ''

    this.protocol = ''

    this.ip      = ''

    //实际的访问路径
    this.path    = ''

    this.name    = ''

    this.headers   = {}

    //实际执行请求的路径
    this.routepath   = ''

    this.param     = {}

    this.query     = {}

    this.body    = {}

    this.isUpload  = false

    this.group     = ''

    this.rawBody   = ''

    this.bodyBuffer  = []

    this.bodyLength  = 0

    this.files     = {}

    this.requestCall = null

    this.helper    = helper

    this.port    = 0

    this.res = {
      body : '',
      encoding : 'utf8'
    },

    this.request   = null

    this.response  = null

    this.reply = null

    this.box = {}
    
    this.service = null
  }

  send (d, stcode = 200) {
    this.status(stcode)
    this.res.body = d
  }

  getFile (name, ind = 0) {
    if (ind < 0) {
      return this.files[name] || [];
    }

    if (this.files[name] === undefined) {
      return null;
    }
    
    if (ind >= this.files[name].length) {
      return null;
    }

    return this.files[name][ind];
  }

  setHeader (name, val) {
    this.response.setHeader(name, val);
  }

  //仅仅是为了和http2一致。
  sendHeader () {}

  status (stcode = null) {
    if (stcode === null) {
      return this.response.statusCode;
    }
    if(this.response) {
      this.response.statusCode = stcode;
    }
  }

  moveFile (upf, target) {
    return moveFile(this, upf, target);
  }
  
}

module.exports = context
