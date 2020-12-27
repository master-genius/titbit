'use strict'

const parseurl = require('../lib/fastParseUrl')
const url = require('url')

let tmp = ''
let urls = []

for (let i = 0 ; i < 100000; i++) {
  tmp = `?name=hel${i+1}&a=${i}&a=${i*i+1}&age=${(i+1) % 35}&say=${encodeURIComponent('我是中国人')}`
    + `&info=${encodeURIComponent('{"sign":"12dodfos9rhoaoz","x":"1=213"}')}`
    + `&t=${encodeURIComponent('a=123&b=213')}&t=${encodeURIComponent('x=123&y=234')}&==&a=*&v=@&sdk&=123&we==`

  for (let k=0; k < 10; k++) {
    tmp += `&x=${encodeURIComponent('人民')}${k+1}`
  }

  for (let k = 0; k < 10; k ++) {
    tmp += `&r=% ${k}`
  }

  urls.push(tmp)
}

console.log(urls[0], '\n', urls[0].length)

let urlobj = []

let start_time = Date.now()

for (let i = 0; i < urls.length; i++) {
  urlobj.push(parseurl(urls[i], true, true, 12))
  //urlobj.push( new url.URL(urls[i], 'https://w3xm.cn') )
}

let end_time = Date.now()

console.log(`${urls.length}, ${end_time - start_time} ms`)

console.log(urlobj[0])
