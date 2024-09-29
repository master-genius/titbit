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

/* let httpchar = ['h', 't', 't', 'p', ':', '/', '/']
let httpschar = ['h', 't', 't', 'p', 's',  ':', '/', '/']

let simpleCheckHttpUrl = (str) => {
  if (str.length < 7) return false

  for (let i = 0; i < 4; i++) {
    if (httpchar[i] !== str[i]) return false
  }

  if (str[4] === 's') {
    if (str[5] === ':' && str[6] === '/' && str[7] === '/') return true
  } else if (str[4] === ':') {
    if (str[5] === '/' && str[6] === '/') return true
  }

  return false
}
*/

let http_url_preg = /^https?:\/\//

/* let chararr = [
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
  'A', 'B', 'C', 'D', 'E', 'F', 'a', 'b', 'c', 'd',
  'e', 'f'
]

let charMap = {}
chararr.forEach(x => {
  charMap[x] = true
}) */

const isHexTable = new Int8Array([
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // 0 - 15
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // 16 - 31
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // 32 - 47
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, // 48 - 63
  0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, // 64 - 79
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // 80 - 95
  0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, // 96 - 111
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // 112 - 127
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // 128 ...
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,  // ... 256
]);

// %
const CHAR_PERCENT = 37

// &
const CHAR_AMPERSAND = 38

// =
const CHAR_EQUAL = 61

//这个函数没有对状态使用单独的变量标记
let is_encoded = (str) => {
  let i = 0
  let state = 0
  let code = 0
  //let start_ind = str.indexOf('%')
  //if (start_ind < 0) return false
  let isEncode = false

  for (; i < str.length; ++i) {
    //如果计数超过2说明是16进制的数字
    if (state > 2) {
      state = 0
      isEncode = true
      //return true
    }

    code = str.charCodeAt(i)
    if (state > 0) {
      //console.log(isHexTable[code], code)
      if (isHexTable[code] === 1) {
        state++
        continue
      }
      else {
        state = 0
        //这说明不是合法的编码，decodeURIComponent会出错
        return false
      }
    }

    if (code === CHAR_PERCENT) {
      state = 1
    }
  }

  return isEncode
}

function fpqs(search, obj, autoDecode=true, maxArgs=0) {
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
function fpurl(org_url, autoDecode=false, fastMode=true, maxArgs=0) {
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
  
  let ind = url.indexOf('?')
  let search = ''

  if (ind === 0) {
    urlobj.path = '/'
    search = url.substring(1)
  } else {
      if (ind > 0) {
        search = url.substring(ind+1)
        url = org_url.substring(0, ind)

        if (url[0] !== '/' && http_url_preg.test(url)) {
          let slash_index = url.indexOf('/', 8)

          //while (slash_index < ind && url[slash_index] !== '/') {slash_index++}
          
          if (slash_index >= 0) {
            urlobj.path = url.substring(slash_index)
          } else {
            urlobj.path = '/'
          }
        } else {
          urlobj.path = url
        }

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
  let and_ind = 0
  let last_ind = 0
  let val
  let org_val
  let t

  let send = search.length
  let count = 0

  while (and_ind < send) {
      if (maxArgs > 0 && count >= maxArgs) {
        break
      }

      and_ind = search.indexOf('&', last_ind)
      if (and_ind < 0) and_ind = send

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

      val = search.slice(ind+1, and_ind)

      if (autoDecode && is_encoded(val)) {
          try {
            val = decodeURIComponent(val)
          } catch (err) {
            //val = org_val
          }
      }

      if (query[t] === undefined || fastMode) {
        query[t] = val
        count++
      } else {
        if (!Array.isArray(query[t])) {
          query[t] = [ query[t] ]
        }
        query[t].push(val)
        count++
      }

      last_ind = and_ind + 1
  }

  return urlobj
}

module.exports = {
  fpurl,
  fpqs
}

/* let code = 0
  let isEncode = false
  let encodeCheck = 0
  let lastPos = 0
  let pairStart = 0
  let buf = ''
  let out = []
  let seenSep = false
  let args_count = 0
  let i = 0
  for (; i < search.length; i++) {
    if (maxArgs > 0 && args_count >= maxArgs) break
    code = search.charCodeAt(i)

    if (code === CHAR_AMPERSAND) {
      if (pairStart === i) {
        //空的匹配，比如&&连续
        lastPos = pairStart = i + 1
        continue
      }

      if (encodeCheck === 3) {
        isEncode = true
      }

      if (lastPos < i)
        buf = search.slice(lastPos, i)

      if (isEncode) {
        try {
          buf = decodeURIComponent(buf)
        } catch (err){

        }
      }
      
      out.push(buf);

      !seenSep && out.push('');

      seenSep = false
      buf = ''
      isEncode = false;
      encodeCheck = 0
      lastPos = pairStart = i + 1
      continue
    }

    // Try matching key/value separator (e.g. '=') if we haven't already
    if (!seenSep && code === CHAR_EQUAL) {
      // Key/value separator match!
      if (encodeCheck === 3) {
        isEncode = true
      }

      if (lastPos < i) buf = search.slice(lastPos, i)
      if (isEncode) {
        try {
          buf = decodeURIComponent(buf)
        } catch(err){}
      }
      
      out.push(buf)

      args_count++
      seenSep = true
      buf = ''
      isEncode = false
      encodeCheck = 0
      lastPos = i + 1
      continue
    }

      // Try to match an (valid) encoded byte (once) to minimize unnecessary
      // calls to string decoding functions
      if (code === CHAR_PERCENT) {
        encodeCheck === 0 && (encodeCheck = 1)
      }
      else if (encodeCheck > 0 && encodeCheck < 3) {
        if (isHexTable[code] === 1) {
          ++encodeCheck
        } else {
          encodeCheck = 0
        }
      }
  }

  if (pairStart !== i) {
    if (lastPos < i)
      buf = search.slice(lastPos, i)
    
    if (isEncode) {
      try {
        buf = decodeURIComponent(buf)
      } catch (err) {}
    }
    out.push(buf)
    if (!seenSep) out.push('')
    //console.log(pairStart, i, buf)
  }

  let oend = out.length-1

  for (let i = 0; i < oend; i+=2) {
    code = out[i]
    //if (!code) continue

    if (fastMode || query[code] === undefined) {
      query[code] = out[i+1]
    } else {
      if (!Array.isArray(query[code])) {
        query[code] = [ query[code], out[i+1] ]
      } else {
        query[code].push(out[i+1])
      }
    }
  }

  return urlobj */
