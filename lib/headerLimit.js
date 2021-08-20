'use strict'

/**
 * 目的在于检测消息头长度，如果没有设置则不会进行任何操作。
 * 
 * @param {object} headers 
 * @param {string} k 
 * @param {number} maxLength 
 */
module.exports = (headers, k, maxLength) => {
  
  if (!headers[k]) return;

  let h = headers[k];

  if (h.length > maxLength) headers[k] = h.substring(0, maxLength);

}