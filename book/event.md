# event

# event模块做了些什么?

//...
# 整体代码结构

event模块同样是包裹在IIFE内, 传入Zepto(\$), 并在\$上扩展一些事件相关的方法, 像是\$.fn.on, \$.Event
```JavaScript
;(function($){
  var _zid = 1, undefined,
      slice = Array.prototype.slice,
      isFunction = $.isFunction,
      // ...一些变量定义


  function zid(element) {
    return element._zid || (element._zid = _zid++)
  }
  function findHandlers(element, event, fn, selector) {
  //...
  }
 // 内部函数... 

  $.event = { add: add, remove: remove }

  $.proxy = function(fn, context) {
  //...
  }
    //一些扩展方法...

})(Zepto)
```

# 一些变量的定义
```JavaScript
      focusinSupported = 'onfocusin' in window,
      focus = { focus: 'focusin', blur: 'focusout' },
      hover = { mouseenter: 'mouseover', mouseleave: 'mouseout' }
```

focusinSupported主要判断浏览器是否支持foucusin/out事件, foucusin/out事件冒泡, 而focus和blur事件则不冒泡.具体可以参考下面的文章,
> https://segmentfault.com/a/1190000003942014

mouseover/mouseout事件会冒泡, 而mouseenter/mouseleave则不会冒泡, 但是它们除了是否冒泡之外, 还有其他区别, event模块中, 会用mouseover/mouseout 来模拟mouseenter/mouseleave. 关于这两对事件, 具体可以参考下面链接的文章.

> https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/relatedTarget
> https://juejin.im/post/5935773fa0bb9f0058edbd61

**event模块想要统一事件为冒泡形式, 这样可以对它们做事件委托.**

***

# 内部函数
## zid(element)
```JavaScript
  function zid(element) {
    return element._zid || (element._zid = _zid++)
  }
```
zid()用于查找DOM元素的_zid属性, 若没有_zid属性, 则用变量_zid赋值,之后自增1. 若使用event模块为DOM元素添加过事件, 那它们会有唯一的标识_zid. event模块会将DOM元素的事件回调函数(handler)存入handlers[_zid]所指向的数组中, 从而进行统一管理.

## parse(event)
```JavaScript
  function parse(event) {
    var parts = ('' + event).split('.')
    return {e: parts[0], ns: parts.slice(1).sort().join(' ')}
  }
```
parse()函数用于解析event的名称, zepto中, event的名称可以带有命名空间, 例如`click.namespace1.namespace2`

函数最后返回的形式如`{e: 'click', ns: 'namespace1 namespace2'}`, 命名空间还使用了`sort()`按照字符串进行排序.

## matcherFor(ns)
```JavaScript
  function matcherFor(ns) {
    // ns: 'ns1 ns2' return new RegExp('(?:^| )ns1 .* ?ns2(?: |$)')
    return new RegExp('(?:^| )' + ns.replace(' ', ' .* ?') + '(?: |$)')
  }
```
matcherFor()函数返回一个实例化的RegExp正则表达式, 用于匹配event名称的命名空间, 例如 `'ns1 ns2'`, 返回的是 `new RegExp('(?:^| )ns1 .* ?ns2(?: |$)')`, 该正则表达式匹配得非常宽松...

## eventCapture(handler, captureSetting)
```javascript
  function eventCapture(handler, captureSetting) {
    return handler.del &&
      (!focusinSupported && (handler.e in focus)) ||
      !!captureSetting
  }
```
eventCapture()函数用于决定在事件的捕获阶段调用回调函数, 还是事件的冒泡阶段调用回调函数, 即`addEventListener`的第三个参数.

当是用 zepto为DOM元素绑定事件的时候, 其会创建一个handler来缓存事件的相关信息, 一个handler包含的信息如下,
```
  // handler
  // {
  //   fn: '', // 回调函数
  //   e: '', // 事件名
  //   ns: '', // 命名空间
  //   sel: '',  // 选择器
  //   i: '', // 在handlers[_zid]中的索引
  //   del: '', // 委托函数
  //   proxy: '', // 代理函数
  // }
```
这边提一下代理函数, zepto绑定事件的回调的时候, 并不是直接在`addEventListener`上传入我们所设定的回调函数fn, 而是传入了fn的一个代理函数proxy, 执行回调的时候, 事件参数e会传给代理函数proxy, proxy对参数e进行一些修正后, 再传给回调函数fn使用. 是设计模式中 代理模式的一种应用.

```JavaScript
    return handler.del &&
      (!focusinSupported && (handler.e in focus)) ||
      !!captureSetting
```
eventCapture()首先判断handler.del, 若handler.del为true(是事件委托, 事件委托要求事件能够冒泡, 不冒泡到不了接受委托的那个元素.), 且在浏览器不支持foucusin时, 绑定的事件为focus/blur, 由于它们不冒泡, 所以只能在事件捕获阶段进行事件委托, return true( 让接受事件委托的那个元素在事件捕获阶段调用事件的回调). 否则, `handler.del && (!focusinSupported && (handler.e in focus))` 判断为false, 由captureSetting来决定, captureSetting默认为undefined, !!captureSetting默认为false.

## findHandlers(element, event, fn, selector)
```javascript
  function findHandlers(element, event, fn, selector) {
    event = parse(event)
    if (event.ns) var matcher = matcherFor(event.ns)
    return (handlers[zid(element)] || []).filter(function(handler) {
      return handler
        && (!event.e  || handler.e == event.e)
        && (!event.ns || matcher.test(handler.ns))
        && (!fn       || zid(handler.fn) === zid(fn))
        && (!selector || handler.sel == selector)
    })
  }
```
element的事件handler会缓存在handlers[zid(element)]中的数组内. 该函数就是用于handler的查找, 缓存handlers可以在需要的时候触发它们, \$.fn.triggerHandler(event, args) 了解一下.

```JavaScript
    event = parse(event)
    if (event.ns) var matcher = matcherFor(event.ns)
```
该函数首先调用了parse()来解析其命名空间, 如果设置了命名空间, 则调用matcherFor()生成命名空间的正则表达式.

根据zid(element)确定element的_zid, handler是以_zid为索引存在handlers[_zid]的数组内, 使用数组的filter方法过滤符合条件的handler.

若存在even.e/ns, fn, selector, 分别和handler中的属性进行比对.

这里有一个需要注意的地方, 判断是否是同一个函数fn, 正常来说应该是使用`handler.fn === fn`, 而这里是用函数的_zid来判断, 这个判断条件相对宽松一点. 两个并不完全相同的函数, 可以有相同的_zid(two functions that are not === can have the same _zid ), 比如一个函数fn, 和\$.proxy(fn, context) 返回的函数有相同的_zid, $.proxy(fn, context)可以指定一个上下文context, 后面会讲到.

## realEvent(type)
```JavaScript
  function realEvent(type) {
    return hover[type] || (focusinSupported && focus[type]) || type
  }
```
realEvent()函数, 若提供focus/blur, 在支持focusin的情况下, 返回 focusin/focusout; 若提供mouseenter/leave的情况下, 返回mouseover/out, 主要在addEventListener时统一事件冒泡.

## compatible(event, source)
1. 当只传入一个参数时, compatible(event) 用于修正事件对象event并扩展相关方法. 
2. 若传入两个参数, compatible(event, source) source为事件对象, compatible()函数为代理对象event扩展source中的相关方法, 如用source中的preventDefault()为event扩展isDefaultPrevented().

```JavaScript
    if (source || !event.isDefaultPrevented) {
      source || (source = event)
      //...
    }
    return event
```
若存在source, 或者event中没有定义isDefaultPrevented, 则执行if语句中的内容, 否则直接返回 event. 

若没有传入source, 对应上面说的情况1, 则直接将source赋值为event.

```JavaScript
  $.each(eventMethods, function(name, predicate) {
    var sourceMethod = source[name]
    event[name] = function(){
      this[predicate] = returnTrue
      return sourceMethod && sourceMethod.apply(source, arguments)
    }
    event[predicate] = returnFalse
  })

```
```JavaScript
  var returnTrue = function(){return true},
      returnFalse = function(){return false},
      eventMethods = {
        preventDefault: 'isDefaultPrevented',
        stopImmediatePropagation: 'isImmediatePropagationStopped',
        stopPropagation: 'isPropagationStopped'
      }
```
遍历eventMethod对象, 为event扩展isDefaultPrevented/ isImmediatePropagationStopped/ isPropagationStopped方法, 默认为returnFalse, 返回false, 当event.preventDefault/stopImmediatePropagation/ stopPropagation 被调用后, 则替换为returnTrue, 返回true.

关于preventDefault, stopPropagation等方法的区别, 可以看下面的资料

> https://developer.mozilla.org/en-US/docs/Web/API/Event/stopImmediatePropagation
> https://developer.mozilla.org/en-US/docs/Web/API/Event/stopPropagation
> https://developer.mozilla.org/en-US/docs/Web/API/Event/preventDefault

```JavaScript
  event.timeStamp || (event.timeStamp = Date.now())
```
若event中没有timeStamp属性, 用Date.now()来初始化.

```JavaScript
      if (source.defaultPrevented !== undefined ? source.defaultPrevented :
          'returnValue' in source ? source.returnValue === false :
          source.getPreventDefault && source.getPreventDefault())
        event.isDefaultPrevented = returnTrue
```
returnValue 默认为 true，如果阻止了浏览器的默认行为， returnValue 会变为 false. getPreventDefault()方法已经被废弃.

这段代码是向确认在compatible调用之前,event是否调用了preventDefault(). 在delegate中createProxy会创建一个新的event对象, 所以会将isDefaultPrevented初始化, 所以需要通过defaultPrevented再判断一遍. 具体可以参考[这篇文章](https://github.com/fangbinwei/zepto_src_analysis/issues/3).

## createProxy(event)
createProxy()函数, 主要用于创建一个代理事件对象, 排除原事件对象中的一些非标准属性.
```JavaScript
  ignoreProperties = /^([A-Z]|returnValue$|layer[XY]$|webkitMovement[XY]$)/
  function createProxy(event) {
    var key, proxy = { originalEvent: event }
    for (key in event)
      if (!ignoreProperties.test(key) && event[key] !== undefined) proxy[key] = event[key]

    return compatible(proxy, event)
  }
```
ignoreProperties是一个正则表达式, 用于排除event中一些大写字母开头的属性,一些非标准属性. proxy中仍然保留了对原事件对象的引用.

# 扩展的方法
## $.fn.on(event, selector, data, callback, one)
$.fn.on()主要用于事件的绑定, selector, data, one都是可选参数.
### 变量声明
```JavaScript
var autoRemove, delegator, $this = this
```
autoRemove主要用在设置了one参数的场景下, 响应事件后就解除事件的绑定. delegator是用于事件委托的场景下.

```JavaScript
    if (event && !isString(event)) {
      // event是以事件类型为键、以函数为值的对象的形式
      $.each(event, function(type, fn){
        $this.on(type, selector, data, fn, one)
      })
      return $this
    }
```

### 修正传入参数
如果event存在, 并且不是字符串, event模块期望event是一个对象, 以事件类型为键, 回调函数为值的形式. 并调用\$this.on()传入从event对象中取得的事件类型, 回调函数.
```JavaScript
    if (!isString(selector) && !isFunction(callback) && callback !== false)
      callback = data, data = selector, selector = undefined
```
如果selector不是字符串, callback不是函数 且不为 false, 这种情况是没有传入可选的参数selector, selector是配合delegator做事件委托的. 因此修正参数向后移动一位, 将selector置为undefined.

```JavaScript
    if (callback === undefined || data === false)
      callback = data, data = undefined
```
没有传入可选的参数data, data传入的其实是callback.

```JavaScript
    if (callback === false) callback = returnFalse
```
如果callback传入的是false, 则回调callback用returnFalse代替, returnFalse不做任何操作, 直接返回false.

### 返回值
```JavaScript
    return $this.each(function(_, element){
      if (one) autoRemove = function(e){
        remove(element, e.type, callback)
        return callback.apply(this, arguments)
      }

      if (selector) delegator = function(e){
        var evt, match = $(e.target).closest(selector, element).get(0)
        if (match && match !== element) {
          evt = $.extend(createProxy(e), {currentTarget: match, liveFired: element})
          return (autoRemove || callback).apply(match, [evt].concat(slice.call(arguments, 1)))
        }
      }

      add(element, event, callback, data, selector, delegator || autoRemove)
    })
```
$.fn.on() 返回的整体是 $.fn.each(), 遍历Zepto对象中DOM元素进行事件绑定,可以链式调用.

```JavaScript
  if (one) autoRemove = function(e){
    remove(element, e.type, callback)
    return callback.apply(this, arguments)
  }
```
若传入了one参数, !!one为true, 则设置autoRemove, 会调用remove()函数解除事件的绑定, 并调用callback回调.

```JavaScript
  if (selector) delegator = function(e){
    var evt, match = $(e.target).closest(selector, element).get(0)
    if (match && match !== element) {
      evt = $.extend(createProxy(e), {currentTarget: match, liveFired: element})
      return (autoRemove || callback).apply(match, [evt].concat(slice.call(arguments, 1)))
    }
  }
```
若传入了selector参数, 则说明是要做事件委托, 则创建delegator函数, 如下的示例.
```JavaScript
// all clicks inside links in the document
$(document).on('click', 'a', function(e){ ... })
// disable following any navigation link on the page
$(document).on('click', 'nav a', false)
```
```JavaScript
    var evt, match = $(e.target).closest(selector, element).get(0)
```
match是事件委托匹配到的DOM元素, 是利用\$.fn.closest 从e.target元素开始, 往上查找匹配css选择器的元素, 并用get(0)来取出匹配到的第一个DOM元素.

```JavaScript
    if (match && match !== element) {
      evt = $.extend(createProxy(e), {currentTarget: match, liveFired: element})
      return (autoRemove || callback).apply(match, [evt].concat(slice.call(arguments, 1)))
    }
```
若匹配到match, 需要注意match !== element这个条件, 说明selector是不能用来选择element的. 

接着创建一个代理事件对象evt, 并扩展了两个属性currentTarget, 指触发事件的元素, liveFired指用于事件委托的元素.

```JavaScript
    return (autoRemove || callback).apply(match, [evt].concat(slice.call(arguments, 1)))
```
delegator()的return 以match为context执行了回调,并传入代理事件对象evt, 使用slice方法删除原生e对象. delegator()函数已经包含了autoRemove()函数的情况.

```JavaScript
  add(element, event, callback, data, selector, delegator || autoRemove)
```
最后使用内部函数add()进行事件绑定.


> return false from a DOM2 handler (addEventListener) does nothing at all (neither prevents the default nor stops bubbling; from a Microsoft DOM2-ish handler (attachEvent), it prevents the default but not bubbling; from a DOM0 handler (onclick="return ..."), it prevents the default (provided you include the return in the attribute) but not bubbling; from a jQuery event handler, it does both, because that's a jQuery thing.

> https://stackoverflow.com/questions/30473581/when-to-use-preventdefault-vs-return-false

> https://stackoverflow.com/questions/1357118/event-preventdefault-vs-return-false

### add()


### remove()

## $.fn.off()