'use strict'

const helper = require('../lib/helper.js')

let key = '123456789012345678900987654321qw'

let data = JSON.stringify({
  name : '简单的机械键盘',
  age : 30
})

helper.aesIv = 'qwertyuiopasdfgh'

let cryptData = helper.aesEncrypt(data, key)

console.log('encrypt data:', cryptData)

console.log('aes decrypt: ', helper.aesDecrypt(cryptData, key))

helper.aesIv = '1010101010101010';

console.log('aesIv: ', helper.aesIv);

console.log('timestr: ', helper.timestr() )

console.log('make name: ', helper.makeName('aswe.jpg'))

console.log('make name: ', helper.makeName('qw123456..'))

console.log('make name: ', helper.makeName('qw123456.'))

console.log('make name: ', helper.makeName('qwert..jpe.zip'))

console.log(helper.ctype('.jppe'))

console.log(helper.ctype('.jpg'))

console.log(helper.ctype('.js'))

console.log('hmacsha1: ', helper.hmacsha1('12345', '123456', 'base64'))

console.log('sm3: ', helper.sm3(`${Date.now()}`))

for (let i = 0; i < 5; i++) {
  console.log( helper.nrand(i, 1000 - i) )
}

for (let i = 0; i < 10 ; i++) {
  console.log(helper.serialId(), helper.uuid() )
}

for (let i = 0; i < 10 ; i++) {
  console.log( helper.uuid(true) )
}

let st = Date.now()

let uuidmap = {}
let tmp

let output_count = 0

let crashcount = 0

for (let i = 0; i < 1200000; i++) {
  tmp = helper.uuid()
  //tmp = helper.serialId(16)
  if (uuidmap[tmp] === undefined) {
    if (output_count < 10) {
      console.log(tmp)
      output_count += 1
    }
    uuidmap[tmp] = 1
  } else {
    crashcount += 1
  }
}

let et = Date.now()

console.log(et - st, 'ms', crashcount)
