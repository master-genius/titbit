'use strict'

const parseurl = require('../lib/fastParseUrl').fpurl
const url = require('url')

let tmp = ''
let urls = []

for (let i = 0 ; i < 20000; i++) {
  tmp = `https://qw.e21e/x/y/z?name=hel${i+1}&a=${i}&a=${i*i+1}&age=${(i+1) % 35}&say=${encodeURIComponent('我是中国人')}`
    + `&info=${encodeURIComponent('{"sign":"12dodfos9rhoaoz","x":"1=213"}')}`
    + `&t=${encodeURIComponent('a=123&b=213')}&t=${encodeURIComponent('x=123&y=234')}&==&a=*&v=@&sdk&=123&we==`

  for (let k=0; k < 10; k++) {
    tmp += `&x=${encodeURIComponent('人民')}${k+1}%rr`
  }

  for (let k=0; k < 35; k++) {
    tmp += `&xyz${k}=${encodeURIComponent('测试')}${k+1}`
  }

  for (let k = 0; k < 50; k ++) {
    tmp += `&r=% ${k}`
  }

  tmp += '&op=123&qwe&&&===#a=123?234'

  //tmp = `https://a.qwq/xyy/qwd/qwd?x=123&b=234&c=435#123few`
  urls.push(tmp)
}

console.log(urls[0], '\n', urls[0].length)

let urlobj = []

let start_time = Date.now()

for (let i = 0; i < urls.length; i++) {
  urlobj.push(parseurl(urls[i], true, false, 20))
  //urlobj.push( new url.URL(urls[i], 'https://w3xm.cn') )
}

let end_time = Date.now()

console.log(`${urls.length}, ${end_time - start_time} ms`)

console.log(urlobj[0])
/*
for (let [k,v] of urlobj[0].searchParams) {
  console.log(k, v)
}
*/
