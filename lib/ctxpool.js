'use strict'

var ctxpool = new function () {
  
  this.max = 4096

  this.pool = []

  this.getctx = () => {
    if (this.pool.length > 0) {
      return this.pool.pop()
    }
    return null
  }

  this.free = (ctx) => {
    if (this.pool.length < this.max) {
      
      ctx.files = {}
      ctx.query = {}
      ctx.bodyBuffer = []
      ctx.box = {}
      ctx.isUpload = false

      this.pool.push(ctx)

    }
    //console.log(this.pool, this.pool.length)
  }

  this.clear = () => {
    while(this.pool.pop()) {}
  }

}

module.exports = ctxpool
