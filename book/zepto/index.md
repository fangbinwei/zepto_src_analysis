# 整体结构

首先分析下zepto模块的整体结构.
```javascript
var Zepto = (function() 
// ...
    return $
})()

// If `$` is not yet defined, point it to `Zepto`
window.Zepto = Zepto
window.$ === undefined && (window.$ = Zepto)
```

首先使用一个IIFE（Immediately Invoked Function Expression）避免污染全局变量,并将Zepto变量挂载到window上,若window.$并未定义,则将Zepto赋值给window.$.

***
# 具体结构

这里将zepto模块的内部结构做一个划分.
## Part1
IIFE内部先是对需要用的一些变量进行了定义.
```javascript
var Zepto = (function() 
  var undefined, 
      key, 
      $, 
      classList, 
      // 优化的好办法
      emptyArray = [], 
      concat = emptyArray.concat, 
      filter = emptyArray.filter, 
      slice = emptyArray.slice,
    document = window.document,
    zepto = {},
    //...
  
})()
```
var undefined主要是为了防止window.undefined被覆盖的情况,测试了一下,我使用的chrome版本window.undefined已经无法覆盖.

## Part2
一些内部的私有的工具函数, 在IIFE外部无法访问
```javascript
var Zepto = (function() 
// ...
  function isFunction(value) { return type(value) == "function" }
  // window == window.window
  function isWindow(obj)     { return obj != null && obj == obj.window }
  // document.nodeType 9
  function isDocument(obj)   { return obj != null && obj.nodeType == obj.DOCUMENT_NODE }
  function isObject(obj)     { return type(obj) == "object" }    
  // ...
  
})()
```

## Part3
在内部zepto对象上定义了一些方法,不同于内部私有函数,这些方法在外部可以访问得到, 通过window.Zepto.zepto/window.$.zepto
```javascript
var Zepto = (function() 
  // ...
  zepto.Z = function(dom, selector) {
    return new Z(dom, selector)
  }
  //...
  
})()
```

## Part4
在内部的$对象(函数)上定义了一些全局方法,如 `$(), $.camelCase, $.contains, $.each, $.extend, $.fn`, 因为IIFE最后 `return $`, 所以这些方法可以通过window.Zepto/window.$来访问
```javascript
var Zepto = (function() 
  $ = function(selector, context){
    return zepto.init(selector, context)
  }  
  $.contains = document.documentElement.contains ?
    function(parent, node) {
      return parent !== node && parent.contains(node)
    } :
    function(parent, node) {
      while (node && (node = node.parentNode))
        if (node === parent) return true
      return false
    }
    // ...
  $.zepto = zepto
  
  return $
})()
```

# window.$/window.Zepto 到底是什么?

zepto.js模块里的代码大致是由上文提到的4部分代码构成, 知道这些后, 我们需要知道这整个IIFE返回的$到底是什么.

我们先看一下window.$()一个简单的用法, 再看看源码, 它到底执行了些什么.
```html
<div id="mask">test</div>
```
```javascript
let $mask = $('#mask')
$mask.html('mask content')
```

首先看$()部分

```javascript
  $ = function(selector, context){
    return zepto.init(selector, context)
  }
  zepto.init = function(selector, context) {
    var dom
   // ...
    // create a new Zepto collection from the nodes found
    return zepto.Z(dom, selector)
  }
  zepto.Z = function(dom, selector) {
  // (new Z(dom, sel)).__proto__ -> Z.prototype = $.fn
    return new Z(dom, selector)
  }
  function Z(dom, selector) {
    var i, len = dom ? dom.length : 0
    for (i = 0; i < len; i++) this[i] = dom[i]
    this.length = len
    this.selector = selector || ''
  }
  zepto.Z.prototype = Z.prototype = $.fn
```

$()-->zepto.init()-->zepto.Z(), 在我们的例子中, $('#mask'), 首先由zepto.init函数处理, 该函数的作用是找到id="mask"的DOM元素集合并赋值给dom,然后调用zepto.Z(dom, '#mask').

zepto.Z的作用是根据提供的dom和selector,new 一个Z对象.

遍历找到的DOM元素集合,将集合中的元素保存到Z对象中(this[i] = dom[i]), 并可以通过数字索引来访问, 另外定义了length, selector属性.

除此之外,Z.prototype指向了$.fn

```javascript
let $mask = $('#mask')
$mask.html('mask content')
```

现在再看,我们给出的例子,$('#mask')返回了一个对象$mask, $mask[0]可以访问到DOM元素, 其有length, selector属性, $mask可以调用$.fn中的方法, 如html().

所以$()函数的本质是返回了一个对象,
1. 该对象保存了DOM元素,可以通过数字索引访问
2. 该对象还有length,selector属性
3. 该对象继承了一些方法,可以通过`__proto__`访问到$.fn, 利用$.fn扩展的方法,我们可以很方便地对DOM进行操作

***
zepto.init()内部寻找DOM元素集合是通过zepto.qsa()(一个优化过的document.querySelectorAll()), 可以了解一些NodeList和HTMLCOllection的知识.

 历史上的DOM集合接口。主要不同在于HTMLCollection是元素集合而NodeList是节点集合（即可以包含元素，也可以包含文本节点）。所以 node.childNodes 返回 NodeList，而 node.children 和 node.getElementsByXXX 返回 HTMLCollection 。唯一要注意的是 querySelectorAll 返回的虽然是 NodeList ，但是实际上是元素集合，并且是静态的（其他接口返回的HTMLCollection和NodeList都是live的）。
作者：贺师俊
链接：https://www.zhihu.com/question/31576889/answer/52559370
来源：知乎
著作权归作者所有。商业转载请联系作者获得授权，非商业转载请注明出处。

> https://developer.mozilla.org/zh-CN/docs/Web/API/Document/querySelectorAll
> https://www.zhihu.com/question/31576889?sort=created
> https://www.jianshu.com/p/f6ff5ebe45fd