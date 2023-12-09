'use strict'

/**
 * 
 * 此函数是专门为了解析请求的路径和查询字符串部分而设计，因为url.parse在后续版本要抛弃，而URL解析后的searchParams无法和之前的程序兼容。
 * 
 * 
 * 通过maxArgs控制最大解析的参数个数。
 * 
 * 为了更快的处理，fpqs和fpurl以两个独立函数的方式编写，虽然有很多代码的逻辑重复。
 * 
 * fpqs主要是针对content-type为application/x-www-form-urlencoded这种格式提供的。
 * 
 */

let http_url_preg = /^https?:\/\//

let chararr = [
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
  'A', 'B', 'C', 'D', 'E', 'F', 'a', 'b', 'c', 'd',
  'e', 'f'
]

let charMap = {}
chararr.forEach(x => {
  charMap[x] = true
})

//这个函数没有对状态使用单独的变量标记
let is_encoded = (str) => {
  let i = 0
  let state = 0

  for (i=0; i < str.length; ++i) {
    //如果计数超过2说明是16进制的数字
    if (state > 2) return true

    if (state > 0) {
      if (charMap[str[i]]) {
        state++
        continue
      }
      else state = 0
    }

    if (str[i] === '%') {
      state = 1
    } else {
      state = 0
    }
  }

  return false
}

function fpqs (search, obj, autoDecode=true, maxArgs=0) {
  let ind = 0
  let and_ind = 0
  let last_ind = 0
  let val
  let org_val
  let t
  let count = 0
  let send = search.length

  while (and_ind < send) {
      and_ind = search.indexOf('&', last_ind)
      
      if (and_ind < 0) and_ind = send

      if (maxArgs > 0 && count >= maxArgs) {
        return
      }

      if (and_ind === last_ind) {
        last_ind++
        continue
      }

      ind = last_ind
      
      while (ind < and_ind && search[ind] !== '=') ind++

      if (last_ind >= ind) {
        last_ind = and_ind + 1
        continue
      }

      t = search.substring(last_ind, ind)

      org_val = ind < and_ind ? search.substring(ind+1, and_ind) : ''

      if (autoDecode) {
        if (org_val.length > 2 && is_encoded(org_val)) {
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

      if (Array.isArray(obj[t])) {
        obj[ t ].push(val)
      } else {
        if (obj[ t ] !== undefined) {
          obj[ t ] = [ obj[ t ], val ]
        } else {
          count++
          obj[ t ] = val
        }
      }

      last_ind = and_ind + 1
  }
  
}

/**
 *
 * @param {string} org_url
 *  url可能是完整的格式，一般来说是/开始的路径，这两种都是协议允许的格式。
 *
 * */
function fpurl (org_url, autoDecode=false, fastMode=true, maxArgs=0) {
  let urlobj = {
    path : '/',
    query : {},
    hash : ''
  }

  let hash_index = org_url.indexOf('#')
  let url = org_url

  if (hash_index >= 0) {
    urlobj.hash = org_url.substring(hash_index+1)
    url = org_url.substring(0, hash_index)
    org_url = url
  }
  
  let ind = org_url.indexOf('?')
  let search = ''

  if (ind === 0) {
    urlobj.path = '/'
    search = org_url.substring(1)
  } else {
      if (ind > 0) {
        url = org_url.substring(0, ind)

        if (url[0] !== '/' && http_url_preg.test(url)) {
          let slash_index = 8

          while (slash_index < ind && url[slash_index] !== '/') {slash_index++}
          
          if (slash_index < ind) {
            urlobj.path = url.substring(slash_index)
          } else {
            urlobj.path = '/'
          }
        } else {
          urlobj.path = url
        }

        search = org_url.substring(ind+1)
      } else {
        if (url[0] !== '/' && http_url_preg.test(url)) {
          let slash_index = url.indexOf('/', 8)
          slash_index > 0 && (urlobj.path = url.substring(slash_index))
          slash_index < 0 && (urlobj.path = '/')
        } else {
          urlobj.path = url || '/'
        }
        return urlobj
      }
  }

  let query = urlobj.query

  /*
  let spr = new URLSearchParams(search)
  for (let [k, v] of spr) {
    if (query[k] === undefined || fastMode) {
      query[k] = v
    } else {
      if (!Array.isArray(query[k])) {
        query[k] = [query[k]]
      }
      query[k].push(v)
    }
  }

  return urlobj
  */

  let and_ind = 0
  let last_ind = 0
  let val
  let org_val
  let t

  let send = search.length
  let count = 0

  while (and_ind < send) {
      and_ind = search.indexOf('&', last_ind)
      if (and_ind < 0) and_ind = send

      if (maxArgs > 0 && count >= maxArgs) {
        break
      }

      if (and_ind === last_ind) {
        last_ind++
        continue
      }

      ind = last_ind
      
      while (ind < and_ind && search[ind] !== '=') ind++

      if (last_ind >= ind) {
        last_ind = and_ind + 1
        continue
      }

      t = search.substring(last_ind, ind)

      org_val = search.slice(ind+1, and_ind)

      if (autoDecode && is_encoded(org_val)) {
          try {
            val = decodeURIComponent(org_val)
          } catch (err) {
            val = org_val
          }
      } else {
        val = org_val
      }

      if (query[t] === undefined || fastMode) {
        query[t] = val
        count++
      } else {
        if (!Array.isArray(query[t])) {
          query[t] = [ query[t] ]
        }
        query[t].push(val)
      }

      last_ind = and_ind + 1
  }

  return urlobj
}

module.exports = {
  fpurl,
  fpqs
}

