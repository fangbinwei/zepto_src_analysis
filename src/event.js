//     Zepto.js
//     (c) 2010-2016 Thomas Fuchs
//     Zepto.js may be freely distributed under the MIT license.

;(function($){
  var _zid = 1, undefined,
      slice = Array.prototype.slice,
      isFunction = $.isFunction,
      isString = function(obj){ return typeof obj == 'string' },
      handlers = {},
      specialEvents={},
      // 判断是否在支持focusin事件
      focusinSupported = 'onfocusin' in window,
      // focusin/out 支持冒泡 blur,focus不支持冒泡
      focus = { focus: 'focusin', blur: 'focusout' },
      // mouseover/out 支持冒泡 mouseenter/leave不支持冒泡
      hover = { mouseenter: 'mouseover', mouseleave: 'mouseout' }

  specialEvents.click = specialEvents.mousedown = specialEvents.mouseup = specialEvents.mousemove = 'MouseEvents'

  function zid(element) {
    // 若没有_zid属性, 则全局_zid赋值,之后自增1
    return element._zid || (element._zid = _zid++)
  }
  // 查找缓存的handler
  // {
  //   fn: '', // 函数
  //   e: '', // 事件名
  //   ns: '', // 命名空间
  //   sel: '',  // 选择器
  //   i: '', // 函数索引
  //   del: '', // 委托函数
  //   proxy: '', // 代理函数
  // }
  function findHandlers(element, event, fn, selector) {
    event = parse(event)
    // 如果有命名空间
    if (event.ns) var matcher = matcherFor(event.ns)
    // handlers[zid(element)]为数组 
    return (handlers[zid(element)] || []).filter(function(handler) {
      return handler
      // event.e 存在, 则需满足hander.e == event.e
        && (!event.e  || handler.e == event.e)
        && (!event.ns || matcher.test(handler.ns))
        // zid来判断是否为同一个fn, 如果它们的zid相同, 则是同一个fn, zid(element)可以添加/读取_id
        // $.proxy(fn, context), 相同fn, 不同context会返回不同的代理函数, 但是这两个代理函数_zid是相同的
        // two functions that are not === can have the same _zid
        && (!fn       || zid(handler.fn) === zid(fn))
        && (!selector || handler.sel == selector)
    })
  }
  function parse(event) {
    // 命名空间 eventType.ns1.ns2
    var parts = ('' + event).split('.')
    // e: eventType ns: 'ns1 ns2'
    return {e: parts[0], ns: parts.slice(1).sort().join(' ')}
  }
  function matcherFor(ns) {
    // ns: 'ns1 ns2' return new RegExp('(?:^| )ns1 .* ?ns2(?: |$)')
    return new RegExp('(?:^| )' + ns.replace(' ', ' .* ?') + '(?: |$)')
  }

  // 返回true表示在事件捕获阶段执行handler, 否则冒泡阶段
  function eventCapture(handler, captureSetting) {
    return handler.del &&
    // 浏览器不支持foucusin 且绑定事件为focus/blur, 由于它们不冒泡, 所以时间委托需要在事件捕获阶段
      (!focusinSupported && (handler.e in focus)) ||
      // 用captureSetting来设置
      !!captureSetting
  }

  // 将 focus/blur 转换成 focusin/focusout ，
  // 将 mouseenter/mouseleave 转换成 mouseover/mouseout 事件
  function realEvent(type) {
    return hover[type] || (focusinSupported && focus[type]) || type
  }

  // element 事件绑定的元素 元素有zid属性
  // events 需要绑定的事件 可以是多个事件
  // fn 事件的回调函数
  // data 事件执行时,传递给事件对象的数据 e.data
  // selector 事件绑定的选择器, 在$.fn.on中用于事件委托
  // delegator 事件委托函数
  // capture
  function add(element, events, fn, data, selector, delegator, capture){
    var id = zid(element), set = (handlers[id] || (handlers[id] = []))
    events.split(/\s/).forEach(function(event){
      // Zepto 的ready ($.fn.ready)
      if (event == 'ready') return $(document).ready(fn)
    // parse return {e: parts[0], ns: parts.slice(1).sort().join(' ')}
      var handler   = parse(event)
      // 缓存handler的一些属性
      handler.fn    = fn
      handler.sel   = selector
      // emulate mouseenter, mouseleave
      // 用mouseover/out 模拟 mouseenter/leave
      if (handler.e in hover) fn = function(e){
        var related = e.relatedTarget
        // related不存在, 或 related不为当前绑定事件的元素/子元素, 从而避免mouseover/out事件的反复触发, 从而模拟mouseenter/leave
        if (!related || (related !== this && !$.contains(this, related)))
          return handler.fn.apply(this, arguments)
      }
      handler.del   = delegator
      var callback  = delegator || fn
      // handler的代理函数, 可以方便地对event对象进行修正扩展
      handler.proxy = function(e){
        e = compatible(e)
        // 如果isImmediate... 返回true  说明stopImmediatePropagation执行过, 直接退出函数
        if (e.isImmediatePropagationStopped()) return
        // 扩展e对象,加入data属性
        e.data = data
        // trigger 的事件, 可能会有e._args
        var result = callback.apply(element, e._args == undefined ? [e] : [e].concat(e._args))
        // 阻止默认行为和冒泡行为
        if (result === false) e.preventDefault(), e.stopPropagation()
        return result
      }
      // index
      handler.i = set.length
      // 添加到handlers[id]数组中
      set.push(handler)
      if ('addEventListener' in element)
        element.addEventListener(realEvent(handler.e), handler.proxy, eventCapture(handler, capture))
    })
  }
  // 删除事件
  function remove(element, events, fn, selector, capture){
    var id = zid(element)
    ;(events || '').split(/\s/).forEach(function(event){
      // 找到对应element的handlers[id]
      findHandlers(element, event, fn, selector).forEach(function(handler){
        // 删除handlers中的属性
        delete handlers[id][handler.i]
      if ('removeEventListener' in element)
      // 删除事件
        element.removeEventListener(realEvent(handler.e), handler.proxy, eventCapture(handler, capture))
      })
    })
  }

  $.event = { add: add, remove: remove }
  // $.event = { add: add, remove: remove, handlers: handlers}

  // 工具函数
  $.proxy = function(fn, context) {
    var args = (2 in arguments) && slice.call(arguments, 2)
    // $.proxy(fn, context, [additionalArguments...])
    // 执行函数直接传入
    if (isFunction(fn)) {
      // this指向context, 如果有额外的参数,进行拼接
      var proxyFn = function(){ return fn.apply(context, args ? args.concat(slice.call(arguments)) : arguments) }
      proxyFn._zid = zid(fn)
      return proxyFn
      // 第一个参数为上下文对象, 执行函数也在上下文对象中
    } else if (isString(context)) {
      if (args) {
        args.unshift(fn[context], fn)
        return $.proxy.apply(null, args)
      } else {
        return $.proxy(fn[context], fn)
      }
    } else {
      throw new TypeError("expected function")
    }
  }

  // on实现bind
  $.fn.bind = function(event, data, callback){
    return this.on(event, data, callback)
  }
  // off实现unbind
  $.fn.unbind = function(event, callback){
    return this.off(event, callback)
  }
  // on实现one
  $.fn.one = function(event, selector, data, callback){
    return this.on(event, selector, data, callback, 1)
  }

  var returnTrue = function(){return true},
      returnFalse = function(){return false},
      ignoreProperties = /^([A-Z]|returnValue$|layer[XY]$|webkitMovement[XY]$)/,
      eventMethods = {
        // 阻止默认事件
        preventDefault: 'isDefaultPrevented',
        // 除了该事件的冒泡行为被阻止之外(event.stopPropagation方法的作用),该元素绑定的后序相同类型事件的监听函数的执行也将被阻止
        stopImmediatePropagation: 'isImmediatePropagationStopped',
        stopPropagation: 'isPropagationStopped'
      }

      // 修正不同浏览器event对象的差异
  function compatible(event, source) {
    // 有source 或 event.isDefaultPrevented 不存在, 则进入if语句
    if (source || !event.isDefaultPrevented) {
      source || (source = event)

      // 添加函数isDefaultPrevented()等
      $.each(eventMethods, function(name, predicate) {
        // name: 'preventDefault' predicate: 'isDefaultPrevented'
        var sourceMethod = source[name]
        event[name] = function(){
          // 如果执行preventDefault(), 则.isDefaultPrevented() 返回true
          // 调用方式是event.isDefaultPrevented(), this指向event
          this[predicate] = returnTrue
          return sourceMethod && sourceMethod.apply(source, arguments)
        }
        // 默认isDefaultPrevented() 返回false
        event[predicate] = returnFalse
      })

      // 对于不支持timeStamp的event, 用Date.now()初始该属性
      event.timeStamp || (event.timeStamp = Date.now())

      // 暂时还有疑问 TODO
      // function createProxy(event) 创建一个代理event, 在代理之前event可能已经执行了preventDefault()
      // defaultPrevented返回一个布尔值,表明当前事件的默认动作是否被取消,也就是是否执行了 event.preventDefault()方法.
      if (source.defaultPrevented !== undefined ? source.defaultPrevented :
        // returnValue 默认为 true，如果阻止了浏览器的默认行为， returnValue 会变为 false
          'returnValue' in source ? source.returnValue === false :
          // 已经被废弃的getPreventDefault()方法
          source.getPreventDefault && source.getPreventDefault())
          // if判断为true时
        event.isDefaultPrevented = returnTrue
    }
    return event
  }

  // 创建代理对象
  function createProxy(event) {
    var key, proxy = { originalEvent: event }
    for (key in event)
      // ignoreProperties = /^([A-Z]|returnValue$|layer[XY]$|webkitMovement[XY]$)/,
      // 排除大写字母开头的属性 和一些非标准属性
      if (!ignoreProperties.test(key) && event[key] !== undefined) proxy[key] = event[key]

    return compatible(proxy, event)
  }

  // on实现delegate
  $.fn.delegate = function(selector, event, callback){
    return this.on(event, selector, callback)
  }
  // off实现undelegate
  $.fn.undelegate = function(selector, event, callback){
    return this.off(event, selector, callback)
  }

  // 添加一个个事件处理器到符合目前选择器的所有元素匹配，匹配的元素可能现在或将来才创建 
  $.fn.live = function(event, callback){
    $(document.body).delegate(this.selector, event, callback)
    return this
  }
  // 删除通过live添加的事件
  $.fn.die = function(event, callback){
    $(document.body).undelegate(this.selector, event, callback)
    return this
  }

  $.fn.on = function(event, selector, data, callback, one){
    // autoRemove 响应事件后立即解绑
    var autoRemove, delegator, $this = this
    if (event && !isString(event)) {
      // event是以事件类型为键、以函数为值的对象的形式
      $.each(event, function(type, fn){
        $this.on(type, selector, data, fn, one)
      })
      return $this
    }

    // 修正参数
    // 没给定selector的情况, 参数位置调整一位
    if (!isString(selector) && !isFunction(callback) && callback !== false)
      callback = data, data = selector, selector = undefined
    // data没有传递的情况,参数位置调整一位
    if (callback === undefined || data === false)
      callback = data, data = undefined

      // callback为false 用returnFalse函数替代
    if (callback === false) callback = returnFalse

    return $this.each(function(_, element){
      // 添加一个处理事件到元素，当第一次执行事件以后，该事件将自动解除绑定，保证处理函数在每个元素上最多执行一次
      // autoRemove 执行后自动解除绑定
      if (one) autoRemove = function(e){
        remove(element, e.type, callback)
        // add()函数中,handler.proxy可能会传入除e以外的函数
        return callback.apply(this, arguments)
      }

      // selector存在,做事件代理
      if (selector) delegator = function(e){
        // context为element, 从e.target 向上查找 css选择器(selector)
        var evt, match = $(e.target).closest(selector, element).get(0)
        // 注意这边match!==element, selector不能是选择element的
        if (match && match !== element) {
          // 对e进行扩展 记录currentTarget liveFired
          evt = $.extend(createProxy(e), {currentTarget: match, liveFired: element})
          // 若有autoRemove 则执行, 否则执行callback
        // add()函数中,handler.proxy可能会传入除e以外的函数
          return (autoRemove || callback).apply(match, [evt].concat(slice.call(arguments, 1)))
        }
      }

      // 遍历元素集合,每个元素都调用add方法,绑定事件, delegator包含autoRemove
      add(element, event, callback, data, selector, delegator || autoRemove)
    })
  }
  $.fn.off = function(event, selector, callback){
    var $this = this
    if (event && !isString(event)) {
      // event是以事件类型为键、以函数为值的对象的形式
      $.each(event, function(type, fn){
        $this.off(type, selector, fn)
      })
      return $this
    }

    // 修正参数, selector传递的是callback
    if (!isString(selector) && !isFunction(callback) && callback !== false)
      callback = selector, selector = undefined

    if (callback === false) callback = returnFalse

    return $this.each(function(){
      remove(this, event, callback, selector)
    })
  }

  $.fn.trigger = function(event, args){
    event = (isString(event) || $.isPlainObject(event)) ? $.Event(event) : compatible(event)
    event._args = args
    return this.each(function(){
      // handle focus(), blur() by calling them directly
      if (event.type in focus && typeof this[event.type] == "function") this[event.type]()
      // items in the collection might not be DOM elements
      else if ('dispatchEvent' in this) this.dispatchEvent(event)
      else $(this).triggerHandler(event, args)
    })
  }

  // triggers event handlers on current element just as if an event occurred,
  // doesn't trigger an actual event, doesn't bubble
  // 直接触发事件回调函数, 并不冒泡
  $.fn.triggerHandler = function(event, args){
    var e, result
    this.each(function(i, element){
      // event为string 或 event对象
      e = createProxy(isString(event) ? $.Event(event) : event)
      e._args = args
      e.target = element
      $.each(findHandlers(element, event.type || event), function(i, handler){
        // 执行回调
        result = handler.proxy(e)
        if (e.isImmediatePropagationStopped()) return false
      })
    })
    return result
  }

  // shortcut methods for `.bind(event, fn)` for each event type
  ;('focusin focusout focus blur load resize scroll unload click dblclick '+
  'mousedown mouseup mousemove mouseover mouseout mouseenter mouseleave '+
  'change select keydown keypress keyup error').split(' ').forEach(function(event) {
    $.fn[event] = function(callback) {
      return (0 in arguments) ?
        this.bind(event, callback) :
        this.trigger(event)
    }
  })

  // 创建并初始化一个指定的DOM事件。如果给定properties对象，使用它来扩展出新的事件对象。默认情况下，事件被设置为冒泡方式；这个可以通过设置bubbles为false来关闭
  // 这种方式deprecated https://developer.mozilla.org/en-US/docs/Web/Guide/Events/Creating_and_triggering_events
  $.Event = function(type, props) {
    // 若type不是string, props可以用来扩展出新的事件对象
    if (!isString(type)) props = type, type = props.type
    var event = document.createEvent(specialEvents[type] || 'Events'), bubbles = true
    // props 中的属性设置加入event中, 并且判断是否对bubbles有所设置
    if (props) for (var name in props) (name == 'bubbles') ? (bubbles = !!props[name]) : (event[name] = props[name])
    // 初始化事件
    event.initEvent(type, bubbles, true)
    return compatible(event)
  }

})(Zepto)
