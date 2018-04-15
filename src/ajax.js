//     Zepto.js
//     (c) 2010-2016 Thomas Fuchs
//     Zepto.js may be freely distributed under the MIT license.

;(function($){
  var jsonpID = +new Date(),
      document = window.document,
      key,
      name,
      rscript = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      scriptTypeRE = /^(?:text|application)\/javascript/i,
      xmlTypeRE = /^(?:text|application)\/xml/i,
      jsonType = 'application/json',
      htmlType = 'text/html',
      blankRE = /^\s*$/,
      originAnchor = document.createElement('a')

  originAnchor.href = window.location.href

  // trigger a custom event and return false if it was cancelled
  function triggerAndReturn(context, eventName, data) {
    var event = $.Event(eventName)
    $(context).trigger(event, data)
    return !event.isDefaultPrevented()
  }

  // trigger an Ajax "global" event
  // 触发ajax全局事件
  function triggerGlobal(settings, context, eventName, data) {
    // setting.global true
    if (settings.global) return triggerAndReturn(context || document, eventName, data)
  }

  // Number of active Ajax requests
  $.active = 0

  function ajaxStart(settings) {
    // $.active 为0 在document上触发
    if (settings.global && $.active++ === 0) triggerGlobal(settings, null, 'ajaxStart')
  }
  function ajaxStop(settings) {
    // --$.active为0时在document上触发
    if (settings.global && !(--$.active)) triggerGlobal(settings, null, 'ajaxStop')
  }

  // triggers an extra global event "ajaxBeforeSend" that's like "ajaxSend" but cancelable
  function ajaxBeforeSend(xhr, settings) {
    var context = settings.context
    // beforeSend回调, 若beforeSend返回false, ajaxBeforeSend取消 或 ajaxBeforeSend事件取消了默认行为,则ajaxSend取消
    if (settings.beforeSend.call(context, xhr, settings) === false ||
        triggerGlobal(settings, context, 'ajaxBeforeSend', [xhr, settings]) === false)
        // ajax请求被取消
      return false

      // ajaxSend事件
    triggerGlobal(settings, context, 'ajaxSend', [xhr, settings])
  }
  function ajaxSuccess(data, xhr, settings, deferred) {
    var context = settings.context, status = 'success'
    // success回调
    settings.success.call(context, data, status, xhr)
    // 若deferred存在, 可以使用promise风格
    if (deferred) deferred.resolveWith(context, [data, status, xhr])
    // ajaxSuccess 事件
    triggerGlobal(settings, context, 'ajaxSuccess', [xhr, settings, data])
    // ajaxComplete事件
    ajaxComplete(status, xhr, settings)
  }
  // type: "timeout", "error", "abort", "parsererror"
  function ajaxError(error, type, xhr, settings, deferred) {
    var context = settings.context
    // error callback
    settings.error.call(context, xhr, type, error)
    if (deferred) deferred.rejectWith(context, [xhr, type, error])
    // ajaxError 事件
    triggerGlobal(settings, context, 'ajaxError', [xhr, settings, error || type])
    // ajaxComplete 事件
    ajaxComplete(type, xhr, settings)
  }
  // status: "success", "notmodified", "error", "timeout", "abort", "parsererror"
  function ajaxComplete(status, xhr, settings) {
    var context = settings.context
    // complete callback
    settings.complete.call(context, xhr, status)
    triggerGlobal(settings, context, 'ajaxComplete', [xhr, settings])
    // 如果这是最后一个活跃着的Ajax请求, 触发ajaxStop 事件
    ajaxStop(settings)
  }

  // 过滤请求成功后的响应数据
  function ajaxDataFilter(data, type, settings) {
  // function empty() {}
    if (settings.dataFilter == empty) return data
    var context = settings.context
    return settings.dataFilter.call(context, data, type)
  }

  // Empty function, used as default callback
  // 来作为回调函数配置的初始值。这样的好处是在执行回调函数时，不需要每次都判断回调函数是否存在。
  function empty() {}

  $.ajaxJSONP = function(options, deferred){
    // options中没有type属性
    if (!('type' in options)) return $.ajax(options)

    var _callbackName = options.jsonpCallback,
      callbackName = ($.isFunction(_callbackName) ?
      // 根据_callbackName定义callbackName, 如果_callbackName没有定义,根据jsonpID确定回调函数名
        _callbackName() : _callbackName) || ('Zepto' + (jsonpID++)),
      script = document.createElement('script'),
      // 原始回调函数
      originalCallback = window[callbackName],
      responseData,
      // 触发script error事件
      abort = function(errorType) {
        $(script).triggerHandler('error', errorType || 'abort')
      },
      xhr = { abort: abort }, abortTimeout

      // 如果存在deferred对象, 在xhr基础上生成promise对象
    if (deferred) deferred.promise(xhr)

    // 请求成功或失败
    $(script).on('load error', function(e, errorType){
      // 请清除请求超时定时器, 避免触发超时错误
      clearTimeout(abortTimeout)
      // 取消script绑定的事件, 并删除script标签, 数据保存在了responseData
      $(script).off().remove()

      if (e.type == 'error' || !responseData) {
        // errorType 这里为abort 或error
        ajaxError(null, errorType || 'error', xhr, options, deferred)
      } else {
        ajaxSuccess(responseData[0], xhr, options, deferred)
      }

      // 之前为了获取responseData,重写了window[callbackName], 现在改回来
      window[callbackName] = originalCallback
      if (responseData && $.isFunction(originalCallback))
      // 执行jsonp回调
        originalCallback(responseData[0])

        // 清除临时变量
      originalCallback = responseData = undefined
    })

    if (ajaxBeforeSend(xhr, options) === false) {
      // 取消jsonp
      abort('abort')
      return xhr
    }

    window[callbackName] = function(){
      // 重写window中的回调函数, 将参数保存在responseData
      responseData = arguments
    }

    // 将=? 替换为 =callbackName
    script.src = options.url.replace(/\?(.+)=\?/, '?$1=' + callbackName)
    document.head.appendChild(script)

    // 如果设定了超时时间, 触发error事件
    if (options.timeout > 0) abortTimeout = setTimeout(function(){
      abort('timeout')
    }, options.timeout)

    return xhr
  }

  $.ajaxSettings = {
    // Default type of request
    type: 'GET',
    // 4个ajax回调函数
    // Callback that is executed before request
    beforeSend: empty,
    // Callback that is executed if the request succeeds
    success: empty,
    // Callback that is executed the the server drops error
    error: empty,
    // Callback that is executed on request complete (both: error and success)
    complete: empty,
    // The context for the callbacks
    context: null,
    // Whether to trigger "global" Ajax events
    global: true,
    // Transport
    xhr: function () {
      return new window.XMLHttpRequest()
    },
    // MIME types mapping
    // IIS returns Javascript as "application/x-javascript"
    accepts: {
      script: 'text/javascript, application/javascript, application/x-javascript',
      json:   jsonType,
      xml:    'application/xml, text/xml',
      html:   htmlType,
      text:   'text/plain'
    },
    // Whether the request is to another domain
    crossDomain: false,
    // Default timeout
    timeout: 0,
    // Whether data should be serialized to string
    processData: true,
    // Whether the browser should be allowed to cache GET responses
    cache: true,
    //Used to handle the raw response data of XMLHttpRequest.
    //This is a pre-filtering function to sanitize the response.
    //The sanitized response should be returned
    dataFilter: empty
  }

  // Content-Type 的值的形式如下 text/html; charset=utf-8
  function mimeToDataType(mime) {
    // 'a,b,c'.split(',', 2) => ['a', 'b']
    if (mime) mime = mime.split(';', 2)[0]
      // htmlType = 'text/html',
    return mime && ( mime == htmlType ? 'html' :
      // jsonType = 'application/json',
      mime == jsonType ? 'json' :
      // scriptTypeRE = /^(?:text|application)\/javascript/i,
      scriptTypeRE.test(mime) ? 'script' :
      // xmlTypeRE = /^(?:text|application)\/xml/i,
      xmlTypeRE.test(mime) && 'xml' ) || 'text'
  }

  function appendQuery(url, query) {
    if (query == '') return url
    // query不为空, 用&拼接url query 将&& 、 ?& ，&? 或 ?? 替换成 ?
    // 拼接出来的 url 的形式如 url?key=value&key2=value
    return (url + '&' + query).replace(/[&?]{1,2}/, '?')
  }

  // serialize payload and append it to the URL for GET requests
  function serializeData(options) {
    if (options.processData && options.data && $.type(options.data) != "string")
      options.data = $.param(options.data, options.traditional)
      // 为GET 或jsonp
    if (options.data && (!options.type || options.type.toUpperCase() == 'GET' || 'jsonp' == options.dataType))
      options.url = appendQuery(options.url, options.data), options.data = undefined
  }

  $.ajax = function(options){
    // 获取可能存在options参数
    var settings = $.extend({}, options || {}),
        deferred = $.Deferred && $.Deferred(),
        urlAnchor, hashIndex
        // 补充没有的setting参数
    for (key in $.ajaxSettings) if (settings[key] === undefined) settings[key] = $.ajaxSettings[key]

    // ajaxStart event
    ajaxStart(settings)

    if (!settings.crossDomain) {
      // 检测是否跨域
      urlAnchor = document.createElement('a')
      urlAnchor.href = settings.url
      // cleans up URL for .href (IE only), see https://github.com/madrobby/zepto/pull/1049
      // ie 默认不会对链接 a 添加端口号，但是会对 window.location.href 添加端口号，如果端口号为 80 时，会出现不一致的情况
      urlAnchor.href = urlAnchor.href
      // protocol http等 host localhost:3000 等
      // 不相同,则是跨域
      settings.crossDomain = (originAnchor.protocol + '//' + originAnchor.host) !== (urlAnchor.protocol + '//' + urlAnchor.host)
    }

    // 没有配置url, 则用当前地址作为请求地址
    if (!settings.url) settings.url = window.location.toString()
    // 去掉hash
    if ((hashIndex = settings.url.indexOf('#')) > -1) settings.url = settings.url.slice(0, hashIndex)
    // 序列化请求参数
    serializeData(settings)

    // 判断是否jsonp
    var dataType = settings.dataType, hasPlaceholder = /\?.+=\?/.test(settings.url)
    if (hasPlaceholder) dataType = 'jsonp'

    // settings.cache为false时,说明options中设置了cache
    if (settings.cache === false || (
      // dataType 为 script 或者 jsonp 的情况下， options.cache 没有设置为 true 时
         (!options || options.cache !== true) &&
         ('script' == dataType || 'jsonp' == dataType)
        ))
        // 请求的地址加个时间, 每次地址都不一样, 浏览器就不读缓存了
      settings.url = appendQuery(settings.url, '_=' + Date.now())

    if ('jsonp' == dataType) {
      // 追加jsonp占位符
      if (!hasPlaceholder)
        settings.url = appendQuery(settings.url,
          // 若没设置settings.jsonp url的形式为 callback=? 在$.ajaxJSONP中替换为callback=callbackName
          settings.jsonp ? (settings.jsonp + '=?') : settings.jsonp === false ? '' : 'callback=?')
      return $.ajaxJSONP(settings, deferred)
    }

    // 设置希望接收的响应报文主体类型
    var mime = settings.accepts[dataType],
        headers = { },
        // 设置请求头
        setHeader = function(name, value) { headers[name.toLowerCase()] = [name, value] },
        // 优先从url中匹配协议
        protocol = /^([\w-]+:)\/\//.test(settings.url) ? RegExp.$1 : window.location.protocol,
        xhr = settings.xhr(),
        // 此方法必须在  open() 方法和 send()   之间调用。如果多次对同一个请求头赋值，只会生成一个合并了多个值的请求头。
        nativeSetHeader = xhr.setRequestHeader,
        abortTimeout

    if (deferred) deferred.promise(xhr)

    // 告诉服务端这是ajax请求
    if (!settings.crossDomain) setHeader('X-Requested-With', 'XMLHttpRequest')
    setHeader('Accept', mime || '*/*')
    if (mime = settings.mimeType || mime) {
      if (mime.indexOf(',') > -1) mime = mime.split(',', 2)[0]
      xhr.overrideMimeType && xhr.overrideMimeType(mime)
    }
    // 请求报文主体类型
    if (settings.contentType || (settings.contentType !== false && settings.data && settings.type.toUpperCase() != 'GET'))
    // x-www-form-urlencoded 窗体数据被编码为名称/值对
      setHeader('Content-Type', settings.contentType || 'application/x-www-form-urlencoded')

    if (settings.headers) for (name in settings.headers) setHeader(name, settings.headers[name])
    xhr.setRequestHeader = setHeader

    xhr.onreadystatechange = function(){
      // readyState 4 请求完成 
      // 3:下载中，部分响应数据已经可以使用 2:请求已经发送，可以获取响应头和状态 status 1:已经调用 open 方法 0:xhr 实例已经创建，但是还没有调用 open 方法
      if (xhr.readyState == 4) {
        xhr.onreadystatechange = empty
        clearTimeout(abortTimeout)
        var result, error = false
        // TODO protocol file
        if ((xhr.status >= 200 && xhr.status < 300) || xhr.status == 304 || (xhr.status == 0 && protocol == 'file:')) {
          dataType = dataType || mimeToDataType(settings.mimeType || xhr.getResponseHeader('content-type'))

          // 二进制数据
          if (xhr.responseType == 'arraybuffer' || xhr.responseType == 'blob')
            result = xhr.response
          else {
            // DOMString
            //  XMLHttpRequest.responseType 的值不是 text 或者空字符串，届时访问 XMLHttpRequest.responseType 将抛出 InvalidStateError 异常
            result = xhr.responseText

            try {
              // http://perfectionkills.com/global-eval-what-are-the-options/
              // sanitize response accordingly if data filter callback provided
              result = ajaxDataFilter(result, dataType, settings)
              // var x = 'outer';
              // (function() {
              //   eval('console.log("direct call: " + x)'); 
              //   (1,eval)('console.log("indirect call: " + x)'); 
              // })();
              // 确保eval的执行作用域是window 深入理解JavaScript p346
              if (dataType == 'script')    (1,eval)(result)
              else if (dataType == 'xml')  result = xhr.responseXML
              // 内容为空 则返回null
              else if (dataType == 'json') result = blankRE.test(result) ? null : $.parseJSON(result)
            } catch (e) { error = e }

            if (error) return ajaxError(error, 'parsererror', xhr, settings, deferred)
          }

          ajaxSuccess(result, xhr, settings, deferred)
        } else {
          ajaxError(xhr.statusText || null, xhr.status ? 'error' : 'abort', xhr, settings, deferred)
        }
      }
    }

    if (ajaxBeforeSend(xhr, settings) === false) {
      // 终止请求
      xhr.abort()
      ajaxError(null, 'abort', xhr, settings, deferred)
      return xhr
    }

    // 同步还是异步
    var async = 'async' in settings ? settings.async : true
    // 创建ajax请求
    xhr.open(settings.type, settings.url, async, settings.username, settings.password)

    if (settings.xhrFields) for (name in settings.xhrFields) xhr[name] = settings.xhrFields[name]

    // 设置请求报文首部
    for (name in headers) nativeSetHeader.apply(xhr, headers[name])

    if (settings.timeout > 0) abortTimeout = setTimeout(function(){
        xhr.onreadystatechange = empty
        xhr.abort()
        ajaxError(null, 'timeout', xhr, settings, deferred)
      }, settings.timeout)

    // avoid sending empty string (#319)
    xhr.send(settings.data ? settings.data : null)
    return xhr
  }

  // handle optional data/success arguments
  // 用来格式化函数参数
  function parseArguments(url, data, success, dataType) {
    // 缺data, 用undefined代替
    if ($.isFunction(data)) dataType = success, success = data, data = undefined
    // 缺success
    if (!$.isFunction(success)) dataType = success, success = undefined
    return {
      url: url
    , data: data
    , success: success
    , dataType: dataType
    }
  }

  $.get = function(/* url, data, success, dataType */){
    return $.ajax(parseArguments.apply(null, arguments))
  }

  $.post = function(/* url, data, success, dataType */){
    var options = parseArguments.apply(null, arguments)
    options.type = 'POST'
    return $.ajax(options)
  }

  $.getJSON = function(/* url, data, success */){
    var options = parseArguments.apply(null, arguments)
    options.dataType = 'json'
    return $.ajax(options)
  }

  $.fn.load = function(url, data, success){
    if (!this.length) return this
    var self = this, parts = url.split(/\s/), selector,
        options = parseArguments(url, data, success),
        callback = options.success
    if (parts.length > 1) options.url = parts[0], selector = parts[1]
    options.success = function(response){
      self.html(selector ?
        $('<div>').html(response.replace(rscript, "")).find(selector)
        : response)
      callback && callback.apply(self, arguments)
    }
    $.ajax(options)
    return this
  }

  // 用来编码参数
  var escape = encodeURIComponent

  // 参数序列化
  // {p1: 'test1', p2: {nested: 'test2'}, p3: [1,[2]]}
  // 不考虑encode traditional false => p1=test1&p2[nested]=test2&p3[]=1&p3[1][]=2
  // traditional true =>  p1=test1&p2=[object Object]&p3=1&p3=2
  function serialize(params, obj, traditional, scope){
    // obj为数组, 则array为true, 若为纯粹对象, hash为true
    var type, array = $.isArray(obj), hash = $.isPlainObject(obj)
    $.each(obj, function(key, value) {
      // console.log('key', key, 'value', value)
      type = $.type(value)
      // scope 是记录深层嵌套时的 key 值
      if (scope) key = traditional ? scope :
        scope + '[' + (hash || type == 'object' || type == 'array' ? key : '') + ']'
      // handle data in serializeArray() format
      // serializeArray() 格式 from.js
      if (!scope && array) params.add(value.name, value.value)
      // recurse into nested objects
      // 递归嵌套对象
      else if (type == "array" || (!traditional && type == "object"))
        serialize(params, value, traditional, key)
      else params.add(key, value)
    })
  }

  // $.param(object, [shallow])
  $.param = function(obj, traditional){
    var params = []
    params.add = function(key, value) {
      // $.param({ id: function(){ return 1 + 2 } })
      //=> "id=3"
      if ($.isFunction(value)) value = value()
      if (value == null) value = ""
      // encodeURIComponent
      this.push(escape(key) + '=' + escape(value))
      // this.push(key + '=' + value)
    }
    serialize(params, obj, traditional)
    // %20空格替换为+ 
    return params.join('&').replace(/%20/g, '+')
  }
})(Zepto)
