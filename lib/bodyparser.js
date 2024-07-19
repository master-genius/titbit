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

//content-disposition，此格式定义了三个参数：inline、attachment、form-data
//attachment用于下载，form-data用于上传，多个参数用;分割，name和filename必须要有引号包含。
//一个非常操蛋的问题是，name和filename属性值都是可能包含;的，而且浏览器也不会对;进行转义。 
//这种看起来不是很复杂的格式其实带来了很多问题，因为属性的值是未知的，在长期的实践中遇到过各种情况。

'use strict';

const {fpqs} = require('./fastParseUrl.js')

class Bodyparser {

  constructor(options = {}) {

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

    this.formdataLength = 'form-data'.length;
    this.formdataBorder = [' ', ';', '"', "'"];
  }

  /*
    解析上传文件数据的函数，此函数解析的是整体的文件，
    解析过程参照HTTP/1.1协议。
  */
  parseUploadData(ctx) {
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
  parseSingleFile(ctx, start_ind, end_ind) {
    let header_end_ind = ctx.rawBody.indexOf('\r\n\r\n',start_ind);
    let headerlength = header_end_ind - start_ind;
    if (headerlength > this.maxHeaderSize) {
      return false;
    }
    let header_data = ctx.rawBody.toString('utf8', start_ind, header_end_ind);
    
    let data_start = header_end_ind+4;
    //let data_end = end_ind;
    let data_length = end_ind - 4 - header_end_ind;

    //file data
    //let headerlist = header_data.split('\r\n');
    let headers = {};
    let colon_index;
    let crlf_indstart = 0;
    //绝对不可能一两个字符就开始换行，第一行必须是content-disposition: xxx
    let crlf_ind = header_data.indexOf('\r\n', 1);
    let hcount = 0;
    let hstr = '';
    if (crlf_ind < 0) {
      colon_index = header_data.indexOf(':');
      colon_index > 0 && (
        headers[ header_data.substring(0, colon_index).trim().toLowerCase() ] = header_data.substring(colon_index+1).trim()
      );
    } else {
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

    let cdpobj = this.parseFormData(cdps);
    if (!cdpobj) return false;

    if (cdpobj.filename !== undefined) {
        let file_post = {
          filename: cdpobj.filename,
          'content-type': headers['content-type'] || 'application/octet-stream',
          start:  data_start,
          end:    end_ind,
          length: data_length,
          headers: headers,
          rawHeader: header_data
        };

        let slash_index = file_post.filename.lastIndexOf('/');
        if (slash_index >= 0) {
          file_post.filename = file_post.filename.substring(slash_index+1);
        }

        //content-type
        file_post.type = file_post['content-type'];
        let upload_name = cdpobj.name || 'file';

        if (ctx.files[upload_name] === undefined) {
          ctx.files[upload_name] = [ file_post ];
        } else {
          ctx.files[upload_name].push(file_post);
        }

    } else {
        //不支持子multipart格式
        if (headers['content-type'] && headers['content-type'].indexOf('multipart/mixed') === 0) {
          return false;
        }

        if (this.maxFormLength > 0 && data_length > this.maxFormLength) {
          return false;
        }

        let name = cdpobj.name;

        if (name) {
            let name_value = ctx.rawBody.toString('utf8', data_start, end_ind);
            if (ctx.body[name] === undefined) {
              ctx.body[name] = name_value;

            } else if (Array.isArray(ctx.body[name])) {
              ctx.body[name].push(name_value);
            } else {
              ctx.body[name] = [ctx.body[name], name_value];
            }
        }
    }

  }

  parseFormData(cdps) {
      let rk = this.formdataLength
      if (cdps.substring(0, rk) !== 'form-data') return false;
      while (cdps[rk] === ';' || cdps[rk] === ' ') rk++

      let cdpobj = {}
      let cindex = 0
      let statestr = cdps.substring(rk)
      let cstart=0, i, k, q=''
      let kname = ''
      let eq_break = false
      let real_index = 0

      let state_length = statestr.length
  
      while (cindex < state_length) {
          //cindex = statestr.indexOf('=', cindex)
          //if (cindex < 0) break
          eq_break = false
          real_index = 0
          while (cindex < state_length) {
            switch (statestr[cindex]) {
              case ';':
                cindex++
                while(statestr[cindex] === ' ' && cindex < state_length) cindex++
                cstart = cindex
                break

              //cstart是从一个非空字符开始的
              case ' ':
                ;(real_index <= 0) && (real_index = cindex)
                cindex++
                break

              case '=':
                eq_break = true
                break

              default:
                real_index > 0 && (real_index = 0)
                cindex++
                break
            }

            if (eq_break) break
          }

          if (cindex >= state_length) break

          i = cindex + 1
          while (statestr[i] === ' ' && i < state_length) i++

          kname = statestr.substring(cstart, real_index || cindex)
          //kname = statestr.substring(cstart, cindex).trimEnd()
          if (!kname) {cindex=i;cstart=cindex;continue}

          if (i >= state_length) {
            //说明还是有=，但是后续没有赋值
            cdpobj[kname] = ''
            break
          }

          q = statestr[i]
  
          if (q === ';') {
            k = i
            //name= 说明没有数据的值
            cdpobj[kname] = ''
            k++
          } else if (q) {
              if (q === '"' || q === "'") {
                i++
              } else {q = ''}
              k = i
              while (k < state_length) {
                //有可能就是携带\\，引号应该被转义。
                //if (statestr[k] === '\\') k+=2
  
                if ( (q && statestr[k] === q)
                    || (!q && (statestr[k] === ';' || statestr[k] === ' ')) )
                {
                  cdpobj[kname] = statestr.substring(i, k)
                  k++
                  break
                }
                k++
              }
              //如果到了字符串末尾但是还没有设置值
              if (!cdpobj[kname] && k === state_length) {
                cdpobj[kname] = statestr.substring(i, k)
                break
              }
          }/*  else if (!q) {
            break
          } */
  
          cindex = k
          while (cindex < state_length
            && (statestr[cindex] === ' '
                || statestr[cindex] === ';'
                || statestr[cindex] === '"'
                || statestr[cindex] === "'"
              )
          ) { cindex++ }
  
          cstart = cindex
      }
  
      return cdpobj
  }

  checkUploadHeader(typestr) {
    if (typestr.indexOf('multipart/form-data') === 0 
      && (typestr.indexOf('boundary=', this.multiLength) > 0 
        || typestr.indexOf('boundary =', this.multiLength) > 0))
    {
      return true;
    }

    return false;
  }

  mid() {
    let self = this;
    let json_length = ('application/json').length;
    let json_next = [' ', ';'];

    return async (ctx, next) => {
      let m1 = ctx.method[0]
      
      if ((m1 === 'P' || m1 === 'D') && ctx.rawBody && (ctx.rawBody instanceof Buffer || typeof ctx.rawBody === 'string'))
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

module.exports = Bodyparser;
