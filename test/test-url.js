'use strict'

const parseurl = require('../lib/fastParseUrl')

let tmp = ''
let urls = []

for (let i = 0 ; i < 100000; i++) {
  tmp = `?name=hel${i+1}&a=${i}&a=${i*i+1}&age=${(i+1) % 35}&say=${encodeURIComponent('我是中国人')}`
    + `&info=${encodeURIComponent('{"sign":"12dodfos9rhoaoz","x":"1=213"}')}`
    + `&t=${encodeURIComponent('a=123&b=213')}&t=${encodeURIComponent('x=123&y=234')}&==&a=*&v=@`

  urls.push(tmp)
}

let urlobj = []

let start_time = Date.now()

for (let i = 0; i < urls.length; i++) {
  urlobj.push(parseurl(urls[i], true))
}

let end_time = Date.now()

console.log(`${urls.length}, ${end_time - start_time} ms`)

console.log(urlobj[0])

