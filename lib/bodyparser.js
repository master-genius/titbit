/**
  module bodyparser
  Copyright (C) 2019.08 BraveWang
 */

/**
 * 有可能存在content-type，不存在filename，这种情况，其实是子multipart，需要再次解析。
 * 但是此出不做处理，只做单层解析。
  Content-type: multipart/form-data, boundary=AaB03x
  --AaB03x
  content-disposition: form-data; name="field1"
  Joe Blow
  --AaB03x
  content-disposition: form-data; name="pics"
  Content-type: multipart/mixed, boundary=BbC04y
  --BbC04y
  Content-disposition: attachment; filename="file1.txt"
  Content-Type: text/plain
  ... contents of file1.txt ...
  --BbC04y
  Content-disposition: attachment; filename="file2.gif"
  Content-type: image/gif
  Content-Transfer-Encoding: binary
  ...contents of file2.gif...
  --BbC04y--
  --AaB03x--
*/

'use strict';

const {fpqs} = require('./fastParseUrl.js')

class bodyparser {

  constructor (options = {}) {

    this.maxFiles = 15;

    this.maxMultipartHeaders = 9;

    //multipart 最大消息头绝对不可能超过此值。
    //考虑到一些附属的消息头比如content-length、content-encoding等加上文件名最大长度。
    //一般极端情况长度不会超过1000，超过此值，则几乎可以肯定是错误的数据或恶意请求。
    this.maxHeaderSize = 1024;

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

    bdy = bdy.trim();

    bdy = `--${bdy}`;
    
    let bdy_crlf = `${bdy}\r\n`;
    let crlf_bdy = `\r\n${bdy}`;
  
    let file_end = 0;
    let file_start = 0;
  
    file_start = ctx.rawBody.indexOf(bdy_crlf);
    if (file_start < 0) {
      return ;
    }
    let bdycrlf_length = bdy_crlf.length;
    file_start += bdycrlf_length;

    let i=0; //保证不出现死循环或恶意数据产生大量无意义循环

    while (i < this.maxFiles) {
      file_end = ctx.rawBody.indexOf(crlf_bdy, file_start);

      if (file_end <= 0) break;
  
      this.parseSingleFile(ctx, file_start, file_end);

      //\r\n--boundary\r\n
      file_start = file_end + bdycrlf_length + 2;

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
    let headerlength = header_end_ind - start_ind;
    if (headerlength > this.maxHeaderSize) {
      return false;
    }
    
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
    //let headerlist = header_data.split('\r\n');
    let headers = {};
    let colon_index;
    let crlf_indstart = 0;
    //绝对不可能一两个字符就开始换行，第一行必须是content-disposition: xxx
    let crlf_ind = header_data.indexOf('\r\n', 1);
    let hcount = 0;
    let hstr = '';
    if (crlf_ind < 0) crlf_ind = headerlength;

    while (crlf_ind > crlf_indstart && hcount < this.maxMultipartHeaders) {
      hstr = header_data.substring(crlf_indstart, crlf_ind);
      colon_index = hstr.indexOf(':');
      hcount++;
      
      colon_index > 0 && (
        headers[ hstr.substring(0, colon_index).trim().toLowerCase() ] = hstr.substring(colon_index+1).trim()
      );

      crlf_indstart = crlf_ind;
      if (crlf_ind < headerlength) {
        crlf_ind = header_data.indexOf('\r\n', crlf_ind+3);
        crlf_ind < 0 && (crlf_ind = headerlength);
      }
    }
    /*
    let colon_index = 0;
    let hline = '';
    for (let i = 0; i < headerlist.length && i < this.maxMultipartHeaders; i++) {
      hline = headerlist[i];
      colon_index = hline.indexOf(':');
      if (colon_index < 0) continue;
      headers[hline.substring(0, colon_index).trim().toLowerCase()] = hline.substring(colon_index+1).trim();
    }*/
    
    let cdps = headers['content-disposition'];
    if (!cdps) return false;

    let filename_start = cdps.indexOf('filename="');
    let fleng = 10;

    if (filename_start > 0) {
      let name = '';

      let name_start_ind = cdps.indexOf('name="');
      name_start_ind += 6;

      let name_end_ind = filename_start - 3;

      if (cdps[filename_start-1] !== ' ') {
        name_end_ind += 1;
      }

      if (name_end_ind > name_start_ind) {
        name = cdps.substring(name_start_ind, name_end_ind);
      } else {
        name = 'file';
      }

      filename_start += 10;

      let filename_end = cdps.length - 1;

      file_post.filename = cdps.substring(filename_start, filename_end);
      if (file_post.filename.indexOf('/') >= 0) {
        let farr = file_post.filename.trim().split('/');
        file_post.filename = farr[farr.length - 1];
      }
      //content-type

      file_post['content-type'] = headers['content-type'] || 'application/octet-stream';
      file_post.type = file_post['content-type'];
      file_post.headers = headers;

      if (ctx.files[name] === undefined) {
        ctx.files[name] = [ file_post ];
      } else {
        ctx.files[name].push(file_post);
      }

    } else {
      //不支持子multipart格式
      if (headers['content-type'] && headers['content-type'].indexOf('multipart/mixed') === 0) {
        return false;
      }

      let nind = 0;
      let name = '';
      let nleng = 6;

      nind = cdps.indexOf('name="');
      if (nind < 0) {
        nind = cdps.indexOf('name = "');
        if (nind < 0) return false;
        else nleng = 8;
      }

      if (this.maxFormLength > 0 && file_post.length > this.maxFormLength) {
        return false;
      }

      /**
       * 如果构造的格式存在Content-Length等其他字段，则会有\r\n存在:
       * Content-Dispostion: form-data; name="xxx"
       * Content-Length: 123
       */
      let name_end = cdps.length - 1;

      name = cdps.substring(nind + nleng, name_end);

      let name_value = ctx.rawBody.toString('utf8', file_post.start, file_post.end);

      if (name !== '') {
        if (ctx.body[ name ] === undefined) {
          ctx.body[ name ] = name_value;

        } else if (Array.isArray(ctx.body[name])) {
          ctx.body[name].push(name_value);

        } else {
          ctx.body[name] = [ctx.body[name], name_value];
        }

      }

    }

  }

  checkUploadHeader (typestr) {
    if (typestr.indexOf('multipart/form-data') === 0 
      && (typestr.indexOf('boundary=', this.multiLength) > 0 
        || typestr.indexOf('boundary =', this.multiLength) > 0))
    {
      return true;
    }

    return false;
  }

  mid () {
    let self = this;
    let json_length = ('application/json').length;
    let json_next = [' ', ';'];

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

        } else if (ctype === 'application/json'
            || (ctype.indexOf('application/json') === 0 && json_next.indexOf(ctype[json_length])>=0 ) )
        {
          //有可能会传递application/jsonb等其他json*的格式。
          try {
            ctx.body = JSON.parse( ctx.rawBody.toString('utf8') );
          } catch (err) {
            return ctx.status(400).send('bad json data');
          }
        } else {
          ctx.body = ctx.rawBody;
        }
      }

      await next();
    };
  }
}

module.exports = bodyparser;
