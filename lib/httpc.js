'use strict'

const http2 = require('node:http2')
const fs = require('node:fs')
const process = require('node:process');
const checkHeaderLimit = require('./headerLimit.js')
const sendmsg = require('./sendmsg.js');

let Httpc = function () {
  if ( !(this instanceof Httpc) ) {
    return new Httpc()
  }

  this.logger = null
  this.config = null
  this.fpurl = null
  this.host = ''
}

/**
 * 
 * @param {object} app titbit实例
 */

Httpc.prototype.init = function (app) {
  app.config.server.allowHTTP1 = true

  app.httpServ.run = this.run

  app.httpServ.onRequest = this.onRequest
}

Httpc.prototype.onRequest = function () {
  let self = this

  let callback = (req, res) => {
    req.on('error', (err) => {
      self.requestError(err, req, req.headers)
    })

    res.on('error', (err) => {
      self.requestError(err, res, req.headers)
    })

    req.on('aborted', err => {
      err && self.requestError(err, req, req.headers)
      !err && req.destroy()
    })

    let remote_ip = req.socket.remoteAddress || ''

    if (req.url.length > self.config.maxUrlLength) {
      req.url = req.url.substring(0, self.config.maxUrlLength)
    }

    if (self.config.globalLog) {
      
      let real_ip = '-'
      if (self.config.realIP) {
        real_ip = req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || '-'
      }

      res.on('finish', () => {
        if (!req || !res) return;
        
        checkHeaderLimit(req.headers, 'user-agent', 111)

        if (req.httpVersion[0] === '1') {
          checkHeaderLimit(req.headers, 'host', 300)

          self.logger({
            method : req.method,
            status : res.statusCode,
            ip : remote_ip,
            link: `https://${req.headers.host || self.host}${req.url}`,
            agent : req.headers['user-agent'] || '-',
            real_ip : real_ip,
          })

        } else {

          if (res.stream.rstCode == http2.constants.NGHTTP2_NO_ERROR) {
            checkHeaderLimit(req.headers, ':authority', 300)

            self.logger({
              method : req.method,
              status : res.statusCode,
              ip : remote_ip,
              link : `https://${req.authority}${req.url}`,
              agent : req.headers['user-agent'] || '-',
              real_ip : real_ip,
            })

          }

        }

      })

    }

    let urlobj = self.fpurl(req.url, self.config.autoDecodeQuery,
                    self.config.fastParseQuery,
                    self.config.maxQuery)

    let rt = self.router.findRealPath(urlobj.path, req.method)

    if (rt === null) {
      res.statusCode = 404
      res.end(self.config.notFound)
      return
    }

    let ctx = self.ctxpool.getctx() || new self.Context()

    if (req.httpVersion[0] === '1') {
      ctx.version = '1.1'
      ctx.major = 1
      ctx.host = req.headers.host || self.host
    } else {
      ctx.version = '2'
      ctx.major = 2
      ctx.host = req.authority
    }

    ctx.bodyLength = 0
    ctx.maxBody = self.config.maxBody
    ctx.service = self.service

    ctx.method = req.method
    ctx.protocol = 'https'
    ctx.ip = remote_ip

    ctx.port = req.socket.remotePort
    ctx.request = req
    ctx.response = res
    ctx.stream = res
    ctx.reply = ctx.response
    ctx.headers = req.headers

    ctx.path = urlobj.path
    ctx.query = urlobj.query
    ctx.routepath = rt.key
    ctx.requestCall = rt.reqcall.reqCall
    ctx.name = rt.reqcall.name
    ctx.group = rt.reqcall.group
    ctx.param = rt.args
    rt = null

    return self.midware.run(ctx).finally(()=>{
      ctx.stream = null
      self.ctxpool.free(ctx)
      ctx = null
    })

  }

  return callback
}

/** 
   * 运行HTTP/1.1服务
   * @param {number} port 端口号
   * @param {string} host IP地址，可以是IPv4或IPv6
   * 0.0.0.0 对应使用IPv6则是::
  */
Httpc.prototype.run = function (port, host) {
  let self = this
  let serv = null

  if (this.config.key && this.config.cert) {
    try {
        this.config.server.key  = fs.readFileSync(this.config.key)
        this.config.server.cert = fs.readFileSync(this.config.cert)
    } catch (err) {
        !this.isWorker && console.error(err)
        sendmsg('_server-error', err.message, {autoExit: true, exitCode: 1})
    }
  } else if (!this.config.server.SNICallback || typeof this.config.server.SNICallback !== 'function') {
      !this.isWorker && console.error('APLN协议需要启用HTTPS，请设置cert和key 或 server.SNICallback。')
      sendmsg('_server-error', '请设置cert和key或server.SNICallback。', {autoExit: true, exitCode: 1})
  }

  this.config.server.allowHTTP1 = true
  
  serv = http2.createSecureServer(this.config.server, this.onRequest())

  serv.on('tlsClientError', (err, tls) => {
    self.config.errorHandle(err, '--ERR-TLS-CLIENT--');
    !tls.destroyed && tls.destroy();
  })

  serv.on('secureConnection', (sock) => {
    sock.on('error', err => {
      self.config.errorHandle(err, '--ERR-CONNECTION--')
    })
  })

  serv.on('clientError', (err, sock) => {
    !sock.destroyed && sock.destroy()
  })

  serv.on('unknownProtocol', tls_sock => {
    !tls_sock.destroyed && tls_sock.destroy()
  })

  serv.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
      if (process.send !== undefined && typeof process.send === 'function') {
        process.send({type: '_eaddr'}, (err) => {})
      } else {
        console.error('该端口已被使用，请先停止进程')
        process.exit(1)
      }
    } else {
      self.config.errorHandle(e, '--ERR--')
    }
  })
  
  serv.setTimeout(this.config.timeout, (sock) => {
    !sock.destroyed && sock.destroy()
  })
  
  for (let k in this.events) {
    for (let ecall of this.events[k]) { 
      if (typeof ecall !== 'function') {
        continue
      }

      serv.on(k, ecall)
    }
  }

  this.events = {}
 
  //说明是使用unix socket模式监听服务
  if (typeof port === 'string' && port.indexOf('.sock') > 0) {
    serv.listen(port)
  } else {
    this.host = host
    if (port !== 443) {
      this.host += `:${port}`
    }

    serv.listen(port, host)
  }

  return serv
}

module.exports = Httpc
