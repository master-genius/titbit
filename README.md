
# titbit

> titbit是运行于服务端的Web框架，最开始主要用于教学，后来很快用在了一些业务系统上。

Node.js的Web开发框架，同时支持HTTP/1.1和HTTP/2协议， 提供了强大的中间机制。


核心功能：

* 中间件模式
* 路由分组/中间件按照路由分组执行
* 中间件匹配请求方法和路由来执行
* 开启守护进程：使用cluster模块
* 显示子进程负载情况
* 提供了解析body数据模块
* 支持通过配置启用HTTP/1.1或是HTTP/2服务
* 支持配置启用HTTPS服务（HTTP/2服务必须要开启HTTPS）
* 限制请求数量
* 限制一段时间内单个IP的最大访问次数
* IP黑名单和IP白名单
* 在daemon模式，监控子进程超出最大内存限制则重启。

框架在初始化会自动检测内存大小并设定相关上限，你可以在初始化后，通过更改secure中的属性来更改限制，这需要你使用daemon接口，也就是使用master管理子进程的模式。

```

var app = new titbit();

//最大内存设定为500M，但是只有在连接数为0时才会自动重启。
//这个值和diemem都是针对heap（堆）的。
app.secure.maxmem = 500000000;

//必须要重启的最大内存上限设定为600M
//这个值一般要比maxmem大，当内存使用超过maxmem设置的值，
//但是连接不为0，这时候如果继续请求超过diemem设置的值，则会直接重启进程。
app.secure.diemem = 600000000;

//最大内存使用设置为2G
//注意这是总的内存使用，包括你用Buffer申请的内存。
app.secure.maxrss = 2000000000;

```

**注意，这需要你开启showLoadInfo选项，这是默认开启的，除非你设置为false**

在服务始化时，会根据系统的可用内存来进行自动的设置，除非你必须要自己控制，否则最好是使用默认的配置。


## !注意

请使用最新版本。

## 安装

```
npm i titbit
```

## 最小示例

``` JavaScript
'use strict';

const titbit = require('titibit');

var app = new titbit();

var {router} = app;

router.get('/', async c => {
  //data类型为string|Buffer
  //其等效形式为c.res.body = 'success';
  //同时可以设置c.res.encoding为返回数据的编码格式，默认为'utf8'。
  c.res.body = 'success'; //返回字符串
});

//默认监听0.0.0.0，参数和原生接口listen一致。
app.run(2019);

```

## 获取URL参数和表单数据

``` JavaScript
'use strict';

const titbit = require('titbit');

var app = new titbit();

var {router} = app;

router.get('/q', async c => {
  //URL中?后面的查询字符串解析到query中。
  c.res.body = c.query; //返回JSON文本，主要区别在于header中content-type为text/json
});

router.post('/p', async c => {
  //POST、PUT提交的数据保存到body，如果是表单则会自动解析，否则只是保存原始文本值，
  //可以使用中间件处理各种数据。
  c.res.body = c.body;
});

app.run(2019);

```

## 路由参数

``` JavaScript
app.get('/:name/:id', async c => {
  //使用:表示路由参数，请求参数被解析到c.param
  let username = c.param.name;
  let uid = c.param.id;
  c.res.body = `${username} ${id}`;
});
app.run(8000);
```

## 上传文件

默认会解析上传的文件，你可以在初始化服务的时候，传递parseBody选项关闭它，关于选项后面有详细的说明。
解析后的文件数据在c.files中存储，想知道具体结构请往下看。

``` JavaScript
'use strict';

const titbit = require('titbit');

var app = new titbit();

var {router} = app;

//添加中间件过滤上传文件的大小，后面有中间件详细说明。
//第二个参数表示只针对POST请求，并且路由命名为upload-image路由执行。
app.use(async (c, next) => {
  //解析后的文件在c.files中存储，通过getFile可以方便获取文件数据。
  let upf = c.getFile('image');
  if (!upf) {
    c.res.body = 'file not found';
    return ;
  } else if (upf.data.length > 2000000) {
    c.res.body = 'max file size: 2M';
    return ;
  }
  await next();

}, {method: 'POST', name: 'upload-image'});

router.post('/upload', async c => {
  let f = c.getFile('image');
  //此函数是助手函数，配合解析后的文件使用。
  //会自动生成文件名。
  try {
    c.res.body = await c.moveFile(f, {
      path: process.env.HOME + '/tmp/image'
    });
  } catch (err) {
    c.res.body = err.message;
  }
}, 'upload-image'); //给路由命名为upload-image，可以在c.name中获取。

app.run(2019);

```

## c.files数据结构

```

{
  "image" : [
    {
      'content-type': CONTENT_TYPE,
      filename: ORIGIN_FILENAME,
      start : START,
      end   : END,
      length: LENGTH
    },
    ...
  ],

  "video" : [
    {
      'content-type': CONTENT_TYPE,  //文件类型
      filename: ORIGIN_FILENAME //原始文件名
      start : START, //ctx.rawBody开始的索引位置
      end   : END,   //ctx.rawBody结束的索引位置
      length: LENGTH,  //文件长度，字节数
    },
    ...
  ]
}
```
c.getFile就是通过名称索引，默认索引值是0，如果是一个小于0的数字，则会获取整个文件数组，没有返回null。

## 中间件

中间件是一个很有用的模式，不同语言实现起来多少还是有些区别的，这个框架采用了一个有些不同的设计，并没有参考其他代码，当初是独自设计出来的，目前来说运行还很好。

中间件图示：

![](images/middleware.jpg)

此框架的中间件在设计层面上，按照路由分组区分，也可以识别不同请求类型，确定是否执行还是跳过到下一层，所以速度非常快，而且多个路由和分组都具备自己的中间件，相互不冲突，也不会有无意义的调用。参考形式如下：

``` JavaScript

/*
  第二个参数可以不填写，表示全局开启中间件。
  现在第二个参数表示：只对POST请求方法才会执行，并且路由分组必须是/api。
  基于这样的设计，可以保证按需执行，不做太多无意义的操作。
*/
app.add(async (c, next) => {
    console.log('before');
    await next();
    console.log('after');
}, {method: 'POST', group: '/api'});

```

为了提供容易理解的逻辑，提供use接口添加中间件，使用use添加的中间件按照添加顺序执行，同时还支持add接口添加的则是采用标准的洋葱模型，按照添加的顺序逆序执行，这两种方式，包括PHP、Python、Node.js在内，不同框架都有使用，开发者根据习惯和需要决定如何使用，不过从设计完成后，这两种方式可以综合使用，只是比较复杂，不建议这样做。

**建议你最好只使用use来添加中间件。**


## pre 在接收body数据之前

使用pre接口添加的中间件和use添加的主要区别就是会在接收body数据之前执行。可用于在接收数据之前的权限过滤操作。其参数和use一致。

为了一致的开发体验，你可以直接使用use接口，只需要在选项中通过pre指定：

```
let setbodysize = async (c, next) => {
    //设定body最大接收数据为~10k。
    c.maxBody = 10000;
    await next();
};

//等效于app.pre(setbodysize);
app.use(setbodysize, {pre: true});

```

使用pre可以进行更复杂的处理，并且可以拦截并不执行下一层，比如doio-proxy利用这个特性直接实现了高性能的代理服务，并且只是框架的一个扩展。其主要操作就是在这一层，直接设置了request的data事件来接收数据，并作其他处理，之后直接返回。


## 配置选项

应用初始化，完整的配置选项如下

``` JavaScript
  {
    //此配置表示POST/PUT提交表单的最大字节数，也是上传文件的最大限制。
    maxBody   : 8000000,

    //最大解析的文件数量
    maxFiles      : 12,

    daemon        : false, //开启守护进程

    /*
      开启守护进程模式后，如果设置路径不为空字符串，则会把pid写入到此文件，可用于服务管理。
    */
    pidFile       : '',

    //开启HTTPS
    https       : false,

    http2   : false,

    //HTTPS密钥和证书的文件路径，如果设置了路径，则会自动设置https为true。
    key   : '',
    cert  : '',

    //服务器选项都写在server中，在初始化http服务时会传递，参考http2.createSecureServer、tls.createServer
    server : {
      handshakeTimeout: 7168, //TLS握手连接（HANDSHAKE）超时
      //sessionTimeout: 350,
    },

    //设置服务器超时，毫秒单位，在具体的请求中，可以再设置请求的超时。
    timeout   : 18000,

    debug     : false,

    //忽略路径末尾的 /
    ignoreSlash: true,

    //启用请求限制
    useLimit: false,

    //最大连接数，0表示不限制
    maxConn : 1024,

    //单个IP单位时间内的最大连接数，0表示不限制
    maxIPRequest: 0,

    //单位时间，默认为1秒
    peerTime : 1,

    // 请求处理的钩子函数，如果设定了，在请求开始，回调函数中会执行此函数，
    // 在这里你可以设定一些事件处理函数，最好仅做这些或者是其他执行非常快的任务，可以是异步的。
    //在http/1.1协议中，传递参数就是request，response以及protocol表示协议的字符串'http:' 或者 'https:'
    //在http/2协议中，传递stream参数。

    requestHandle : null,


    //404要返回的数据
    notFound: 'Not Found',
    
    //400要返回的数据
    badRequest : 'Bad Request',

    //展示负载信息，需要通过daemon接口开启cluster集群模式
    showLoadInfo : true,

    //负载信息的类型，text 、json、--null
    //json类型是给程序通信使用的，方便接口开发
    loadInfoType : 'text',

    //负载信息的文件路径，如果不设置则输出到终端，否则保存到文件
    loadInfoFile : '',

  };
  // 对于HTTP状态码，在这里仅需要这两个，其他很多是可以不必完整支持，并且你可以在实现应用时自行处理。
  // 因为一旦能够开始执行，就可以通过运行状态返回对应的状态码。
  // 而在这之前，框架还在为开始执行洋葱模型做准备，不过此过程非常快。

```

### 请求上下文

请求上下文就是一个封装了各种请求数据的对象。通过这样的设计，把HTTP/1.1 和 HTTP/2协议的一些差异以及Node.js版本演进带来的一些不兼容做了处理，出于设计和性能上的考虑，对于HTTP2模块，封装请求对象是stream，而不是http模块的IncomingMessage和ServerResponse（封装对象是request和response）。

``` JavaScript

    var ctx = {

      version : '1.1', //协议版本
      
      maxBody : 0, //最大body请求数据量

      method    : '', //请求类型

      ip      : '', //客户端IP

      host    : '', 
      
      port    : 0,
      
      protocol: '', //协议

      //实际的访问路径
      path    : '',

      name    : '', //对路由和请求的命名
      
      headers   : {},

      //实际执行请求的路径，是添加到路由模块的路径
      routepath   : '', 

      //路由参数
      param     : {},

      //url的querystring参数，就是url 的 ? 后面的参数
      query     : {},

      //请求体解析后的数据
      body    : {},

      //是否是上传文件的操作
      isUpload  : false,

      //路由分组
      group     : '',
      
      //原始body数据
      rawBody   : '',

      //body数据接收到的总大小
      bodyLength  : 0,

      //解析后的文件信息，实际的文件数据还在rawBody中，这里只记录信息。
      files     : {},

      // 指向实际请求的回调函数，就是通过app.get等接口添加的回调函数。
      // 你甚至可以在执行请求过程中，让它指向一个新的函数，这称为请求函数重定向。
      exec : null,

      //助手函数，包括aes加解密、sha1、sha256、sha512、格式化时间字符串、生成随机字符串等处理。
      helper    : helper,

      //要返回数据和编码的记录
      res : {
        body : '',
        encoding : 'utf8',
      },
  
      //http模块请求回调函数传递的参数被封装到此。
      //在http2协议中，没有这两项。
      request   : null,
      response  : null,

      //只有在http2模块才有此项。
      stream : null,
  
      //中间件执行时挂载到此处的值可以传递到下一层。
      box : {},

      //app运行时，最开始通过addService添加的服务会被此处的service引用。
      //这称为依赖注入，不必每次在代码里引入。
      service:null,
    };

    ctx.send = (d) => {
      ctx.res.body = d;
    };

    ctx.getFile = (name, ind = 0) => {
      if (ind < 0) {return ctx.files[name] || [];}
  
      if (ctx.files[name] === undefined) {return null;}
      
      if (ind >= ctx.files[name].length) {return null;}
  
      return ctx.files[name][ind];
    };
  
    ctx.setHeader = (name, val) => {
      ctx.response.setHeader(name, val);
    };
 
    ctx.status = (stcode = null) => {
      if (stcode === null) { return ctx.response.statusCode; }
      if(ctx.response) { ctx.response.statusCode = stcode; }
    };

    //上传文件时，写入数据到文件的助手函数。
    ctx.moveFile = async (upf, target) => {
      let fd = await new Promise((rv, rj) => {
        fs.open(target, 'w+', 0o644, (err, fd) => {
          if (err) { rj(err); }
          else { rv(fd); }
        });
      });

      return new Promise((rv, rj) => {
        fs.write(fd, ctx.rawBody, upf.start, upf.length, 
          (err,bytesWritten,buffer) => {
            if (err) { rj(err); }
            else { rv(bytesWritten); }
          });
      })
      .then(d => {
        return d;
      }, e => { throw e; })
      .finally(() => {
        fs.close(fd, (err) => {});
      });
    };

```

注意：send函数只是设置ctx.res.body属性的值，在最后才会返回数据。和直接进行ctx.res.body赋值没有区别，只是因为函数调用如果出错会更快发现问题，而设置属性值写错了就是添加了一个新的属性，不会报错但是请求不会返回正确的数据。
