'use strict'

/**
 * 
 * 此函数是专门为了解析请求的路径和查询字符串部分而设计，因为url.parse在后续版本要抛弃，而URL解析后的searchParams无法和之前的程序兼容。
 * 
 * 而且，它们都很慢，做了很多无意义的工作，在http的请求过来时，url只需要关注path和querystring部分，其他都已经确定了。
 * 
 * 通过maxArgs控制最大解析的参数个数。
 * 
 * 为了更快的处理，fpqs和fpurl以两个独立函数的方式编写，虽然有很多代码的逻辑重复。
 * 
 * fpqs主要是针对content-type为application/x-www-form-urlencoded这种格式提供的。
 * 
 */

function fpqs (search, obj, autoDecode = true, maxArgs = 0) {

  let ind = 0
  let and_ind = 0
  let last_ind = 0
  let val
  let org_val
  let t
  let count = 0
  let send = search.length

  while ( and_ind <  send) {
      and_ind = search.indexOf('&', last_ind)
      
      if (and_ind < 0) and_ind = send

      if (maxArgs > 0 && count >= maxArgs) {
        return
      }

      if (and_ind === last_ind) {
        last_ind += 1
        continue
      }

      ind = last_ind
      
      while (ind < and_ind && search[ind] !== '=') ind += 1

      if (last_ind >= ind) {
        last_ind = and_ind + 1
        continue
      }

      t = search.substring(last_ind, ind)

      org_val = ind < and_ind ? search.substring(ind+1, and_ind) : ''

      if (autoDecode) {
        if (org_val.length > 2 && org_val.indexOf('%') >= 0) {
          try {
            val = decodeURIComponent(org_val)
          } catch (err) {
            val = org_val
          }
        } else {
          val = org_val
        }
      } else {
        val = org_val
      }

      if ( Array.isArray(obj[t]) ) {
        obj[ t ].push(val)
      } else {

        if (obj[ t ] !== undefined) {
          obj[ t ] = [ obj[ t ], val ]
        } else {
          count += 1
          obj[ t ] = val
        }
        
      }

      last_ind = and_ind + 1
  }
  
}


function fpurl (url, autoDecode=false, fastMode=true, maxArgs=0) {
  let urlobj = {
    path : '/',
    query : {},
    hash : ''
  }

  let hash_index = url.indexOf('#')

  if (hash_index >= 0) {
    urlobj.hash = url.substring(hash_index+1)
    url = url.substring(0, hash_index)
  }

  let ind = url.indexOf('?')

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

  let and_ind = 0
  let last_ind = 0
  let val
  let org_val
  let t

  let send = search.length
  let count = 0

  while ( and_ind <  send) {
      and_ind = search.indexOf('&', last_ind)
      
      if (and_ind < 0) and_ind = send

      if (maxArgs > 0 && count >= maxArgs) {
        return
      }

      if (and_ind === last_ind) {
        last_ind += 1
        continue
      }

      ind = last_ind
      
      while (ind < and_ind && search[ind] !== '=') ind += 1

      if (last_ind >= ind) {
        last_ind = and_ind + 1
        continue
      }

      t = search.substring(last_ind, ind)

      org_val = ind < and_ind ? search.substring(ind+1, and_ind) : ''

      if (autoDecode) {
        if (org_val.length > 2 && org_val.indexOf('%') >= 0) {
          try {
            val = decodeURIComponent(org_val)
          } catch (err) {
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

        if ( Array.isArray(urlobj.query[ t ]) ) {
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

      last_ind = and_ind + 1
  }

  return urlobj
}

module.exports = {
  fpurl,
  fpqs
}
