'use strict'

const helper = require('../lib/helper')

let key = '123456789012345678900987654321qw'

let data = JSON.stringify({
  name : '简单的机械键盘',
  age : 30
})

let iv = 'qwertyuiopasdfgh'

let cryptData = helper.aesEncrypt(data, key, iv)

console.log('encrypt data:', cryptData)

console.log('aes decrypt: ', helper.aesDecrypt(cryptData, key, iv))

console.log('timestr: ', helper.timestr() )

console.log('make name: ', helper.makeName('aswe.jpg'))

console.log('make salt:', helper.makeSalt())

console.log(helper.ctype('.jppe'))

console.log(helper.ctype('.jpg'))

console.log(helper.ctype('.js'))

console.log('hmacsha1: ', helper.hmacsha1('12345', '123456', 'base64'))

for (let i = 0; i < 5; i++) {
  console.log( helper.nrand(i, 1000 - i) )
}

for (let i = 0; i < 10 ; i++) {
  console.log( helper.uuid() )
}

for (let i = 0; i < 10 ; i++) {
  console.log( helper.uuid(true) )
}

let st = Date.now()

let uuidmap = {}
let tmp

let output_count = 0

let crashcount = 0

for (let i = 0; i < 5000000; i++) {
  //tmp = helper.uuid(true)
  tmp = helper.makeId(12)
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

