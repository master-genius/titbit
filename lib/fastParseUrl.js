'use strict'

/**
 * 
 * 此函数是专门为了解析请求的路径和查询字符串部分而设计，因为url.parse在后续版本要抛弃，而URL解析后的searchParams无法和之前的程序兼容。
 * 
 * 而且，它们都很慢，做了很多无意义的工作，在http的请求过来时，url只需要关注path和querystring部分，其他都已经确定了。
 * 
 * 在本机测试上（AMD R5 4500U 8G内存），10万次解析操作，new url.URL大概需要1010ms，url.parse需要886ms，此函数需要516ms。
 * 
 * 如果为了极致性能，你可以关闭autoDecodeQuery选项，这样不会进行decodeURIComponent操作，只需要大概400ms。
 * 
 * 解析字符串是包括了7个参数，包括一个同名的a要解析为数组，一个JSON字符串并进行了encodeURIComponent操作，
 * 一句中文并进行了encodeURIComponent操作，一个包括了&和=的值也进行了encodeURIComponent操作。
 * 
 * 
 * @param {*} url string
 * 
 */

function fpurl (url, autoDecode = false) {

  let ind = url.indexOf('?')

  let urlobj = {
    path : '/',
    query : {}
  }

  let search = ''

  if (ind === 0) {
    
    urlobj.path = '/'
    search = url.substring(1)

  } else if (ind > 0) {

    let split = url.split('?')

    urlobj.path = split[0]

    if (split.length > 1) {
      search = split[1]
    }

  } else {
    urlobj.path = url || '/'
    return urlobj
  }

  let args = search.split('&')
  let val
  let t
  
  for (let i=0; i < args.length; i++) {

    t = args[i].split('=')

    if (t.length == 0 || t[0] === '') {
      continue
    }
    
    if (autoDecode) {
      val = t.length > 1 ? (t[1].indexOf('%') >= 0 ? decodeURIComponent(t[1]) : t[1]) : ''
    } else {
      val = t.length > 1 ? t[1] : ''
    }

    if (urlobj.query[ t[0] ] instanceof Array) {
      
      urlobj.query[ t[0] ].push(val)

    } else {

      if (urlobj.query[ t[0] ] !== undefined) {
        urlobj.query[ t[0] ] = [ urlobj.query[ t[0] ], val ]
      } else {
        urlobj.query[t[0]] = val
      }
      
    }
  }

  return urlobj

}

module.exports = fpurl
