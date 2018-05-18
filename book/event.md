# event

# event模块做了些什么?
- event模块尽量使用了能够冒泡的事件, 这样更容易进行事件委托. 
- 并提供了一些创建事件, 触发事件的方法. 
- 对事件对象e做了相关兼容和扩展.
- 提供事件绑定的方法, 同时进行多个事件的绑定,可以方便地设置一些额外功能, 如执行一次后就解决事件的绑定等.

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
delegator()的return 以match为context执行了回调,并传入代理事件对象evt, 使用slice方法删除原生事件e对象. delegator()函数已经包含了autoRemove()函数的情况.

```JavaScript
  add(element, event, callback, data, selector, delegator || autoRemove)
```
最后使用内部函数add()进行事件绑定.

### add(element, events, fn, data, selector, delegator, capture)
add()函数调用addEventListener(), 使用$.fn.on()提供的参数进行事件绑定, 并缓存事件的相关属性(如callback等)到handlers.

```javascript
    var id = zid(element), set = (handlers[id] || (handlers[id] = []))
```
首先获得element的_zid, 以_zid为索引, 将handler缓存在handlers[_zid]的数组set内.

#### 遍历事件
```JavaScript
    events.split(/\s/).forEach(function(event){
    // ...
    })
```
由于传入的event是可以同时包含多个事件的字符串, 如'click mouseenter', 所以add()函数使用split(/\s/) 配合数组的foreEach进行遍历.

```JavaScript
   if (event == 'ready') return $(document).ready(fn)
```
如果传入的事件是'ready', 则调用\$.fn.ready(), 若DOM未完全加载, 绑定DOMContentLoaded事件, 若DOM已完全加载解析, 直接调用回调fn.

#### 缓存handler的一些属性
```JavaScript
  var handler   = parse(event)
  handler.fn    = fn
  handler.sel   = selector
```
handler初始值是parse()返回的对象, 并缓存了fn, sel等属性.

```JavaScript
  if (handler.e in hover) fn = function(e){
    var related = e.relatedTarget
    if (!related || (related !== this && !$.contains(this, related)))
      return handler.fn.apply(this, arguments)
  }
```
如果事件是mouseenter/leave, 则使用mouseover/out来模拟.

对于mouseover事件来说，该属性是鼠标指针移到目标节点上时所离开的那个节点。
对于mouseout事件来说，该属性是离开目标时，鼠标指针进入的节点。

related不存在, 或 related不为当前绑定事件的元素/子元素, 就可以模拟mouseenter/leave. 下面这篇文章说得很详细.

> https://juejin.im/post/5935773fa0bb9f0058edbd61

```JavaScript
  handler.del   = delegator
  var callback  = delegator || fn
```
若设置了事件委托, 则callback赋值为delegator, 否则使用回调函数fn.

```JavaScript
      handler.proxy = function(e){
        e = compatible(e)
      if (e.isImmediatePropagationStopped()) return
        e.data = data
        var result = callback.apply(element, e._args == undefined ? [e] : [e].concat(e._args))
        if (result === false) e.preventDefault(), e.stopPropagation()
        return result
      }
```
设置代理回调函数, 使用addEventListener()绑定的其实是这个代理回调函数, 代理回调函数可以对事件参数e做一些兼容处理, 或一些其它的预处理, 然后再将事件参数e传给真正的回调函数callback.

```JavaScript
    e = compatible(e)
```
对事件参数e做兼容扩展处理.

```JavaScript
    if (e.isImmediatePropagationStopped()) return
```
如果事件参数e调用过stopImmediatePropagation, 则直接返回, 不执行下面的代码. 之所以要这么做, 是为了兼容没有原生支持stopImmediatePropagation()方法的浏览器,如Android2.3.

```JavaScript
    e.data = data
```
扩展e对象,加入data属性.

```JavaScript
        var result = callback.apply(element, e._args == undefined ? [e] : [e].concat(e._args))
        if (result === false) e.preventDefault(), e.stopPropagation()
        return result
```
e._args在\$.fn.triggerhandler()方法中可能会传入, 所以若不为undefined, 则用concat()拼接传给callback.apply().

若callback的返回值是false, 则阻止默认行为和冒泡.

在addEventListener()中return false, 它不会做任何事, 如果在`onclick=`这种形式中使用`return false` 会阻止默认行为, 等同于使用`e.preventDefault()`

```javascript
document.oncontextmenu = function(event) {
    return false// 等同event.preventDefault()
}
```
具体可以参考下面的内容.

> return false from a DOM2 handler (addEventListener) does nothing at all (neither prevents the default nor stops bubbling; from a Microsoft DOM2-ish handler (attachEvent), it prevents the default but not bubbling; from a DOM0 handler (onclick="return ..."), it prevents the default (provided you include the return in the attribute) but not bubbling; from a jQuery event handler, it does both, because that's a jQuery thing.

> https://stackoverflow.com/questions/30473581/when-to-use-preventdefault-vs-return-false

> https://stackoverflow.com/questions/1357118/event-preventdefault-vs-return-false

```JavaScript
  handler.i = set.length
  set.push(handler)
```
设置handler在set(handlers[_zid])中的index, 并将handler push到set中.

#### 绑定事件
```JavaScript
      if ('addEventListener' in element)
        element.addEventListener(realEvent(handler.e), handler.proxy, eventCapture(handler, capture))
```
使用addEventListener()进行事件绑定, realEvent()将使用mouseover/out替换mouseenter/leave事件, 在支持focusin事件的情况下, 使用focusin/out 替换 focus/blur.

eventCapture() 在使用事件委托, 且浏览器不支持focusin的时候, 设置为在捕获阶段调用事件处理程序.

## $.fn.off()
\$.fn.off()主要用于解除事件的绑定, 调用了内部函数remove()

```JavaScript
var $this = this
    if (event && !isString(event)) {
      $.each(event, function(type, fn){
        $this.off(type, selector, fn)
      })
      return $this
    }
```
首先对传入的参数做一个判断, 如若event是以事件类型为键, 回调函数为值的对象形式, 则使用\$.each()遍历, 递归调用\$.fn.off()

```JavaScript
    if (!isString(selector) && !isFunction(callback) && callback !== false)
      callback = selector, selector = undefined

    if (callback === false) callback = returnFalse
```
修正参数, 没有没有传递selector, 那selector实际传入的是callback(callback也许也没传). 如果callback是false, 则使用returnFalse代替, 因为绑定事件时, callback是false, 绑定的就是returnFalse.

```JavaScript
    return $this.each(function(){
      remove(this, event, callback, selector)
    })
```
遍历Zepto对象(\$.())中的DOM元素, 使用remove解除事件绑定.

### remove()
```javascript
  function remove(element, events, fn, selector, capture){
    var id = zid(element)
    ;(events || '').split(/\s/).forEach(function(event){
      findHandlers(element, event, fn, selector).forEach(function(handler){
        delete handlers[id][handler.i]
      if ('removeEventListener' in element)
        element.removeEventListener(realEvent(handler.e), handler.proxy, eventCapture(handler, capture))
      })
    })
  }
```
remove 函数会使用removeEventListener()解除事件的绑定, 并删除其在handlers中的缓存.

首先获取传入element的_zid, 并遍历传入的events字符串, 传入的events可以包含多个事件, 其实不传入也没关系, 那样会删除element上绑定的所有事件.

```JavaScript
      findHandlers(element, event, fn, selector).forEach(function(handler){
        delete handlers[id][handler.i]
      if ('removeEventListener' in element)
        element.removeEventListener(realEvent(handler.e), handler.proxy, eventCapture(handler, capture))
      })
```
对所遍历到的event, 使用findHandlers()来找到他们的handler, 并使用delete删除, 并使用element.removeEventListener()解除事件的绑定. 若没有传入event, findHandlers()返回的是element上所有handler.

## $.proxy(fn, context)
> 接受一个函数，然后返回一个新函数，并且这个新函数始终保持了特定的上下文(context)语境，新函数中this指向context参数。另外一种形式，原始的function是从上下文(context)对象的特定属性读取。 如果传递超过2个的额外参数，它们被用于传递给fn参数的函数 引用。

$.proxy()主要是让函数fn在制定的上下文context下执行, 类似于bind()函数
```JavaScript
  $.proxy = function(fn, context) {
    var args = (2 in arguments) && slice.call(arguments, 2)
    if (isFunction(fn)) {
      var proxyFn = function(){ return fn.apply(context, args ? args.concat(slice.call(arguments)) : arguments) }
      proxyFn._zid = zid(fn)
      return proxyFn
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
```
 
 ```JavaScript
    var args = (2 in arguments) && slice.call(arguments, 2)
 ```
 如果传入超过2个参数, 将后面的参数提取出来赋值给args.
 
 ```JavaScript
  if (isFunction(fn)) {
      var proxyFn = function(){ return fn.apply(context, args ? args.concat(slice.call(arguments)) : arguments) }
      proxyFn._zid = zid(fn)
      return proxyFn
    } else if (isString(context)) {
    //...
    }
    //...
 ```
 若fn是函数, 则构建一个代理函数返回, 内部使用apply()来指定context, 将args作为参数加到arguments前面.

另一种情况是fn是一个对象字面量, `$.proxy(context, property)`

```JavaScript
  } else if (isString(context)) {
  if (args) {
    args.unshift(fn[context], fn)
    return $.proxy.apply(null, args)
  } else {
```
使用unshift(), 将函数和执行上下面加入到args的数组中, 再调用\$.proxy.apply()

```JavaScript
    } else {
      throw new TypeError("expected function")
    }
```
最后, 不过不满足传入参数的格式要求, 抛出错误.

## $.fn.on(), $.fn.off()衍生的方法
```JavaScript
  $.fn.bind = function(event, data, callback){
    return this.on(event, data, callback)
  }
  $.fn.unbind = function(event, callback){
    return this.off(event, callback)
  }
  $.fn.one = function(event, selector, data, callback){
    return this.on(event, selector, data, callback, 1)
  }
    $.fn.delegate = function(selector, event, callback){
    return this.on(event, selector, callback)
  }
  $.fn.undelegate = function(selector, event, callback){
    return this.off(event, selector, callback)
  }

  $.fn.live = function(event, callback){
    $(document.body).delegate(this.selector, event, callback)
    return this
  }
  $.fn.die = function(event, callback){
    $(document.body).undelegate(this.selector, event, callback)
    return this
  }
```

## $.fn.trigger(event, args)
该方法主要用于触发事件.
```JavaScript
    event = (isString(event) || $.isPlainObject(event)) ? $.Event(event) : compatible(event)
    event._args = args
```
如果传入的是字符串, 或对象字面量(关于\$.isPlainObject()具体参考[这篇文章](http://snandy.iteye.com/blog/663245)), 则使用\$.Event()创建一个事件, 否则调用compatible(). 将需要传递的参数保存在event._args中.

```JavaScript
    return this.each(function(){
      // handle focus(), blur() by calling them directly
      if (event.type in focus && typeof this[event.type] == "function") this[event.type]()
      // items in the collection might not be DOM elements
      else if ('dispatchEvent' in this) this.dispatchEvent(event)
      else $(this).triggerHandler(event, args)
    })
```
遍历Zepto对象中的DOM元素, 如果要触发focus/blur事件, 直接调用focus(), blur(), 否则使用dispatchEvent方法触发事件, 再不行, 就用自己定义的triggerhandler()触发事件的回调函数, 但是这种方式不会冒泡.

## $.fn.triggerHandler(event, args)
```JavaScript
  // triggers event handlers on current element just as if an event occurred,
  // doesn't trigger an actual event, doesn't bubble
  $.fn.triggerHandler = function(event, args){
    var e, result
    this.each(function(i, element){
      e = createProxy(isString(event) ? $.Event(event) : event)
      e._args = args
      e.target = element
      $.each(findHandlers(element, event.type || event), function(i, handler){
        result = handler.proxy(e)
        if (e.isImmediatePropagationStopped()) return false
      })
    })
    return result
  }
```
同样, 先遍历Zepto对象中的DOM元素.
```JavaScript
      e = createProxy(isString(event) ? $.Event(event) : event)
```
若传入的event是字符串, 则使用\$.Event()创建事件对象. 最后使用createProxy()得到一个代理事件对象. 

```JavaScript
      e._args = args
      e.target = element
```
给事件对象添加一些额外的属性.

```JavaScript
  $.each(findHandlers(element, event.type || event), function(i, handler){
    result = handler.proxy(e)
    if (e.isImmediatePropagationStopped()) return false
  })
```
使用findHandlers()找到对应DOM元素的handler, 并调用`handler.proxy(e)`回调函数.

```JavaScript
    if (e.isImmediatePropagationStopped()) return false
```
其实这句话不加, 影响并不是很大, 首先这种\$.fn.triggerHandler()的方式并不冒泡, 且handler.proxy()中, 本身有`if (e.isImmediatePropagationStopped()) return`这句代码, 但是使用`return false`直接调出\$.each()显然更有效率.

## $.Event(type, props)
创建并初始化一个指定的DOM事件. 如果给定properties对象, 使用它来扩展出新的事件对象. 默认情况下, 事件被设置为冒泡方式; 这个可以通过设置bubbles为false来关闭.
```JavaScript
  if (!isString(type)) props = type, type = props.type
```
若type不是字符串, 修正下参数.

```JavaScript
    var event = document.createEvent(specialEvents[type] || 'Events'), bubbles = true
    // specialEvents={} specialEvents.click = specialEvents.mousedown = specialEvents.mouseup = specialEvents.mousemove = 'MouseEvents'
```
创建一个事件对象, 这边specialEvents修正鼠标事件为MouseEvents, 使用document.createEvent()创建事件对象.

```JavaScript
if (props) for (var name in props) (name == 'bubbles') ? (bubbles = !!props[name]) : (event[name] = props[name])
```
将props中的属性拷贝到event中, 并判断props中是否设置了bubbles属性.

```JavaScript
    event.initEvent(type, bubbles, true)
```
初始化事件.

```JavaScript
return compatible(event)
```
返回一个扩展过的事件对象.

### 提醒
这种方式创建自定义对象已经废弃, deprecated 
> https://developer.mozilla.org/en-US/docs/Web/Guide/Events/Creating_and_triggering_events

## shortcut methods
```JavaScript
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
```
在\$.fn上添加一些常用的事件方法, 若传入了callback, 则进行事件绑定, 否则触发事件.
