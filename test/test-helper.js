'use strict'

const helper = require('../lib/helper')

let key = '123456789012345678900987654321qw'

let data = JSON.stringify({
  name : '简单的机械键盘',
  age : 30
})

let cryptData = helper.aesEncrypt(data, key)

console.log('aes decrypt: ', helper.aesDecrypt(cryptData, key))

console.log('timestr: ', helper.timestr() )

console.log('make name: ', helper.makeName('aswe.jpg'))

console.log('uuid: ', helper.uuid())

console.log(helper.ctype('.jppe'))

console.log(helper.ctype('.jpg'))

console.log(helper.ctype('.js'))

console.log('hmacsha1: ', helper.hmacsha1('12345', '123456', 'base64'))

for (let i = 0; i < 5; i++) {
  console.log( helper.nrand(i, 1000 - i) )
}
