#!/usr/bin/env node
'use strict'

//process.chdir(__dirname)

const fs = require('fs')

let fname = 'app.js'

if (process.argv.length > 2) {
  fname = process.argv[2]
}

//let curdir = __dirname + '/../../'
let appfile = __dirname + '/app.js'

try {
  fs.accessSync(fname)
  console.log('文件已存在')
} catch (err) {
  fs.writeFileSync(fname, fs.readFileSync(appfile))
}
