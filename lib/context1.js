'use strict'

const helper = require('./helper.js')
const moveFile = require('./movefile.js')

class Context {

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

    this.bodyLength = 0

    this.files     = {}

    this.requestCall = null

    this.ext     = helper

    this.port    = 0

    this.data = ''
    this.dataEncoding = 'utf8'

    this.request   = null

    this.response  = null

    this.reply = null

    this.box = {}

    this.service = null

    this.user    = null
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

  getFile(name, ind = 0) {
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

  setHeader(name, val) {
    this.response.setHeader(name, val)
    return this
  }

  sendHeader() {
    !this.response
      && !this.response.headersSent
      && this.response.writeHead(this.response.statusCode)

    return this
  }

  status(stcode = null) {
    if (stcode === null) {
      return this.response.statusCode
    }

    if (this.response) {
      this.response.statusCode = stcode
    }

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
    return helper.pipe(filename, this.reply, options)
  }

  removeHeader(name) {
    this.reply.removeHeader(name)
    return this
  }

  write(data) {
    this.reply.write(data)
    return this
  }

}

module.exports = Context
