'use strict'

const helper = require('../lib/helper')

let key = '123456789012345678900987654321qw'

let data = JSON.stringify({
  name : '简单的机械键盘',
  age : 30
})

let cryptData = helper.aesEncrypt(data, key)

console.log(helper.aesDecrypt(cryptData, key))

console.log( helper.timestr() )

console.log(helper.makeName('aswe.jpg'))

console.log(helper.uuid())

console.log(helper.ctype('.jppe'))

console.log(helper.ctype('.jpg'))

console.log(helper.ctype('.js'))

console.log( helper.nrand(1,23) )

for (let i = 0; i < 50; i++) {
  console.log( helper.nrand(i, 1000 - i) )
}
