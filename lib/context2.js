'use strict'

const helper = require('./helper.js')
const moveFile = require('./movefile.js')

class Context {

  constructor() {
    this.version = '2'

    //协议主版本号
    this.major   = 2

    this.maxBody = 0

    this.method  = ''

    this.host    = ''

    this.protocol = ''

    this.ip      = ''

    //实际的访问路径
    this.path    = ''

    this.name    = ''

    this.headers = {}

    //实际执行请求的路径
    this.routepath = ''

    this.param     = {}

    this.query     = {}

    this.body      = {}

    this.isUpload  = false

    this.group     = ''

    this.rawBody   = ''

    this.bodyLength = 0

    this.files     = {}

    this.requestCall = null

    this.ext       = helper

    this.port      = 0

    this.data = ''
    this.dataEncoding = 'utf8'
    this.dataHeaders = {}

    //在请求时指向实际的stream
    this.stream = null

    this.request = null

    this.reply = null

    this.box = {}
    
    this.service = null

    this.user = null
  }

  json(data) {
    return this.setHeader('content-type', 'application/json').send(data)
  }

  text(data, encoding='utf-8') {
    return this.setHeader('content-type', `text/plain;charset=${encoding}`).send(data)
  }

  html(data, encoding='utf-8') {
    return this.setHeader('content-type', `text/html;charset=${encoding}`).send(data)
  }

  send(d) {
    this.data = d
  }

  getFile(name, ind=0) {
    if (ind < 0) {
      return this.files[name] || []
    }

    if (this.files[name] === undefined) {
      return null
    }
    
    if (ind >= this.files[name].length) {
      return null
    }

    return this.files[name][ind]
  }

  setHeader(nobj, val=null) {
    if (typeof nobj === 'string' && val != null) {
      this.dataHeaders[nobj] = val
    } else if (typeof nobj === 'object') {
      for(let k in nobj) {
        this.dataHeaders[k] = nobj[k]
      }
    }

    return this
  }

  sendHeader() {
    if (this.stream && !this.stream.headersSent) {
      this.stream.respond(this.dataHeaders)
    }

    return this
  }

  status(stcode = null) {
    if (stcode === null) {
      let st = this.dataHeaders[':status']
      return st ? parseInt(st) : 200
    }
    
    this.dataHeaders[':status'] = (typeof stcode === 'string' ? stcode : stcode.toString())

    return this
  }

  moveFile(upf, target) {
    return moveFile(this, upf, target)
  }

  /**
   * @param {(fs.ReadStream|string)} filename
   * @param {object} options
   * */
  pipe(filename, options={}) {
    if (!this.stream.headersSent) {
      this.sendHeader()
    }

    return helper.pipe(filename, this.reply, options)
  }

  removeHeader(name) {
    this.dataHeaders[name]!==undefined && (delete this.dataHeaders[name]);
    return this
  }

}

module.exports = Context
