'use strict'

const Titbit = require('../lib/titbit.js')

const app = new Titbit({debug: true})

app.daemon({port:3456, host: '127.0.0.1', worker: 2})
