'use strict'

/**
 * 
 * 此函数是专门为了解析请求的路径和查询字符串部分而设计，因为url.parse在后续版本要抛弃，而URL解析后的searchParams无法和之前的程序兼容。
 * 
 * 而且，它们都很慢，做了很多无意义的工作，在http的请求过来时，url只需要关注path和querystring部分，其他都已经确定了。
 * 
 * 通过maxArgs控制最大解析的参数个数。
 * 
 * @param {*} url string
 * 
 */

function fpurl (url, autoDecode=false, fastMode=true, maxArgs=0) {

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
  let org_val
  let t

  let count = 0
  
  for (let i=0; i < args.length; i++) {

    ind = args[i].indexOf('=')

    if (ind < 0) {
      if (urlobj.query[ args[i] ] === undefined) {
        urlobj.query[ args[i] ] = ''
      }
      continue
    } else if (ind === 0) {
      continue
    }

    if (maxArgs > 0 && count >= maxArgs) {
      return urlobj
    }

    t = args[i].substring(0, ind)

    org_val = args[i].substring(ind+1)

    if (autoDecode) {
      if (org_val.length > 2 && org_val.indexOf('%') >= 0) {
        try {
          val = decodeURIComponent(org_val)
        } catch (err){
          val = org_val
        }
      } else {
        val = org_val
      }
    } else {
      val = org_val
    }

    if (fastMode) {
      if (urlobj.query[ t ] === undefined) {
        count += 1
        urlobj.query[ t ] = val
      }

    } else {

      if (urlobj.query[ t ] instanceof Array) {
        urlobj.query[ t ].push(val)
      } else {

        if (urlobj.query[ t ] !== undefined) {
          urlobj.query[ t ] = [ urlobj.query[ t ], val ]
        } else {
          count += 1
          urlobj.query[ t ] = val
        }
        
      }
    }

  }

  return urlobj
}

module.exports = fpurl

/**

for (let i=0; i < args.length; i++) {

    t = args[i].split('=')

    if (t.length == 0 || t[0] === '') {
      continue
    }
    
    if (autoDecode) {
      if (t.length > 1) {
        if (t[1].length > 2 && t[1].indexOf('%') >= 0) {
          try {
            val = decodeURIComponent(t[1])
          } catch (err){
            val = t[1]
          }
        } else {
          val = t[1]
        }
      } else {
        val = ''
      }
      
    } else {
      val = t.length > 1 ? t[1] : ''
    }

    if (fastMode) {
      if (urlobj.query[ t[0] ] === undefined) {
        urlobj.query[t[0]] = val
      }
    } else {
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

  }
 */