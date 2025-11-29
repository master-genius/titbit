![](images/titbit.png)

# titbit

**titbit** is a server-side web framework initially designed to simplify development in educational settings, but it has also been used in some production systems. It is not a heavyweight framework, but it is far from overly simplistic.

> **About Type Systems and TypeScript Support**  
> If the ECMAScript proposal for a type system is approved, JavaScript will natively support types in the future, eliminating the need to consider TypeScript support.  
> If this proposal is not adopted, TypeScript support will be considered later.  

> Reference link: <a href="https://github.com/tc39/proposal-type-annotations" target="_blank">JavaScript Type Annotations Proposal</a>

> For bugs or questions, please submit an issue or send a private message.

> It is extremely fast, both in route lookup and middleware execution.


A Node.js web development framework that supports both HTTP/1.1 and HTTP/2 protocols, providing a robust middleware mechanism.

**Core Features:**

* Request context design that abstracts interface differences.
* Middleware pattern.
* Route grouping and naming.
* Middleware execution based on route groups, matching request methods and routes.
* Support for running as a daemon using the `cluster` module.
* Display of subprocess load information.
* Automatic parsing of request body data.
* Configurable support for HTTP/1.1 or HTTP/2 services, with a compatibility mode allowing simultaneous support for both.
* Support for enabling HTTPS (required for HTTP/2 services).
* Request rate limiting.
* Limiting the maximum number of requests from a single IP within a time period.
* IP blacklists and whitelists.
* In cluster mode, automatic restart of subprocesses that exceed maximum memory limits.
* Optional automatic load balancing: creates new subprocesses based on load and reverts to the initial state when idle.
* Control over maximum memory usage for subprocesses, with automatic restarts when limits are exceeded or when memory usage surpasses a threshold and there are no active connections.
* Default configurations for network security to mitigate DDoS attacks and other security issues at the software service layer.

## !Note

Always use the latest version whenever possible. **titbit performs route lookup before creating the request context object. If no route is found, the request context object is not created.** This avoids unnecessary operations and includes detection for some erroneous or malicious requests, with error status codes 404 and 400. To customize error messages during this process, use the `notFound` and `badRequest` initialization options, which by default return simple text messages. (For routes you define, handle 404 errors internally as needed.)

## **v25.x Version Changes**

Starting with v25.0.0, the request context and related details have been updated, flattening data attributes. The `res` object in the request context has been removed, and `ctx.res.body` is no longer used to collect response data; instead, `ctx.data` is used directly.

Use the `ctx.send()` function to set the final response data. The code remains compatible, so no changes are required, and you can upgrade directly.

## Installation

```javascript
npm i titbit
```

You can also install it using Yarn:

```javascript
yarn add titbit
```

## Compatibility

Since v21.8.1, updates have been kept compatible, allowing seamless version upgrades without compatibility concerns. If future technological changes require breaking updates, detailed explanations will be provided. Please review the documentation and Wiki.

Before v21.8.1, major version numbers ensured compatibility.

<a href="https://gitee.com/daoio/titbit/wikis/%E7%89%88%E6%9C%AC%E6%94%B9%E8%BF%9B%E8%AF%B4%E6%98%8E?sort_id=3220595" target="_blank">· Important Version Improvements</a>

## Minimal Example

```javascript
'use strict'

const Titbit = require('titbit')

const app = new Titbit({
  debug: true
})

app.run(1234)
```

When no routes are added, titbit automatically adds a default route:

`/*`

Visiting this in a browser displays a simple page, intended for initial exploration and documentation access. It has no impact on actual development.

## Adding a Route

```javascript
'use strict'

const Titbit = require('titbit')

const app = new Titbit({
  debug: true
})

app.get('/', async ctx => {
  ctx.send('success')
})

// Listens on 0.0.0.0 by default; parameters are consistent with the native `listen` interface.
app.run(1234)
```

`ctx.data` holds the response data, or you can use `ctx.send(data)`.  
> Internally, `ctx.send()` sets the value of `ctx.data`.  
**It’s recommended to use `ctx.send()` to set response data, as versions prior to v25.0.0 used `ctx.res.body` for responses, and `send` ensures compatibility.**

## Using ES6 Imports

In `.mjs` files, you can use ES6 `import` syntax:

```javascript
import Titbit from 'titbit'

const app = new Titbit({
  debug: true
})

app.get('/', async ctx => {
  ctx.send('success')
})

app.run(1234)
```

## Routes and Request Types

HTTP request methods (also called request types) are specified in the HTTP start line. Supported request methods:

```
GET POST PUT PATCH DELETE OPTIONS TRACE HEAD
```

The most commonly used are the first six. For each request type, the router provides a corresponding lowercase function for mounting routes. For convenience, these methods are also available directly on the `app` instance after initialization. (The framework only supports these methods.)

**Example:**

```javascript
'use strict'

const Titbit = require('titbit')

const app = new Titbit({
  debug: true
})

app.get('/', async c => {
  c.send('success')
})

app.get('/p', async c => {
  c.send(`${c.method} ${c.routepath}`)
})

app.post('/', async c => {
  // Returns the submitted data
  c.send(c.body)
})

app.put('/p', async c => {
  c.send({
    method: c.method,
    body: c.body,
    query: c.query
  })
})

// Listens on 0.0.0.0 by default; parameters are consistent with the native `listen` interface.
app.run(8080)
```

## Retrieving URL Parameters

- Query string parameters (e.g., `?a=1&b=2`) are parsed into `c.query`.
- Form-submitted data is parsed into `c.body`.

> Form submissions typically have a `content-type` of `application/x-www-form-urlencoded`.

```javascript
'use strict'

const titbit = require('titbit')

let app = new titbit({
  debug: true
})

app.get('/q', async c => {
  // Query string parameters from the URL are parsed into `query`.
  // Returns JSON text with `content-type` set to `text/json`.
  c.send(c.query)
})

app.post('/p', async c => {
  // Data from POST or PUT requests is stored in `body`. For forms, it is automatically parsed; otherwise, it’s raw text.
  // Middleware can be used to handle various data types.
  c.send(c.body)
})

app.run(2019)
```

## Retrieving POST Data

POST and PUT requests submit data in the request body, typically from form submissions or asynchronous requests.

- Form-submitted data is parsed into `c.body`.

> Forms have a `content-type` of `application/x-www-form-urlencoded`.  
> Asynchronous requests often use `content-type: application/json`.

For both types, `c.body` is an object.

```javascript
'use strict'

const titbit = require('titbit')

let app = new titbit({ debug: true })

app.post('/p', async c => {
  // Data from POST or PUT requests is stored in `body`. For forms, it is automatically parsed into an object.
  // Middleware can be used to handle various data types.
  c.send(c.body)
})

app.run(2019)
```

## About `content-type`

**`application/x-www-form-urlencoded`**  
Basic form data is parsed into `c.body` as a JavaScript object.

**`text/*`**  
For `content-type` starting with `text/`, such as `text/json`, the framework does not parse the data. It converts the uploaded data to a UTF-8 encoded string and assigns it to `c.body`. Further processing is left to the developer.

**`multipart/form-data;boundary=xxx`**  
For file uploads, the framework parses the data by default, and the parsed file objects are stored in `c.files`, accessible via `c.getFile`.

**`application/json`**  
This type is parsed using `JSON.parse`.

**Other Types**  
For other `content-type` values, `c.body` points to `c.rawBody`, which is the raw `Buffer` data.

The framework provides core support for basic types, leaving other types for developers to handle or extend. To disable default body parsing, set the `parseBody` initialization option to `false`. You can also extend body parsing as needed.

The body parsing module is essentially a middleware, designed to facilitate extensions and replacements.

## The `send` Function

The `send` function is a wrapper for setting `c.data`. It supports an optional second parameter for the status code (default is 0, which uses the module’s default status code, 200 in Node.js HTTP and HTTP/2).

```javascript
app.get('/', async c => {
  c.send('success')
})

app.get('/randerr', async c => {
  let n = parseInt(Math.random() * 10)
  if (n >= 5) {
    c.send('success')
  } else {
    // Returns 404 status code
    /*
      Equivalent to:
        c.status(404).data = 'not found'
    */
    // Chainable calls are supported in v22.4.6 and above.
    c.status(404).send('not found')
  }
})

app.run(1234)
```

## Chainable Calls

Starting with v22.4.6, `setHeader`, `status`, and `sendHeader` support chainable calls.

```javascript
app.get('/', async c => {
  c.setHeader('content-type', 'text/plain; charset=utf-8')
    .setHeader('x-server', 'nodejs server')
    .status(200)
    .send(`${Date.now()} Math.random()`)
})
```

## Route Parameters

```javascript
app.get('/:name/:id', async c => {
  // Route parameters (denoted by `:`) are parsed into `c.param`.
  let username = c.param.name
  let uid = c.param.id
  c.send(`${username} ${uid}`)
})

app.run(8000)
```

## Wildcard Path Parameters

The `*` wildcard indicates any path but must appear at the end of the route.

```javascript
app.get('/static/*', async c => {
  // The wildcard path is parsed into `c.param.starPath`.
  let spath = c.param.starPath
  c.send(spath)
})
```

## Route Lookup Rules

Since v23.5.9, the route lookup process has been optimized, particularly for routes with parameters and wildcards, enforcing stricter order control instead of matching based on the order routes were added.

This change does not affect applications developed with earlier versions, ensuring compatibility. The stricter order reduces the likelihood of conflicts.

**Route Lookup Strategy:**

1. Exact string paths.
2. Routes with parameters (fewer parameters match first).
3. Wildcard (`*`) routes, matched from longest to shortest.

```
Example:
Routes: /x/y/:id  /x/y/*  /x/*  /x/:key/:id

/x/y/123 matches /x/y/:id and stops.
/x/y/123/345 matches /x/y/* and stops.
/x/q/123 matches /x/:key/:id.
/x/a.jpg matches /x/*, as no other routes match.
/x/static/images/a.jpg matches /x/*, as no other routes match.
```

## Route Grouping

You can use `app.middleware` to specify middleware and use the returned `group` method to add grouped routes, or directly use `app.group` to add grouped routes.

**`Titbit.prototype.middleware(mids, options=null)`**

- `mids`: An array where each element is a middleware function or an array containing a middleware function and its options.
- `options`: Defaults to `null`. Pass an object to apply options to all middleware, e.g., `{pre: true}`.

**`Titbit.prototype.group(group_name, callback, prefix=true)`**

- `group_name`: A string representing the group name. If it’s a valid path, it also serves as a route prefix.
- `callback`: A callback function that receives a parameter for adding middleware or routes using `get`, `post`, etc.
- `prefix`: A boolean (default `true`) controlling whether `group_name` is used as a route prefix (only if it’s a valid route string).

```javascript
'use strict'

const Titbit = require('titbit')

const app = new Titbit({
  debug: true
})

// Middleware function
let mid_timing = async (c, next) => {
  console.time('request')
  await next()
  console.timeEnd('request')
}

// The group return value supports `use` and `pre` for adding middleware.
// `/api` is also added as a route prefix.
app.group('/api', route => {
  route.get('/test', async c => {
    c.send('api test')
  })

  route.get('/:name', async c => {
    c.send(c.param)
  })
})

// Add middleware to a specific group
app.use(
  async (c, next) => {
    console.log(c.method, c.headers)
    await next()
  }, { group: '/sub' }
).group('/sub', route => {
  route.get('/:id', async c => {
    c.send(c.param.id)
  })
})

// Test group name (not a valid route, so it won’t be a prefix)
app.group('test', route => {
  route.get('/test', async c => {
    console.log(c.group, c.name)
    c.send('test ok')
  }, 'test')
})

app.run(1234)
```

This approach can be complex when specifying multiple middleware. The `middleware` method simplifies this, as shown below.

### Assigning Middleware to Groups and Subgroups

```javascript
'use strict'

const Titbit = require('titbit')
const { ToFile } = require('titbit-toolkit')

const app = new Titbit({
  debug: true
})

// Middleware function
let mid_timing = async (c, next) => {
  console.time('request')
  await next()
  console.timeEnd('request')
}

let sub_mid_test = async (c, next) => {
  console.log('mid test start')
  await next()
  console.log('mid test end')
}

// The group return value supports `use`, `pre`, and `middleware` for adding middleware.
// `/api` is added as a route prefix.
app.middleware([
  // Timing middleware runs before receiving request body data, so `pre` is set to `true`.
  [mid_timing, { pre: true }],
  // ToFile extension runs after receiving request body data, only for POST and PUT.
  [new ToFile(), { method: ['POST', 'PUT'] }]
]).group('/api', route => {
  route.get('/test', async c => {
    c.send('api test')
  })

  route.get('/:name', async c => {
    c.send(c.param)
  })

  // Subgroup `/sub` enables `sub_mid_test` middleware and inherits parent middleware.
  route.middleware([sub_mid_test]).group('/sub', sub => {
    sub.get('/:key', async c => {
      c.send(c.param)
    })
  })
})

app.run(1234)
```

Group nesting is supported but should not exceed 9 levels. Nesting beyond 3 levels is often a sign of poor design and should be reconsidered.

**This feature is non-intrusive and does not affect existing code or conflict with `titbit-loader`.**

**Complex route handlers should be placed in separate modules and loaded using a unified automation function.**

Starting with v24.0.9, you can add routes using return values without passing a callback function:

```javascript
'use strict'

const Titbit = require('titbit')
const { ToFile } = require('titbit-toolkit')

const app = new Titbit({
  debug: true
})

// Middleware function
let mid_timing = async (c, next) => {
  console.time('request')
  await next()
  console.timeEnd('request')
}

let sub_mid_test = async (c, next) => {
  console.log('mid test start')
  await next()
  console.log('mid test end')
}

let route = app.middleware([
  // Timing middleware runs before receiving request body data, so `pre` is set to `true`.
  [mid_timing, { pre: true }],
  // ToFile extension runs after receiving request body data, only for POST and PUT.
  [new ToFile(), { method: ['POST', 'PUT'] }]
]).group('/api')

route.get('/test', async c => {
  c.send('api test')
})

route.get('/:name', async c => {
  c.send(c.param)
})

// Subgroup `/sub` enables `sub_mid_test` middleware and inherits parent middleware.
route.middleware([sub_mid_test]).group('/sub', sub => {
  sub.get('/:key', async c => {
    c.send(c.param)
  })
})

app.run(1234)
```

## File Uploads

File uploads are parsed by default. You can disable this by setting the `parseBody` option during initialization. Parsed file data is stored in `c.files`, with the structure detailed below.

```javascript
'use strict'

const titbit = require('titbit')

const app = new titbit()

app.post('/upload', async c => {
  let f = c.getFile('image')

  // Helper function to generate a unique filename based on timestamp and file extension.
  let fname = c.ext.makeName(f.filename)

  try {
    c.send(await c.moveFile(f, fname))
  } catch (err) {
    c.status(500).send(err.message)
  }
}, 'upload-image') // Names the route `upload-image`, accessible via `c.name`.

app.run(1234)
```

## `c.files` Data Structure

The structure is designed based on the HTTP protocol’s file upload data format. Since HTTP allows multiple files under the same upload name, files are parsed into an array. `c.getFile` returns the first file by default, as most cases involve a single file per upload name.

> For front-end developers, the upload name is the `name` attribute in the HTML form: `<input type="file" name="image">`.  
> Do not confuse the upload name with the filename.

```javascript
{
  image: [
    {
      'content-type': CONTENT_TYPE,
      // Available since v23.2.6, alias for content-type
      type: CONTENT_TYPE,
      filename: ORIGIN_FILENAME,
      start: START,
      end: END,
      length: LENGTH,
      rawHeader: HEADER_DATA,
      headers: {...}
    },
    ...
  ],
  video: [
    {
      'content-type': CONTENT_TYPE,
      // Available since v23.2.6, alias for content-type
      type: CONTENT_TYPE,
      filename: ORIGIN_FILENAME,
      start: START,
      end: END,
      length: LENGTH,
      rawHeader: HEADER_DATA,
      headers: {...}
    },
    ...
  ]
}
```

`c.getFile(name)` retrieves file information by name, defaulting to index 0. If a negative index is provided, it returns the entire file array; if no files are found, it returns `null`.

## Body Size Limit

```javascript
'use strict'

const titbit = require('titbit')

const app = new titbit({
  // Sets the maximum data size for POST or PUT requests to ~20MB (in bytes).
  maxBody: 20000000
})

app.run(1234)
```

## Middleware

Middleware is a powerful pattern, with implementations varying slightly across languages but sharing the same essence. Middleware allows developers to organize code effectively and handle complex logic. The framework’s entire operation is based on the middleware pattern.

**Middleware Diagram:**

![](images/middleware.jpg)

The framework’s middleware is designed to execute based on route groups and request types, ensuring fast performance. Middleware is executed only when needed, avoiding unnecessary operations. Example:

```javascript
/*
  The second parameter is optional, indicating global middleware.
  Here, it specifies that the middleware only applies to POST requests in the `/api` group.
  This design ensures efficient execution without unnecessary operations.
*/
app.add(async (c, next) => {
  console.log('before')
  await next()
  console.log('after')
}, { method: 'POST', group: '/api' })
```

Middleware added with `add` executes in reverse order of addition (standard onion model). To align with developer intuition, the `use` interface adds middleware that executes in the order it was added. Different frameworks handle execution order differently, but sequential execution is more intuitive.

**Recommendation: Use `use` to add middleware.**

```javascript
// Executes first
app.use(async (c, next) => {
  let start_time = Date.now()
  await next()
  let end_time = Date.now()
  console.log(end_time - start_time)
})

// Executes second
app.use(async (c, next) => {
  console.log(c.method, c.path)
  await next()
})

// `use` supports chaining: app.use(m1).use(m2)
// Available since v21.5.4, though this is less critical with `titbit-loader`.
```

## titbit Complete Flow Diagram

![](images/titbit-middleware.png)

> **Note: Internally, body data reception and parsing are also middleware, deliberately ordered and separated into `pre` and `use` interfaces.**

## Middleware Parameters

The `use` and `pre` interfaces support a second parameter for precise control:

- `group`: Specifies the route group for the middleware.
- `method`: Request method(s) as a string or array (must be uppercase).
- `name`: Route name, restricting middleware to specific routes.

Example:

```javascript
app.get('/xyz', async c => {
  // Route grouped under 'proxy'
}, { group: 'proxy' })

app.use(proxy, {
  method: ['PUT', 'POST', 'GET', 'DELETE', 'OPTIONS'],
  group: 'proxy'
})
```

## `pre` Middleware (Before Body Parsing)

The main difference between `pre` and `use` is that `pre` middleware executes before receiving body data, useful for permission filtering. Its parameters are the same as `use`.

For a consistent experience, you can use `use` with the `pre` option:

```javascript
let setbodysize = async (c, next) => {
  // Sets max body size to ~10KB.
  c.maxBody = 10000
  await next()
}

// Equivalent to app.pre(setbodysize)
app.use(setbodysize, { pre: true })
```

`pre` middleware can handle complex logic and intercept requests without proceeding to the next layer. For example, the `titbit-toolkit` proxy module uses this to implement a high-performance proxy as a middleware.

**Dynamic Body Size Limits by Request Type**

This can be achieved using `pre` middleware:

```javascript
const app = new titbit({
  // Default max body size ~10MB
  maxBody: 10000000
})

app.pre(async (c, next) => {
  let ctype = c.headers['content-type'] || ''

  if (ctype.indexOf('text/') === 0) {
    // 50KB
    c.maxBody = 50000
  } else if (ctype.indexOf('application/') === 0) {
    // 100KB
    c.maxBody = 100000
  } else if (ctype.indexOf('multipart/form-data') < 0) {
    // 10KB
    c.maxBody = 10000
  }

  await next()
}, { method: ['POST', 'PUT'] })
```

These parameters can make the code complex and hard to maintain, but they are powerful. For automation, use `titbit-loader`, which simplifies routing, model loading, and middleware orchestration: <a target="_blank" href="https://gitee.com/daoio/titbit-loader">titbit-loader</a>.

## HTTPS

```javascript
'use strict'

const Titbit = require('titbit')

// Specify paths to the certificate and key files
const app = new Titbit({
  cert: './xxx.cert',
  key: './xxx.key'
})

app.run(1234)
```

## Supporting HTTP/2 and HTTP/1.1 (Compatibility Mode)

Compatibility mode uses the ALPN protocol and requires HTTPS, so certificate and key files must be configured.

```javascript
'use strict'

const Titbit = require('titbit')

// Specify paths to the certificate and key files
const app = new Titbit({
  cert: './xxx.cert',
  key: './xxx.key',
  // Enable HTTP/2 and allow HTTP/1.1 compatibility
  http2: true,
  allowHTTP1: true
})

app.run(1234)
```

## Configuration Options

Complete configuration options for application initialization, with detailed comments:

```javascript
{
  // Maximum byte size for POST/PUT form submissions and file uploads.
  maxBody: 8000000,

  // Maximum number of files to parse.
  maxFiles: 12,

  daemon: false, // Enable daemon mode.

  // If set to a non-empty string in daemon mode, writes the PID to this file for service management.
  pidFile: '',

  // Enable global logging to output or save request information.
  globalLog: false,

  // Log output method: 'stdio' for terminal, 'file' for file.
  logType: 'stdio',

  // File path for successful request logs (2xx or 3xx status codes).
  logFile: '',

  // File path for error request logs (4xx or 5xx status codes).
  errorLogFile: '',

  // Maximum number of log entries per file.
  logMaxLines: 50000,

  // Maximum number of historical log files.
  logHistory: 50,

  // Custom log handling function.
  logHandle: null,

  // Enable HTTPS.
  https: false,

  http2: false,

  allowHTTP1: false,

  // File paths for HTTPS key and certificate. Setting these enables `https: true`.
  key: '',
  cert: '',

  // Server options passed to `http2.createSecureServer` or `tls.createServer`.
  server: {
    handshakeTimeout: 8192, // TLS handshake timeout
    // sessionTimeout: 350,
  },

  // Server timeout (milliseconds). Can be overridden per request.
  timeout: 15000,

  debug: false,

  // Ignore trailing slashes in paths.
  ignoreSlash: true,

  // Enable request limiting.
  useLimit: false,

  // Maximum connections (0 for unlimited).
  maxConn: 1024,

  // Maximum requests per IP within a time period (0 for unlimited).
  maxIPRequest: 0,

  // Time period for request limiting (default: 60 second).
  unitTime: 60,

  // Display load information (requires `daemon` mode).
  loadMonitor: true,

  // Load information type: 'text', 'json', or '--null'. JSON is for programmatic use.
  loadInfoType: 'text',

  // File path for load information (if unset, outputs to terminal).
  loadInfoFile: '',

  // Data for 404 responses.
  notFound: 'Not Found',

  // Data for 400 responses.
  badRequest: 'Bad Request',

  // Memory usage percentage factor for subprocesses (-0.42 to 0.36; base is 0.52, default is 80%).
  memFactor: 0.28,

  // Maximum URL length.
  maxUrlLength: 2048,

  // Maximum request context cache pool size.
  maxpool: 4096,

  // Interval (milliseconds) for subprocess resource reporting.
  monitorTimeSlice: 640,

  // Log real IP addresses in global logs (useful in reverse proxy mode).
  realIP: false,

  // Maximum number of query string parameters.
  maxQuery: 25,

  // Enable strong mode to handle `rejectionHandled` and `uncaughtException` events,
  // capturing errors like TypeError, ReferenceError, etc.
  strong: false,

  // Fast query string parsing (uses only the first value for duplicate keys, not an array).
  fastParseQuery: false,

  // Automatically decode query parameters using `decodeURIComponent`.
  autoDecodeQuery: true,

  // Maximum length for a single form item in multipart format.
  maxFormLength: 1000000,

  // Error handling function for runtime errors (e.g., tlsClientError, server errors).
  // `errname` is a string like `--ERR-CONNECTION--` or `--ERR-CLIENT--`.
  errorHandle: (err, errname) => {
    this.config.debug && console.error(errname, err)
  },

  // Maximum CPU load percentage (default: 75%). Effective only with `autoWorker`.
  maxLoadRate: 75,

  // HTTP/2 stream timeout (-1 to match `timeout`).
  streamTimeout: -1,

  // Total request timeout to counter malicious requests (e.g., DDoS attacks).
  requestTimeout: 100000
}
```

## Request Context

The request context is an object encapsulating various request data, abstracting differences between HTTP/1.1 and HTTP/2 and handling Node.js version incompatibilities. For HTTP/2, the request object is a `stream`, not `IncomingMessage` and `ServerResponse` as in HTTP/1.1.

**Request Context Properties and Descriptions**

| Property | Description |
|----------|-------------|
| version | Protocol version (`'1.1'` or `'2'`). |
| major | Major protocol version (1, 2, or 3 for HTTP/1.1, HTTP/2, HTTP/3; 3 not yet supported). |
| maxBody | Maximum request body size (bytes), defaults to `maxBody` from initialization, adjustable in middleware. |
| method | Request method (e.g., `GET`, `POST`), uppercase string. |
| host | Hostname from `request.headers.host`. |
| protocol | Protocol string (`http` or `https`, no colon). |
| path | Requested path. |
| routepath | Actual route string executed. |
| query | URL query parameters. |
| param | Route parameters. |
| files | Uploaded file information. |
| body | Request body data (string, object, or Buffer, depending on `content-type`). |
| port | Client request port. |
| ip | Client IP address (socket address; check `x-real-ip` or `x-forwarded-for` for proxies). |
| headers | Reference to `request.headers`. |
| isUpload() | Checks if the request is a file upload (`multipart/form-data`). |
| name | Route name (default: empty string). |
| group | Route group (default: empty string). |
| reply | HTTP/1.1: `response`; HTTP/2: `stream`. |
| request | HTTP/1.1: `IncomingMessage`; HTTP/2: `stream`. |
| box | Empty object for dynamically passing data to subsequent layers. |
| service | Dependency injection object, points to `app.service`. |
| data | Final response data (set directly or via `ctx.send`). Before v24.x, was `ctx.res.body`. |
| ext | Helper functions (see Wiki). |
| send(data) | Sets `ctx.data`. |
| write(data) | Writes data directly to the client. |
| moveFile(file, target_filepath) | Moves an uploaded file to the specified path. |
| status() | Sets the status code. |
| setHeader(k, v) | Sets a response header. |
| removeHeader(k) | Removes a pending response header. |
| getFile(name) | Retrieves uploaded file information from `files`. |
| sendHeader() | Sends headers (HTTP/2 only; no-op for HTTP/1.1). |
| user | Standard property for user login (default: `null`). |
| json(data) | Sets response data with `content-type: application/json`. |
| text(data) | Sets response data with `content-type: text/plain`. |
| html(data) | Sets response data with `content-type: text/html`. |
| pipe(filepath) | Streams file data (e.g., `await ctx.setHeader('content-type', 'text/html').pipe('./index.html')`). |
| pipeJson(filepath) | Streams file data as JSON. |
| pipeText(filepath) | Streams file data as text. |
| pipeHtml(filepath) | Streams file data as HTML. |

**Note:** The `send` function only sets `ctx.data`. It’s equivalent to direct assignment but helps catch errors faster, as incorrect property assignments create new properties without errors, leading to incorrect responses.

## Dependency Injection

The request context includes a `service` property pointing to `app.service`. After initializing the `app`, you can attach pre-initialized data or instances to `app.service`.

```javascript
'use strict'

const titbit = require('titbit')

const app = new titbit({
  debug: true
})

// Overwrites if exists, adds if not.
app.addService('name', 'first')
app.addService('data', {
  id: 123,
  ip: '127.0.0.1'
})

app.get('/info', async c => {
  c.send({
    name: c.service.name,
    data: c.service.data
  })
})

app.run(1234)
```

## Extending the Request Context

To extend the request context, use `app.httpServ.context`. This is the constructor for the request context.

**Example:**

```javascript
'use strict'

const titbit = require('titbit')

const app = new titbit({
  debug: true
})

// `this` refers to the request context
app.httpServ.context.prototype.testCtx = function () {
  console.log(this.method, this.path)
}

app.get('/test', async ctx => {
  ctx.testCtx()
})

app.run(1234)
```

## `app.isMaster` and `app.isWorker`

Since Node.js v16.x, the `cluster` module recommends `isPrimary` over `isMaster`, though `isMaster` remains available. After initializing the `app`, `app.isMaster` and `app.isWorker` getter properties are provided, mirroring `cluster` properties to:

- Avoid requiring `const cluster = require('cluster')`.
- Shield against future `cluster` incompatibilities.

## `daemon` and `run`

The `run` interface accepts `port` and `host` (default: `0.0.0.0`). It also supports a `sockPath` (e.g., `.sock` file), consistent with the HTTP `listen` interface, in which case `host` is ignored.

The `daemon` interface shares the same first two parameters but supports a third parameter specifying the number of subprocesses. If set to 0, it defaults to the number of CPU cores. It maintains subprocess stability by creating new ones if any terminate unexpectedly.

**In cluster mode, the maximum number of subprocesses is twice the CPU core count.**

**Examples:**

```javascript
// Default host: 0.0.0.0, port: 1234
app.run(1234)

// Listen on localhost (local access only)
app.run(1234, 'localhost')

// Use 2 subprocesses, default host: 0.0.0.0
app.daemon(1234, 2)

// Use 3 subprocesses
app.daemon(1234, 'localhost', 3)
```

## Logging

The framework provides global logging when using `daemon` mode (cluster). Enable it with the `globalLog` option, which supports file output or terminal output (in single-process `run` mode, logs go to the terminal but can be redirected to files).

**Note: Only `daemon` mode supports saving logs to files. In `run` mode, logs are output to the terminal but can be redirected.**

You can use the `logHandle` option to define a custom logging function, which overrides `logFile` and `errorLogFile`.

**Example:**

```javascript
const titbit = require('titbit')

const app = new titbit({
  debug: true,
  globalLog: true,
  logType: 'file', // 'file' for file output, 'stdio' for terminal
  logFile: '/tmp/titbit.log', // Successful requests (2xx, 3xx)
  errorLogFile: '/tmp/titbit-error.log', // Error requests (4xx, 5xx)
  logHandle: (w, msg) => {
    // Custom log handler; overrides logFile and errorLogFile
    // `msg` format: { type: '_log', success: true, log: '@ GET | https://localhost:2021/randst | 200 | 2020-10-31 20:27:7 | 127.0.0.1 | User-Agent' }
    console.log(w.id, msg)
  }
})

app.daemon(1234, 3)
```

Middleware-based logging does not conflict with global logging but cannot capture 404 errors (no route found), as the framework returns early without creating a request context.

## Message Event Handling

In `daemon` mode (using `cluster`), the `setMsgEvent` function handles messages sent by subprocesses. Messages must be objects with a required `type` property indicating the event name.

**Example:**

```javascript
const titbit = require('titbit')
const cluster = require('cluster')

const app = new titbit({
  debug: true,
  loadInfoFile: '/tmp/loadinfo.log'
})

if (cluster.isMaster) {
  app.setMsgEvent('test-msg', (worker, msg, handle) => {
    worker.send({
      id: worker.id,
      data: 'ok'
    })
    console.log(msg)
  })
} else {
  process.on('message', msg => {
    console.log(msg)
  })

  setInterval(() => {
    process.send({
      type: 'test-msg',
      pid: process.pid,
      time: new Date().toLocaleString()
    })
  }, 1000)
}
```

Since v22.4.0, the `app.send` method simplifies sending messages from workers to the master process.

## `app.send` and `app.workerMsg`

Rewriting the above example using `app.send` and `app.workerMsg`:

```javascript
const titbit = require('titbit')

const app = new titbit({
  debug: true,
  loadInfoFile: '/tmp/loadinfo.log'
})

app.setMsgEvent('test-msg', (worker, msg, handle) => {
  worker.send({
    id: worker.id,
    data: 'ok'
  })
  console.log(msg)
})

app.workerMsg(msg => {
  console.log(msg)
})

cluster.isWorker &&
  setInterval(() => {
    app.send('test-msg', {
      pid: process.pid,
      time: new Date().toLocaleString()
    })
  }, 1000)

app.daemon(1234, 2)
```

## Automatic Subprocess Adjustment

The `daemon` interface sets the base number of subprocesses:

```javascript
// Use 2 subprocesses
app.daemon(1234, 2)
```

To automatically adjust subprocesses based on load, use `autoWorker` to set a maximum number of subprocesses (must be greater than the base number):

```javascript
// Maximum 9 subprocesses
app.autoWorker(9)

app.daemon(1234, 2)
```

When load is high, new subprocesses are created. When idle, subprocesses with zero connections are terminated to revert to the base number.

**Available since v21.9.6. Use the latest version for improved stability and performance.**

## Strong Mode

Enable `strong` mode to handle `uncaughtException` and `unhandledRejection` events, ensuring program stability. Simply set `strong: true`.

**All `strong` mode features can be implemented manually using the `process` module; this just simplifies the process.**

```javascript
'use strict'

const titbit = require('titbit')

setTimeout(() => {
  throw new Error('test error')
}, 2000)

const app = new titbit({
  debug: true,
  strong: true
})

app.run(1234)
```

By default, `strong` mode catches:

```
TypeError, ReferenceError, RangeError, AssertionError, URIError, Error
```

Customize handling with an object:

```javascript
const app = new titbit({
  debug: true,
  strong: {
    quiet: true, // Suppress error output
    errorHandle: (err, errname) => {
      // Custom error handling
    },
    catchErrors: ['TypeError', 'URIError', 'Error', 'RangeError']
  }
})
```

## Running HTTP and HTTPS Simultaneously?

**This is not recommended in production.** If HTTPS is enabled, HTTP is unnecessary, and some front-end features require HTTPS.

For testing, you can do:

```javascript
'use strict'

const Titbit = require('titbit')
const http = require('node:http')
const https = require('node:https')

const app = new Titbit({
  debug: true
})

let http_server = http.createServer(app.httpServ.onRequest())
let https_server = https.createServer(app.httpServ.onRequest())

http_server.listen(2025)
https_server.listen(2026)
```

**Note: This setup does not support HTTP/2. Use HTTP/2 with `allowHTTP1` for compatibility.**

## Miscellaneous

- A final middleware handles responses, automatically setting `content-type` (e.g., `text/plain`, `text/html`, `application/json`) if not set.
- Default limits on URL length and memory usage are based on hardware.
- Configurations and middleware allow for extension and overrides.
- The framework is optimized for speed. For performance comparisons, test with multiple middleware and hundreds of routes.
- The `sched` function sets cluster scheduling policy (`'rr'` or `'none'`), equivalent to `cluster.schedulingPolicy`.

The framework auto-detects memory size and sets limits, adjustable via the `secure` object in `daemon` mode:

```javascript
'use strict'

const Titbit = require('titbit')

let app = new Titbit()

// Max memory 600MB, restarts only when connections are 0.
app.secure.maxmem = 600_000_000

// Hard limit 900MB; restarts if exceeded, even with active connections.
app.secure.diemem = 900_000_000

// Max RSS memory 800MB (excludes Buffer allocations).
app.secure.maxrss = 800_000_000

app.get('/', async c => {
  c.send('ok')
})

app.daemon(8008, 2)
```

**Requires `loadMonitor: true` (default unless set to `false`).**

Use default configurations unless specific control is needed.
