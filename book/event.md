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

focusinSupported主要判断浏览器是否支持foucusin/out事件, foucusin/out事件冒泡, 而focus和blur事件则不冒泡.

mouseover/mouseout事件会冒泡, 而mouseenter/mouseleave则不会冒泡, 但是它们除了是否冒泡之外, 还有其他区别, event模块中, 会用mouseover/mouseout 来模拟mouseenter/mouseleave. 关于这两对事件, 具体可以参考下面链接的文章.

> https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/relatedTarget
> https://juejin.im/post/5935773fa0bb9f0058edbd61

**event模块想要统一事件为冒泡形式, 这样可以对它们做事件委托.**


# 内部函数
## zid(element)
```JavaScript
  function zid(element) {
    return element._zid || (element._zid = _zid++)
  }
```
zid()用于查找DOM元素的_zid属性, 若没有_zid属性, 则用变量_zid赋值,之后自增1. 若使用event模块为DOM元素添加过事件, 那它们会有唯一的标识_zid. event模块会将DOM元素的事件回调函数存入handles[_zid]所指向的数组中, 从而进行统一管理.

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
eventCapture()首先判断handler.del, 若handler.del为true(是事件委托, 事件委托要求事件能够冒泡.), 且在浏览器不支持foucusin时, 绑定的事件为focus/blur, 由于它们不冒泡, 所以只能在事件捕获阶段进行事件委托, return true. 否则, `handler.del && (!focusinSupported && (handler.e in focus))` 判断为false, 由captureSetting来决定, captureSetting默认为undefined, !!captureSetting默认为false.

# 扩展的方法