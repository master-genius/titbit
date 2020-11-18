'use strict'

const titbit = require('../main')

const app = new titbit({
  debug: true,
  loadInfoFile: '/tmp/loadinfo.log'
})

app.run(1234)
