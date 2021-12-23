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

module.exports = (name, val, config, options) => {

  if (options.type) {
    if (options.type === 'array' && !Array.isArray(val)) return false
  
    if (typeof val !== options.type) return false
  }

  if (options.list && Array.isArray(options.list)) {
    if (options.list.indexOf(val) < 0) return false
  }
  else if (options.min !== undefined || options.max !== undefined) {
    if (options.min !== undefined && options.min > val) return false
    if (options.max !== undefined && options.max < val) return false
  }

  config[name] = val

  return true
}
