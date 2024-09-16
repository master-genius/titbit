'use strict'

const Titbit = require('../lib/titbit.js')

const app = new Titbit({debug: true})

app.run({port:3456})
