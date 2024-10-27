'use strict'

const process = require('node:process')

class Strong {

  constructor(options = {}) {

    this.catchErrors = [
      'TypeError', 'ReferenceError', 'RangeError', 'AssertionError', 'URIError', 'Error'
    ]

    this.quiet = false

    this.errorHandle = (err, str) => {
      if (this.catchErrors.indexOf(err.constructor.name) >= 0) {
        if (!this.quiet) {
          console.error(str, err)
        }
        return true
      }

      console.error(err)
      process.exit(1)
    }

    if (typeof options !== 'object') {
      options = {}
    }

    for (let k in options) {
      switch (k) {
        
        case 'catchErrors':
          if (typeof options[k] === 'string') {
            options[k] = [ options[k] ]
          }

          if (Array.isArray(options[k])) {
            this.catchErrors = options[k]
          }
          break

        case 'errorHandle':
          if (typeof options[k] === 'function') {
            this.errorHandle = options[k]
          }
          break

        case 'quiet':
          this.quiet = !!options[k]
          break
      }
    }

  }

  init() {

    process.on('unhandledRejection', (err, pr) => {
      this.errorHandle(err, '--CATCH-REJECTION--')
    })

    process.on('uncaughtException', (err, origin) => {
      this.errorHandle(err, '--CATCH-EXCEPTION--')
    })

  }

}

module.exports = Strong
