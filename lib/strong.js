'use strict'

class strong {

  constructor (options = {}) {

    this.catchErrors = [
      'TypeError', 'ReferenceError', 'RangeError', 'AssertionError', 'URIError', 'Error'
    ]

    this.quiet = false

    if (typeof options !== 'object') {
      options = {}
    }

    for (let k in options) {
      switch (k) {
        
        case 'catchErrors':
          if (options.catchErrors instanceof Array) {
            this.catchErrors = options.catchErrors
          }
          break

        case 'quiet':
          this.quiet = options[k]
          break
      }
    }

  }

  init () {

    let handleError = (err, str) => {

      if (this.catchErrors.indexOf(err.constructor.name) >= 0) {
        if (!this.quiet) {
          console.error(str, err)
        }
        return true
      }

      console.error(err)
      process.exit(1)
    }

    process.on('unhandledRejection', (err, pr) => {
      handleError(err, '--CATCH--REJECTION:')
    })

    process.on('uncaughtException', (err, origin) => {
      handleError(err, '--CATCH--ERROR:')
    })

    process.on('uncaughtExceptionMonitor', (err,origin) => {})

  }

}

module.exports = strong
