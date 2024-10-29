'use strict'

let ctxpool = new function () {
  
  this.max = 9999

  this.pool = []

  this.getctx = () => {
    if (this.pool.length > 0) {
      return this.pool.pop()
    }
    return null
  }

  this.free = (ctx) => {
    if (this.pool.length < this.max) {
      ctx.body = {}
      ctx.files = {}
      ctx.query = {}
      ctx.box = {}
      ctx.isUpload = false
      ctx.user = null
      ctx.dataEncoding = 'utf8'
      ctx.data = null

      this.pool.push(ctx)
    }
  
  }

  this.clear = () => {
    while(this.pool.pop()) {}
  }

}

module.exports = ctxpool
