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
```JavaScript
  function zid(element) {
    return element._zid || (element._zid = _zid++)
  }
```
zid()用于查找DOM元素的_zid属性, 若没有_zid属性, 则用变量_zid赋值,之后自增1. 若使用event模块为DOM元素添加过事件, 那它们会有唯一的标识_zid. event模块会将DOM元素的事件回调函数存入handles[_zid]所指向的数组中, 从而进行统一管理.

# 扩展的方法