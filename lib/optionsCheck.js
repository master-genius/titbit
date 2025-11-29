'use strict'

/**
 * 
 * @param {string} name 选项名称
 * @param {any} val 输入值
 * @param {object} config 配置
 * @param {object} options 选项，给出限定范围，包括：   
 *    min, max, list, type
 * 
 */

function delayOutError(errinfo) {
  setTimeout(() => {
    console.error(`\x1b[33;7m${errinfo}\x1b[0m`);
  }, 1200);
}

module.exports = (name, val, config, options) => {

  if (options.type) {
    if (options.type === 'array' && !Array.isArray(val)) {
      delayOutError(`config ${name} 不符合类型约束，必须是数组。`);
      return false
    }
  
    let vt = typeof val

    if (Array.isArray(val)) vt = 'array'
    else if (val instanceof Set) vt = 'set'
    else if (val instanceof Map) vt = 'map'
  
    if (Array.isArray(options.type)) {
      if (options.type.indexOf(vt) < 0) {
        delayOutError(`config ${name} 不符合类型约束，可以是${options.type.join()}之一，请检查。`);
        return false
      }
    } else if (vt !== options.type) {
      delayOutError(`config ${name} 不符合类型约束，要求必须是${options.type}类型。`);
      return false
    }
  }

  if (options.list && Array.isArray(options.list)) {
    if (options.list.indexOf(val) < 0) return false
  } else if (options.min !== undefined || options.max !== undefined) {
    if (options.min !== undefined && options.min > val) return false
    if (options.max !== undefined && options.max < val) return false
  }

  config[name] = val

  return true
}