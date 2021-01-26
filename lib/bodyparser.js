/**
  module bodyparser
  Copyright (C) 2019.08 BraveWang
  This program is free software; you can redistribute it and/or modify
  it under the terms of the GNU General Public License as published by
  the Free Software Foundation; either version 3 of the License , or
  (at your option) any later version.
 */

'use strict';

const qs = require('querystring');

class bodyparser {

  constructor (options = {}) {

    this.maxFiles = 15;

    this.maxFormLength = 0;

    if (typeof options === 'object') {
      for (let k in options) {
        switch (k) {
          case 'maxFiles':
            if (typeof options[k] === 'number' && options[k] >= 0) {
              this.maxFiles = options[k];
            }
            break;

          case 'maxFormLength':
            if (typeof options[k] === 'number' && options[k] > 0) {
              this.maxFormLength = options[k];
            }
            break;

        }
      }

    }

    this.pregUpload = /multipart.* boundary.*=/i;
    this.formType = 'application/x-www-form-urlencoded';

    this.methods = ['POST', 'PUT', 'PATCH', 'DELETE'];

  }

  /*
    解析上传文件数据的函数，此函数解析的是整体的文件，
    解析过程参照HTTP/1.1协议。
  */
  parseUploadData (ctx) {
    let bdy = ctx.headers['content-type'].split('=')[1];
    bdy = bdy.trim();
    bdy = `--${bdy}`;
    //var end_bdy = bdy + '--';
    let bdy_crlf = `${bdy}\r\n`;
    let crlf_bdy = `\r\n${bdy}`;
  
    let file_end = 0;
    let file_start = 0;
  
    file_start = ctx.rawBody.indexOf(bdy_crlf);
    if (file_start < 0) {
      return ;
    }
    file_start += bdy_crlf.length;

    let i=0; //保证不出现死循环或恶意数据产生大量无意义循环
    while(i < this.maxFiles) {
      file_end = ctx.rawBody.indexOf(crlf_bdy, file_start);
      if (file_end <= 0) { break; }
  
      this.parseSingleFile(ctx, file_start, file_end);
      file_start = file_end + bdy_crlf.length;
      i++;
    }
  }

  /**
   * Content-Disposition: form-data; name="NAME"; filename="FILENAME"\r\n
   * Content-Type: TYPE
   * 
   * @param {object} ctx 
   * @param {number} start_ind 
   * @param {number} end_ind 
   */
  parseSingleFile (ctx, start_ind, end_ind) {

    let header_end_ind = ctx.rawBody.indexOf('\r\n\r\n',start_ind);
  
    let header_data = ctx.rawBody.toString('utf8', start_ind, header_end_ind);
    
    let file_post = {
      filename:       '',
      'content-type': 'text/plain',
      start:  0,
      end:    0,
      length: 0,
    };
    
    file_post.start = header_end_ind+4;
    file_post.end = end_ind;
    file_post.length = end_ind - 4 - header_end_ind;

    //file data
    
    let filename_start = header_data.indexOf('"; filename="');

    if (filename_start > 0) {

      let name = '';

      let name_start_ind = header_data.indexOf('name="');
      name_start_ind += 6;

      if (filename_start > name_start_ind) {
        name = header_data.substring(name_start_ind, filename_start);
      } else {
        name = 'file';
      }

      filename_start += 13;

      let filename_end = header_data.indexOf('"\r\n', filename_start);

      file_post.filename = header_data.substring(filename_start, filename_end);
      
      //content-type

      //let ctypeind = header_data.indexOf('\r\nContent-Type:', filename_end);
      //ctypeind += 15;

      //固定格式，直接跳到Content-Type:的冒号处。
      let ctypeind = filename_end + 16;

      let ctypeend = header_data.indexOf('\r\n', ctypeind);

      if (ctypeend < 0) {
        ctypeend = header_data.length;
      }

      if (ctypeind < ctypeend) {
        file_post['content-type'] = header_data.substring(ctypeind, ctypeend).trimLeft();
      }

      if (ctx.files[name] === undefined) {
        ctx.files[name] = [ file_post ];
      } else {
        ctx.files[name].push(file_post);
      }

    } else {

      let nind = 0;
      let name = '';

      nind = header_data.indexOf('name="');
      if (nind < 0) {
        return;
      }

      if (this.maxFormLength > 0 && file_post.length > this.maxFormLength) {
        return;
      }

      //最后没有\r\n
      name = header_data.substring(nind+6, header_data.length-1)

      let name_value = ctx.rawBody.toString('utf8', file_post.start, file_post.end);

      if (name !== '') {
        if (ctx.body[ name ] === undefined) {
          ctx.body[ name ] = name_value;

        } else if (ctx.body[ name ] instanceof Array) {
          ctx.body[name].push(name_value);

        } else {
          ctx.body[name] = [ctx.body[name], name_value];
        }

      }

    }

  }

  checkUploadHeader (headerstr) {
    if (this.pregUpload.test(headerstr)) {
      return true;
    }
    return false;
  }

  middleware () {
    var self = this;

    return async (ctx, next) => {
      
      if ((typeof ctx.rawBody === 'string' || ctx.rawBody instanceof Buffer) 
        && ctx.rawBody.length > 0 && self.methods.indexOf(ctx.method) >= 0)
      {
        if (ctx.headers['content-type'] === undefined) {
          ctx.headers['content-type'] = '';
        }
        
        //if (self.checkUploadHeader(ctx.headers['content-type'])) {
        if (ctx.headers['content-type'].indexOf('multipart/form-data') === 0) {

          ctx.isUpload = true;
          self.parseUploadData(ctx, self.maxFiles);

        } else if (ctx.headers['content-type'] && ctx.headers['content-type'].indexOf(self.formType) >= 0) {
          ctx.body = qs.parse(ctx.rawBody.toString('utf8'));
          
        } else if (ctx.headers['content-type'].indexOf('text/') === 0) {
          ctx.body = ctx.rawBody.toString('utf8');
        } else {
          ctx.body = ctx.rawBody;
        }
      }

      await next();
    };
  }
}

module.exports = bodyparser;
