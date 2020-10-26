'use strict';

const titbit = require('../main')

const app = new titbit({
  debug: true,
  //globalLog: true
})

app.get('/', async c => {
  c.send('success')
})

app.run(1234)

