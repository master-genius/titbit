'use strict'

class strong {

  constructor (options = {}) {

    this.handleSignal = false

    this.catchErrors = [
      'TypeError', 'ReferenceError', 'RangeError', 'AssertionError', 'URIError', 'Error'
    ]

    this.signals = [
      'SIGINT', 'SIGTERM', 'SIGHUP', 'SIGABRT', 'SIGALRM'
    ]

    this.signalCall = (sig) => {}

    this.quiet = false

    if (typeof options !== 'object') {
      options = {}
    }

    for (let k in options) {
      switch (k) {
        case 'handleSignal':
          this.handleSignal = options.handleSignal
          break
        
        case 'signallCall':
          if (typeof options[k] === 'function') {
            this.signalCall = options.signalCall
          }
          break
        
        case 'catchErrors':
          if (options.catchErrors instanceof Array) {
            this.catchErrors = options.catchErrors
          }
          break
        
        case 'signals':
          if (options[k] instanceof Array) {
            this.signals = options[k]
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

    if (this.handleSignal) {
      for (let i = 0; i < this.signals.length; i++) {
        process.on(this.signals[i], this.signalCall)
      }
    }
  }

}

module.exports = strong
