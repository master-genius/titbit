/**
  module bodyparser
  Copyright (C) 2019.08 BraveWang
 */

'use strict';

const {fpqs} = require('./fastParseUrl.js')

class bodyparser {

  constructor (options = {}) {

    this.maxFiles = 15;

    this.maxFormLength = 0;

    this.maxFormKey = 100;

    if (typeof options === 'object') {
      for (let k in options) {
        switch (k) {

          case 'maxFiles':
          case 'maxFormLength':
          case 'maxFormKey':
            if (typeof options[k] === 'number' && options[k] > 0) {
              this[k] = options[k];
            }
            break;

        }
      }

    }

    this.pregUpload = /multipart.* boundary.*=/i;
    this.formType = 'application/x-www-form-urlencoded';

    this.methods = ['POST', 'PUT', 'PATCH', 'DELETE'];

    this.multiLength = 'multipart/form-data'.length;

  }

  /*
    解析上传文件数据的函数，此函数解析的是整体的文件，
    解析过程参照HTTP/1.1协议。
  */
  parseUploadData (ctx) {
    //let bdy = ctx.headers['content-type'].split('=')[1];
    let ctype = ctx.headers['content-type'];

    //multipart/form-data;boundary length is 28
    let bdy = ctype.substring(ctype.indexOf('=', 28)+1);

    if (!bdy) return false;

    //bdy = bdy.trim();

    bdy = `--${bdy}`;
    
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

    while (i < this.maxFiles) {
      file_end = ctx.rawBody.indexOf(crlf_bdy, file_start);

      if (file_end <= 0) break;
  
      this.parseSingleFile(ctx, file_start, file_end);

      //\r\n--boundary\r\n
      file_start = file_end + bdy_crlf.length + 2;

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
      rawHeader: header_data
    };
    
    file_post.start = header_end_ind+4;
    file_post.end = end_ind;
    file_post.length = end_ind - 4 - header_end_ind;

    //file data
    
    let filename_start = header_data.indexOf('filename="');

    if (filename_start > 0) {

      let name = '';

      let name_start_ind = header_data.indexOf('name="');
      name_start_ind += 6;

      let name_end_ind = filename_start - 3;

      if (header_data[filename_start-1] !== ' ') {
        name_end_ind += 1;
      }

      if (name_end_ind > name_start_ind) {
        name = header_data.substring(name_start_ind, name_end_ind);
      } else {
        name = 'file';
      }

      filename_start += 10;

      let filename_end = header_data.indexOf('"\r\n', filename_start);

      //这种情况说明构造的数据格式有问题，会影响到Content-Type和filename，直接返回不再处理。
      if (filename_end < 0) return;

      file_post.filename = header_data.substring(filename_start, filename_end);
      
      //content-type

      let ctypeind = header_data.indexOf('\r\nContent-Type:', filename_end);
      
      ctypeind < 0 && (ctypeind  = header_data.indexOf('\r\nContent-type:', filename_end));

      ctypeind += 15;

      let ctypeend = header_data.indexOf('\r\n', ctypeind);

      if (ctypeend < 0) {
        ctypeend = header_data.length;
      }

      //在正确的情况下，ctypeind > filename_end
      if (ctypeind > filename_end && ctypeind < ctypeend) {
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

      /**
       * 如果构造的格式存在Content-Length等其他字段，则会有\r\n存在:
       * Content-Dispostion: form-data; name="xxx"
       * Content-Length: 123
       */
      let name_end = header_data.indexOf('"\r\n', nind)
      if (name_end < 0) {
        name_end = header_data.length-1
      }

      name = header_data.substring(nind+6, name_end)

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

  checkUploadHeader (typestr) {
    if (typestr.indexOf('multipart/form-data') === 0 
      && typestr.indexOf('boundary=', this.multiLength) > 0)
    {
      return true;
    }

    return false;
  }

  mid () {
    var self = this;

    return async (ctx, next) => {
      
      if ((typeof ctx.rawBody === 'string' || ctx.rawBody instanceof Buffer) 
        && ctx.rawBody.length > 0 
        && (ctx.method[0] === 'P' || ctx.method[0] === 'D') )
      {
        if (ctx.headers['content-type'] === undefined) {
          ctx.headers['content-type'] = '';
        }

        let ctype = ctx.headers['content-type'];
        
        if ( self.checkUploadHeader(ctype) ) {

          ctx.isUpload = true;
          self.parseUploadData(ctx, self.maxFiles);

        } else if (ctype && ctype.indexOf(self.formType) >= 0) {
          //autoDecode = true
          fpqs(ctx.rawBody.toString('utf8'), ctx.body, true, self.maxFormKey);
          
        } else if (ctype.indexOf('text/') === 0) {
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
