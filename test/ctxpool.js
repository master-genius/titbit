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
      this.pool.push(ctx)
    }
  }

}

module.exports = ctxpool
