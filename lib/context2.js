'use strict'

const helper = require('./helper')
const moveFile = require('./movefile')

class context {

  constructor () {
    this.version = '2'

    //协议主版本号
    this.major = 2

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
      headers : {},
      body : '',
      encoding : 'utf8'
    },

    //在请求时指向实际的stream
    this.stream = null

    this.request = null
    
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

  setHeader (nobj, val=null) {
    if (typeof nobj === 'string' && val != null) {
      this.res.headers[nobj] = val;
    } else if (typeof nobj === 'object') {
      for(let k in nobj) {
        this.res.headers[k] = nobj[k];
      }
    }
  }

  sendHeader () {
    if (this.stream && !this.stream.headersSent) {
      this.stream.respond(this.res.headers);
    }
  }

  status (stcode = null) {
    if(stcode === null) {
      return parseInt(this.res.headers[':status']);
    }
    this.res.headers[':status'] = (typeof stcode === 'string' ? stcode : stcode.toString());
  }

  moveFile (upf, target) {
    return moveFile(this, upf, target);
  }
  
}

module.exports = context
