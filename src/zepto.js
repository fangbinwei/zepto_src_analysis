//     Zepto.js
//     (c) 2010-2016 Thomas Fuchs
//     Zepto.js may be freely distributed under the MIT license.

// 用IIFE 定义Zepto变量
var Zepto = (function() {
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
    elementDisplay = {}, classCache = {},
    cssNumber = { 'column-count': 1, 'columns': 1, 'font-weight': 1, 'line-height': 1,'opacity': 1, 'z-index': 1, 'zoom': 1 },
    // |! 即使是注释后的html片段也能匹配
    fragmentRE = /^\s*<(\w+|!)[^>]*>/,
    singleTagRE = /^<(\w+)\s*\/?>(?:<\/\1>|)$/,
    tagExpanderRE = /<(?!area|br|col|embed|hr|img|input|link|meta|param)(([\w:]+)[^>]*)\/>/ig,
    rootNodeRE = /^(?:body|html)$/i,
    capitalRE = /([A-Z])/g,

    // special attributes that should be get/set via method calls
    methodAttributes = ['val', 'css', 'html', 'text', 'data', 'width', 'height', 'offset'],

    adjacencyOperators = [ 'after', 'prepend', 'before', 'append' ],
    table = document.createElement('table'),
    tableRow = document.createElement('tr'),
    containers = {
      'tr': document.createElement('tbody'),
      'tbody': table, 'thead': table, 'tfoot': table,
      'td': tableRow, 'th': tableRow,
      '*': document.createElement('div')
    },
    readyRE = /complete|loaded|interactive/,
    simpleSelectorRE = /^[\w-]*$/,
    class2type = {},
    toString = class2type.toString,
    zepto = {},
    camelize, uniq,
    tempParent = document.createElement('div'),
    propMap = {
      'tabindex': 'tabIndex',
      'readonly': 'readOnly',
      'for': 'htmlFor',
      'class': 'className',
      'maxlength': 'maxLength',
      'cellspacing': 'cellSpacing',
      'cellpadding': 'cellPadding',
      'rowspan': 'rowSpan',
      'colspan': 'colSpan',
      'usemap': 'useMap',
      'frameborder': 'frameBorder',
      'contenteditable': 'contentEditable'
    },
    isArray = Array.isArray ||
      function(object){ return object instanceof Array }
      // function(object) { return Object.prototype.toString.call(object) === '[object Array]'}

      /** Element.matches作兼容 如果元素被指定的选择器字符串选择，Element.matches()  
       方法返回true; 否则返回false。**/
  zepto.matches = function(element, selector) {
    if (!selector || !element || element.nodeType !== 1) return false
    var matchesSelector = element.matches || element.webkitMatchesSelector ||
                          element.mozMatchesSelector || element.oMatchesSelector ||
                          element.matchesSelector
    if (matchesSelector) return matchesSelector.call(element, selector)
    // fall back to performing a selector:
    var match, parent = element.parentNode, temp = !parent
    if (temp) (parent = tempParent).appendChild(element)
    // indexOf 只要不是负数, 说明match到了 
    // ~取反 将值取负数再减1 -1变为0 存在时,返回一个非0的值(即转化为true)
    match = ~zepto.qsa(parent, selector).indexOf(element)
    temp && tempParent.removeChild(element)
    return match
  }

  // 见$.each("Boolean Number String Function Array Date RegExp Object Error".split(" "),
  function type(obj) {
    // null or undefined
    return obj == null ? String(obj) :
    // class2type = {},
    // toString = class2type.toString,
      class2type[toString.call(obj)] || "object"
  }

  function isFunction(value) { return type(value) == "function" }
  // window == window.window
  function isWindow(obj)     { return obj != null && obj == obj.window }
  // document.nodeType 9
  function isDocument(obj)   { return obj != null && obj.nodeType == obj.DOCUMENT_NODE }
  function isObject(obj)     { return type(obj) == "object" }
  function isPlainObject(obj) {
    // 对于通过字面量定义的对象和new Object的对象 返回true，new Object时传参数(Number Boolean String)的返回false
    // 参考 http://snandy.iteye.com/blog/663245
    return isObject(obj) && !isWindow(obj) && Object.getPrototypeOf(obj) == Object.prototype
  }

  // 类数组
  function likeArray(obj) {
    var length = !!obj && 'length' in obj && obj.length,
      type = $.type(obj)

    return 'function' != type && !isWindow(obj) && (
      // array类型 或 length 为0
      'array' == type || length === 0 ||
      // length 不为0的情况
        (typeof length == 'number' && length > 0 && (length - 1) in obj)
    )
  }

  // 去除数组中 null 或undefined
  function compact(array) { return filter.call(array, function(item){ return item != null }) }
  // 得到一个数组扁平化的副本 [1,[2,3],[4,[5,6]]] => [ 1, 2, 3, 4, [ 5, 6 ] ]
  // $.fn.concat : emptyArray.concat 注意: flatten 类似slice能将类数组转换为数组
  function flatten(array) { return array.length > 0 ? $.fn.concat.apply([], array) : array }
  // 驼峰化, 将background-color => backgroundColor
  camelize = function(str){ return str.replace(/-+(.)?/g, function(match, chr){ return chr ? chr.toUpperCase() : '' }) }
  // 将驼峰式变为 连字符-写法
  function dasherize(str) {
    // aA1AExample::Before => a-a1-a-example/before 
    // :: => /
    return str.replace(/::/g, '/')
    // AAa => A_Aa
           .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
           // 1A => 1_A  aA => a_A
           .replace(/([a-z\d])([A-Z])/g, '$1_$2')
           .replace(/_/g, '-')
           .toLowerCase()
  }
  // 数组去重 ,indexOf(item) 和index不同说明前面出现过
  uniq = function(array){ return filter.call(array, function(item, idx){ return array.indexOf(item) == idx }) }

  // 用于保存className的正则表达式(主要为了匹配空格), 在添加 删除 class时用到 
  // 较新的浏览器实现了 Element.classList.add/remove/toggle/contains
  // 感觉写法有点类似单例
  function classRE(name) {
    return name in classCache ?
      classCache[name] : (classCache[name] = new RegExp('(^|\\s)' + name + '(\\s|$)'))
  }

  // 大致判断是否要加px
  function maybeAddPx(name, value) {
    // 若在cssNumber中, 不需要加px 否则可能要加px
    return (typeof value == "number" && !cssNumber[dasherize(name)]) ? value + "px" : value
  }

  // 获取默认的display  在隐藏/显示元素的动画那部分会用到
  // 单例
  function defaultDisplay(nodeName) {
    var element, display
    if (!elementDisplay[nodeName]) {
      element = document.createElement(nodeName)
      document.body.appendChild(element)
      display = getComputedStyle(element, '').getPropertyValue("display")
      element.parentNode.removeChild(element)
      display == "none" && (display = "block")
      elementDisplay[nodeName] = display
    }
    return elementDisplay[nodeName]
  }

  // 对ParentNode.children 作兼容 polyfill
  function children(element) {
    return 'children' in element ?
      slice.call(element.children) :
      // nodeType 1 => ELEMENT_NODE
      $.map(element.childNodes, function(node){ if (node.nodeType == 1) return node })
  }

  // Zepto本质上是new了一个Zepto对象, 把DOM对象按index放进这个Zepto对象
  // 这个Zepto对象的__proto__指向Z.prototype/ zepto.Z.prototype => $.fn
  // $.fn 的一些方法通过$.fn.each
  function Z(dom, selector) {
    var i, len = dom ? dom.length : 0
    for (i = 0; i < len; i++) this[i] = dom[i]
    this.length = len
    this.selector = selector || ''
  }

  // `$.zepto.fragment` takes a html string and an optional tag name
  // to generate DOM nodes from the given html string.
  // The generated DOM nodes are returned as an array.
  // This function can be overridden in plugins for example to make
  // it compatible with browsers that don't support the DOM fully.
  // 用html片段生成DOM节点
  zepto.fragment = function(html, name, properties) {
    var dom, nodes, container

    // A special case optimization for a single tag
    // singleTagRE = /^<(\w+)\s*\/?>(?:<\/\1>|)$/,
    // 匹配<img/> <p></p> 但不匹配<p>123</p> (?:x)非捕获括号,element 没有content则直接通过createElement创建
    // 这样写会造成$.fn.append方法 会有bug
    if (singleTagRE.test(html)) dom = $(document.createElement(RegExp.$1))
    // 个人觉得似乎这样写更好
    // if (singleTagRE.test(html)) dom = document.createElement(RegExp.$1)

    if (!dom) {
    // tagExpanderRE = /<(?!area|br|col|embed|hr|img|input|link|meta|param)(([\w:]+)[^>]*)\/>/ig,
    // 将一些错误的单标签修改正确 <p id="p"/> => '<p id="p"></p>'
      if (html.replace) html = html.replace(tagExpanderRE, "<$1></$2>")
      if (name === undefined) name = fragmentRE.test(html) && RegExp.$1
      if (!(name in containers)) name = '*'

      container = containers[name]
      // 利用一个container 的innerHTML将 HTML片段转化为DOM结构
      container.innerHTML = '' + html
      // dom 为$.each(elements, callback) return elements, 
      // 即slice.call(container.childNodes)将childNodes转化为Array,以便$(Array)转化为Zepto对象
      dom = $.each(slice.call(container.childNodes), function(){
        // 清空container
        container.removeChild(this)
      })
    }

    // $("<p />", { text:"Hello", id:"greeting", css:{color:'darkblue'} })
    if (isPlainObject(properties)) {
      nodes = $(dom)
      $.each(properties, function(key, value) {
        // methodAttributes 需要通过方法调用来设置/获取的属性
        if (methodAttributes.indexOf(key) > -1) nodes[key](value)
        // nodes.attr 主要通过Element.setAttribute 实现
        else nodes.attr(key, value)
      })
    }

    return dom
  }

  // `$.zepto.Z` swaps out the prototype of the given `dom` array
  // of nodes with `$.fn` and thus supplying all the Zepto functions
  // to the array. This method can be overridden in plugins.
  zepto.Z = function(dom, selector) {
  // (new Z(dom, sel)).__proto__ => Z.prototype = $.fn
  // Zepto对象可以使用$.fn 中的方法
    return new Z(dom, selector)
  }

  // `$.zepto.isZ` should return `true` if the given object is a Zepto
  // collection. This method can be overridden in plugins.
  zepto.isZ = function(object) {
  // zepto.Z.prototype = $.fn
  // object.__proto__ => Z.prototype = zepto.Z.prototype
    return object instanceof zepto.Z
  }

  // `$.zepto.init` is Zepto's counterpart to jQuery's `$.fn.init` and
  // takes a CSS selector and an optional context (and handles various
  // special cases).
  // This method can be overridden in plugins.
  zepto.init = function(selector, context) {
    var dom
    // If nothing given, return an empty Zepto collection
    if (!selector) return zepto.Z()
    // Optimize for string selectors
    else if (typeof selector == 'string') {
      selector = selector.trim()
      // If it's a html fragment, create nodes from it
      // Note: In both Chrome 21 and Firefox 15, DOM error 12
      // is thrown if the fragment doesn't begin with <
    // fragmentRE = /^\s*<(\w+|!)[^>]*>/, 匹配html片段
      if (selector[0] == '<' && fragmentRE.test(selector))
      // RegExp.$1 指fragmentRE 的捕获匹配项 (\w+|!) 
        dom = zepto.fragment(selector, RegExp.$1, context), selector = null
      // If there's a context, create a collection on that context first, and select
      // nodes from there 
      // 在所给定的context下进行find return Zepto对象
      else if (context !== undefined) return $(context).find(selector)
      // If it's a CSS selector, use it to select nodes.
      // 给定 CSS selector
      else dom = zepto.qsa(document, selector)
    }
    // 给定函数 If a function is given, call it when the DOM is ready
    else if (isFunction(selector)) return $(document).ready(selector)
    // 给定 Zepto对象 If a Zepto collection is given, just return it
    else if (zepto.isZ(selector)) return selector
    else {
      // 给定数组 去除null undefined, 再用zepto.Z(dom) 包装成Zepto对象   
      // normalize array if an array of nodes is given
      if (isArray(selector)) dom = compact(selector)
      // Wrap DOM nodes. 
      // 包装DOM
      else if (isObject(selector))
        dom = [selector], selector = null
      // If it's a html fragment, create nodes from it
      // 确保 new String() 这种情况
      else if (fragmentRE.test(selector))
        dom = zepto.fragment(selector.trim(), RegExp.$1, context), selector = null
      // If there's a context, create a collection on that context first, and select
      // nodes from there
      // 确保 new String() 这种情况
      else if (context !== undefined) return $(context).find(selector)
      // And last but no least, if it's a CSS selector, use it to select nodes.
      // 确保 new String() 这种情况
      else dom = zepto.qsa(document, selector)
    }
    // create a new Zepto collection from the nodes found
    return zepto.Z(dom, selector)
  }

  // `$` will be the base `Zepto` object. When calling this
  // function just call `$.zepto.init, which makes the implementation
  // details of selecting nodes and creating Zepto collections
  // patchable in plugins.

  // $() 将dom转换为Zepto对象
  $ = function(selector, context){
    return zepto.init(selector, context)
  }

  function extend(target, source, deep) {
    for (key in source)
      if (deep && (isPlainObject(source[key]) || isArray(source[key]))) {
        if (isPlainObject(source[key]) && !isPlainObject(target[key]))
          target[key] = {}
        if (isArray(source[key]) && !isArray(target[key]))
          target[key] = []
        extend(target[key], source[key], deep)
      }
      else if (source[key] !== undefined) target[key] = source[key]
  }

  // Copy all but undefined properties from one or more
  // objects to the `target` object.
  $.extend = function(target){
    var deep, args = slice.call(arguments, 1)
    if (typeof target == 'boolean') {
      deep = target
      target = args.shift()
    }
    args.forEach(function(arg){ extend(target, arg, deep) })
    return target
  }

  // `$.zepto.qsa` is Zepto's CSS selector implementation which
  // uses `document.querySelectorAll` and optimizes for some special cases, like `#id`.
  // This method can be overridden in plugins.
  // 优化后的querySelectorAll
  zepto.qsa = function(element, selector){
    var found,
        maybeID = selector[0] == '#',
        maybeClass = !maybeID && selector[0] == '.',
        nameOnly = maybeID || maybeClass ? selector.slice(1) : selector, // Ensure that a 1 char tag name still gets checked
    // simpleSelectorRE = /^[\w-]*$/, 注意 不会匹配含有空格的string
        isSimple = simpleSelectorRE.test(nameOnly)
        // return Array类型
        // 根据Id
    return (element.getElementById && isSimple && maybeID) ? // Safari DocumentFragment doesn't have getElementById
      ( (found = element.getElementById(nameOnly)) ? [found] : [] ) :
      // 1 element_node 9 document_node 11 document_fragment_node
      (element.nodeType !== 1 && element.nodeType !== 9 && element.nodeType !== 11) ? [] :
      slice.call(
        isSimple && !maybeID && element.getElementsByClassName ? // DocumentFragment doesn't have getElementsByClassName/TagName
        // 用className 或tagName
          maybeClass ? element.getElementsByClassName(nameOnly) : // If it's simple, it could be a class
          element.getElementsByTagName(selector) : // Or a tag
          // 不是className 或tagName 由querySelectorAll来查找
          element.querySelectorAll(selector) // Or it's not simple, and we need to query all
      )
  }

  function filtered(nodes, selector) {
    return selector == null ? $(nodes) : $(nodes).filter(selector)
  }

  // 对documentElement.contains作兼容
  $.contains = document.documentElement.contains ?
    function(parent, node) {
      return parent !== node && parent.contains(node)
    } :
    function(parent, node) {
      while (node && (node = node.parentNode))
        if (node === parent) return true
      return false
    }

  function funcArg(context, arg, idx, payload) {
    return isFunction(arg) ? arg.call(context, idx, payload) : arg
  }

  function setAttribute(node, name, value) {
    // value为null或undefined时 移除特性, 否则设置特性
    value == null ? node.removeAttribute(name) : node.setAttribute(name, value)
  }

  // access className property while respecting SVGAnimatedString
  function className(node, value){
    var klass = node.className || '',
        svg   = klass && klass.baseVal !== undefined

    if (value === undefined) return svg ? klass.baseVal : klass
    svg ? (klass.baseVal = value) : (node.className = value)
  }

  // "true"  => true
  // "false" => false
  // "null"  => null
  // "42"    => 42
  // "42.5"  => 42.5
  // "08"    => "08"
  // JSON    => parse if valid
  // String  => self
  function deserializeValue(value) {
    try {
      return value ?
        value == "true" ||
        ( value == "false" ? false :
          value == "null" ? null :
          +value + "" == value ? +value :
          // 正则表达式匹配JSON 但是只是很粗略地匹配, 有可能出错 跳到catch
          /^[\[\{]/.test(value) ? $.parseJSON(value) :
          value )
        : value
    } catch(e) {
      return value
    }
  }

  $.type = type
  $.isFunction = isFunction
  $.isWindow = isWindow
  $.isArray = isArray
  $.isPlainObject = isPlainObject

  $.isEmptyObject = function(obj) {
    var name
    for (name in obj) return false
    return true
  }

  $.isNumeric = function(val) {
    var num = Number(val), type = typeof val
    return val != null && type != 'boolean' &&
      (type != 'string' || val.length) &&
      !isNaN(num) && isFinite(num) || false
  }

  $.inArray = function(elem, array, i){
    return emptyArray.indexOf.call(array, elem, i)
  }

  $.camelCase = camelize
  $.trim = function(str) {
    return str == null ? "" : String.prototype.trim.call(str)
  }

  // plugin compatibility
  $.uuid = 0
  $.support = { }
  $.expr = { }
  $.noop = function() {}

  // 对元素进行map操作, callback return为 null 或undefined 会被忽略, 返回经过扁平化的数组
  // callback(item, index)
  $.map = function(elements, callback){
    var value, values = [], i, key
    if (likeArray(elements))
      for (i = 0; i < elements.length; i++) {
        value = callback(elements[i], i)
        if (value != null) values.push(value)
      }
    else
      for (key in elements) {
        value = callback(elements[key], key)
        if (value != null) values.push(value)
      }
    return flatten(values)
  }

  // 对每一项运行callback, 如果callback返回false, 则提前结束迭代
  // callback(index, item)反人类 迭代类数组或者对象
  $.each = function(elements, callback){
    var i, key
    if (likeArray(elements)) {
      for (i = 0; i < elements.length; i++)
      // 注意 使用了call, 遍历dom的时候会很有用
        if (callback.call(elements[i], i, elements[i]) === false) return elements
    } else {
      for (key in elements)
        if (callback.call(elements[key], key, elements[key]) === false) return elements
    }

    return elements
  }

  $.grep = function(elements, callback){
    return filter.call(elements, callback)
  }

  if (window.JSON) $.parseJSON = JSON.parse

  // Populate the class2type map
  // 配合type函数使用 映射class2type
  $.each("Boolean Number String Function Array Date RegExp Object Error".split(" "), function(i, name) {
    class2type[ "[object " + name + "]" ] = name.toLowerCase()
  })

  // Define methods that will be available on all
  // Zepto collections
  $.fn = {
    constructor: zepto.Z,
    length: 0,

    // Because a collection acts like an array
    // copy over these useful array functions.
    forEach: emptyArray.forEach,
    reduce: emptyArray.reduce,
    push: emptyArray.push,
    sort: emptyArray.sort,
    splice: emptyArray.splice,
    indexOf: emptyArray.indexOf,
    concat: function(){
      var i, value, args = []
      for (i = 0; i < arguments.length; i++) {
        value = arguments[i]
        args[i] = zepto.isZ(value) ? value.toArray() : value
      }
      return concat.apply(zepto.isZ(this) ? this.toArray() : this, args)
    },

    // `map` and `slice` in the jQuery API work differently
    // from their array counterparts
    // 返回Zepto对象
    map: function(fn){
      return $($.map(this, function(el, i){ return fn.call(el, i, el) }))
    },
    slice: function(){
      return $(slice.apply(this, arguments))
    },

    ready: function(callback){
      // need to check if document.body exists for IE as that browser reports
      // document ready when it hasn't yet created the body element
      if (readyRE.test(document.readyState) && document.body) callback($)
      else document.addEventListener('DOMContentLoaded', function(){ callback($) }, false)
      return this
    },
    get: function(idx){
      return idx === undefined ? slice.call(this) : this[idx >= 0 ? idx : idx + this.length]
    },
    toArray: function(){ return this.get() },
    size: function(){
      return this.length
    },
    remove: function(){
      return this.each(function(){
        if (this.parentNode != null)
          this.parentNode.removeChild(this)
      })
    },
    each: function(callback){
      emptyArray.every.call(this, function(el, idx){
        return callback.call(el, idx, el) !== false
      })
      return this
    },
    filter: function(selector){
      // 利用两次not得到filter结果
      if (isFunction(selector)) return this.not(this.not(selector))
      // return $(filter_array)
      return $(filter.call(this, function(element){
        // return element 是否符合css selector true/false
        return zepto.matches(element, selector)
      }))
    },
    add: function(selector,context){
      return $(uniq(this.concat($(selector,context))))
    },
    is: function(selector){
      return this.length > 0 && zepto.matches(this[0], selector)
    },
    // 与filter功能相反
    not: function(selector){
      var nodes=[]
      if (isFunction(selector) && selector.call !== undefined)
        this.each(function(idx){
          // 函数返回为false则push
          if (!selector.call(this,idx)) nodes.push(this)
        })
      else {
        var excludes = typeof selector == 'string' ? this.filter(selector) :
        // selector 为HTMLCollection : selector 为数组或Zepto对象
          (likeArray(selector) && isFunction(selector.item)) ? slice.call(selector) : $(selector)
          // $.fn.forEach/indexOf
        this.forEach(function(el){
          // 为-1 则push
          if (excludes.indexOf(el) < 0) nodes.push(el)
        })
      }
      return $(nodes)
    },
    has: function(selector){
      return this.filter(function(){
        return isObject(selector) ?
          $.contains(this, selector) :
          $(this).find(selector).size()
      })
    },
    eq: function(idx){
      return idx === -1 ? this.slice(idx) : this.slice(idx, + idx + 1)
    },
    first: function(){
      var el = this[0]
      return el && !isObject(el) ? el : $(el)
    },
    last: function(){
      var el = this[this.length - 1]
      return el && !isObject(el) ? el : $(el)
    },
    // 返回Zepto对象
    find: function(selector){
      var result, $this = this
      if (!selector) result = $()
      // HTMLCollection Zepto对象等
      // 如果给定Zepto对象集合或者元素，过滤它们，只有当它们在当前Zepto集合对象中时，才回被返回
      else if (typeof selector == 'object')
      // $this.find({0: item1, 1: item2}// Zepto对象)
      // 在$this集合中找有没有item1, 在$this集合中找有没有item2
        result = $(selector).filter(function(){
          var node = this
          return emptyArray.some.call($this, function(parent){
            return $.contains(parent, node)
          })
        })
        // zepto.qsa 实现find功能
      else if (this.length == 1) result = $(zepto.qsa(this[0], selector))
      // $.fn.map return $($.map(this, function(el, i){ return fn.call(el, i, el) }))
      else result = this.map(function(){ return zepto.qsa(this, selector) })
      return result
    },
    closest: function(selector, context){
      var nodes = [], collection = typeof selector == 'object' && $(selector)
      this.each(function(_, node){
        while (node && !(collection ? collection.indexOf(node) >= 0 : zepto.matches(node, selector)))
          node = node !== context && !isDocument(node) && node.parentNode
        if (node && nodes.indexOf(node) < 0) nodes.push(node)
      })
      return $(nodes)
    },
    parents: function(selector){
      var ancestors = [], nodes = this
      while (nodes.length > 0)
        nodes = $.map(nodes, function(node){
          if ((node = node.parentNode) && !isDocument(node) && ancestors.indexOf(node) < 0) {
            ancestors.push(node)
            return node
          }
        })
      return filtered(ancestors, selector)
    },
    parent: function(selector){
      return filtered(uniq(this.pluck('parentNode')), selector)
    },
    children: function(selector){
      return filtered(this.map(function(){ return children(this) }), selector)
    },
    contents: function() {
      return this.map(function() { return this.contentDocument || slice.call(this.childNodes) })
    },
    siblings: function(selector){
      return filtered(this.map(function(i, el){
        return filter.call(children(el.parentNode), function(child){ return child!==el })
      }), selector)
    },
    // 把$()选中的element innerHTML都置为''
    empty: function(){
      return this.each(function(){ this.innerHTML = '' })
    },
    // `pluck` is borrowed from Prototype.js
    // 返回一个数组
    // $('body > *').pluck('nodeName') // => ["DIV", "SCRIPT"]
    pluck: function(property){
      return $.map(this, function(el){ return el[property] })
    },
    show: function(){
      return this.each(function(){
        this.style.display == "none" && (this.style.display = '')
        if (getComputedStyle(this, '').getPropertyValue("display") == "none")
          this.style.display = defaultDisplay(this.nodeName)
      })
    },
    replaceWith: function(newContent){
      return this.before(newContent).remove()
    },
    wrap: function(structure){
      var func = isFunction(structure)
      if (this[0] && !func)
        var dom   = $(structure).get(0),
            clone = dom.parentNode || this.length > 1

      return this.each(function(index){
        $(this).wrapAll(
          func ? structure.call(this, index) :
            clone ? dom.cloneNode(true) : dom
        )
      })
    },
    wrapAll: function(structure){
      if (this[0]) {
        $(this[0]).before(structure = $(structure))
        var children
        // drill down to the inmost element
        while ((children = structure.children()).length) structure = children.first()
        $(structure).append(this)
      }
      return this
    },
    wrapInner: function(structure){
      var func = isFunction(structure)
      return this.each(function(index){
        var self = $(this), contents = self.contents(),
            dom  = func ? structure.call(this, index) : structure
        contents.length ? contents.wrapAll(dom) : self.append(dom)
      })
    },
    unwrap: function(){
      this.parent().each(function(){
        $(this).replaceWith($(this).children())
      })
      return this
    },
    clone: function(){
      return this.map(function(){ return this.cloneNode(true) })
    },
    hide: function(){
      return this.css("display", "none")
    },
    toggle: function(setting){
      return this.each(function(){
        var el = $(this)
        ;(setting === undefined ? el.css("display") == "none" : setting) ? el.show() : el.hide()
      })
    },
    prev: function(selector){ return $(this.pluck('previousElementSibling')).filter(selector || '*') },
    next: function(selector){ return $(this.pluck('nextElementSibling')).filter(selector || '*') },
    // html(content) content可以是append中描述的所有类型
    // html字符串，dom节点，或者节点组成的数组 函数
    html: function(html){
      return 0 in arguments ?
        // 设置innerHTML
        this.each(function(idx){
          var originHtml = this.innerHTML
          // html(function(index, oldHtml){ ... })/ html(content)
          $(this).empty().append( funcArg(this, html, idx, originHtml) )
        }) :
        // 读取innerHTML
        (0 in this ? this[0].innerHTML : null)
    },
    text: function(text){
      return 0 in arguments ?
        this.each(function(idx){
          var newText = funcArg(this, text, idx, this.textContent)
          this.textContent = newText == null ? '' : ''+newText
        }) :
        // 获取每个元素的textContent
        (0 in this ? this.pluck('textContent').join("") : null)
    },
    attr: function(name, value){
      var result
      return (typeof name == 'string' && !(1 in arguments)) ?
      // 没有value 获取特性
        (0 in this && this[0].nodeType == 1 && (result = this[0].getAttribute(name)) != null ? result : undefined) :
        // 有value的情况 或name不是string(为object)
        this.each(function(idx){
          // nodeType 1 ELEMENT_NODE
          if (this.nodeType !== 1) return
        // attr({ name: value, name2: value2, ... })
          if (isObject(name)) for (key in name) setAttribute(this, key, name[key])
          // attr(name, value) attr(name, function(index, oldValue){ ... })
          // 如果value不是function(null or string), funcArg return value.
          // value是function  funcArg return value.call(this, idx, this.getAttribute(name))
          else setAttribute(this, name, funcArg(this, value, idx, this.getAttribute(name)))
        })
    },
    removeAttr: function(name){
      return this.each(function(){ this.nodeType === 1 && name.split(' ').forEach(function(attribute){
        setAttribute(this, attribute)
      }, this)})
    },
    prop: function(name, value){
      name = propMap[name] || name
      return (1 in arguments) ?
        this.each(function(idx){
          this[name] = funcArg(this, value, idx, this[name])
        }) :
        (this[0] && this[0][name])
    },
    removeProp: function(name){
      name = propMap[name] || name
      return this.each(function(){ delete this[name] })
    },
    data: function(name, value){
      // capitalRE = /([A-Z])/g,
      // 大写字母转化  A=> -A 再全部转化为小写字母
      var attrName = 'data-' + name.replace(capitalRE, '-$1').toLowerCase()

      var data = (1 in arguments) ?
      // set
        this.attr(attrName, value) :
        // read
        this.attr(attrName)

      return data !== null ? deserializeValue(data) : undefined
    },
    // 获取/设置元素的值
    // val() val(value) value(function(index, oldValue){})
    val: function(value){
      if (0 in arguments) {
        if (value == null) value = ""
        return this.each(function(idx){
          this.value = funcArg(this, value, idx, this.value)
        })
      } else {
        // <select multiple></select>
        return this[0] && (this[0].multiple ?
           $(this[0]).find('option').filter(function(){ return this.selected }).pluck('value') :
           this[0].value)
      }
    },
    //到左边缘的距离 包括滚动条产生的距离 left right : getBoundClientRect() + pageXOffset
    // 给定一个含有left和top属性对象时，使用这些值来对集合中每一个元素进行相对于document的定位
    // 注意相对document定位 和其父级定位元素有关
    offset: function(coordinates){
      if (coordinates) return this.each(function(index){
        var $this = $(this),
            coords = funcArg(this, coordinates, index, $this.offset()),
            parentOffset = $this.offsetParent().offset(),
            // 如果有父级定位元素, top left值根据其进行计算
            props = {
              top:  coords.top  - parentOffset.top,
              left: coords.left - parentOffset.left
            }
            console.log('props', props)

        if ($this.css('position') == 'static') props['position'] = 'relative'
        $this.css(props)
      })
      // length为0 return
      if (!this.length) return null
      // 不为html 且不为html的子元素
      if (document.documentElement !== this[0] && !$.contains(document.documentElement, this[0]))
        return {top: 0, left: 0}
        // obj.left/top 只是距离视口, 考虑有滚动条的情况 加上pageXOffset/Y
      var obj = this[0].getBoundingClientRect()
      return {
        left: obj.left + window.pageXOffset,
        top: obj.top + window.pageYOffset,
        width: Math.round(obj.width),
        height: Math.round(obj.height)
      }
    },
    // 利用cssText/removeProperty设置css, 利用element.style[]/getComputedStyle().getPropertyValue 读取css
    css: function(property, value){
      if (arguments.length < 2) {
        // 读取css属性
        var element = this[0]
        // elem.css('background-color') 
        if (typeof property == 'string') {
          if (!element) return
          // 驼峰化, 获取style
          return element.style[camelize(property)] || getComputedStyle(element, '').getPropertyValue(property)
        } else if (isArray(property)) {
          if (!element) return
          var props = {}
          var computedStyle = getComputedStyle(element, '')
          $.each(property, function(_, prop){
            props[prop] = (element.style[camelize(prop)] || computedStyle.getPropertyValue(prop))
          })
          // 返回对象
          return props
        }
      }

      var css = ''
      if (type(property) == 'string') {
        // value: null undefined ''
        if (!value && value !== 0)
          this.each(function(){ this.style.removeProperty(dasherize(property)) })
        else
          css = dasherize(property) + ":" + maybeAddPx(property, value)
      } else {
        // css({ property: value, property2: value2, ... })
        for (key in property)
        // NaN等
          if (!property[key] && property[key] !== 0)
            this.each(function(){ this.style.removeProperty(dasherize(key)) })
          else
            css += dasherize(key) + ':' + maybeAddPx(key, property[key]) + ';'
      }

      // 追加css
      return this.each(function(){ this.style.cssText += ';' + css })
    },
    index: function(element){
      return element ? this.indexOf($(element)[0]) : this.parent().children().indexOf(this[0])
    },
    hasClass: function(name){
      if (!name) return false
      return emptyArray.some.call(this, function(el){
        return this.test(className(el))
      }, classRE(name))
    },
    addClass: function(name){
      if (!name) return this
      return this.each(function(idx){
        if (!('className' in this)) return
        classList = []
        var cls = className(this), newName = funcArg(this, name, idx, cls)
        newName.split(/\s+/g).forEach(function(klass){
          if (!$(this).hasClass(klass)) classList.push(klass)
        }, this)
        classList.length && className(this, cls + (cls ? " " : "") + classList.join(" "))
      })
    },
    removeClass: function(name){
      return this.each(function(idx){
        if (!('className' in this)) return
        if (name === undefined) return className(this, '')
        classList = className(this)
        funcArg(this, name, idx, classList).split(/\s+/g).forEach(function(klass){
          classList = classList.replace(classRE(klass), " ")
        })
        className(this, classList.trim())
      })
    },
    toggleClass: function(name, when){
      if (!name) return this
      return this.each(function(idx){
        var $this = $(this), names = funcArg(this, name, idx, className(this))
        names.split(/\s+/g).forEach(function(klass){
          (when === undefined ? !$this.hasClass(klass) : when) ?
            $this.addClass(klass) : $this.removeClass(klass)
        })
      })
    },
    scrollTop: function(value){
      if (!this.length) return
      var hasScrollTop = 'scrollTop' in this[0]
      if (value === undefined) return hasScrollTop ? this[0].scrollTop : this[0].pageYOffset
      return this.each(hasScrollTop ?
        function(){ this.scrollTop = value } :
        function(){ this.scrollTo(this.scrollX, value) })
    },
    scrollLeft: function(value){
      if (!this.length) return
      var hasScrollLeft = 'scrollLeft' in this[0]
      if (value === undefined) return hasScrollLeft ? this[0].scrollLeft : this[0].pageXOffset
      return this.each(hasScrollLeft ?
        function(){ this.scrollLeft = value } :
        function(){ this.scrollTo(value, this.scrollY) })
    },
    position: function() {
      if (!this.length) return

      var elem = this[0],
        // Get *real* offsetParent
        offsetParent = this.offsetParent(),
        // Get correct offsets
        offset       = this.offset(),
        parentOffset = rootNodeRE.test(offsetParent[0].nodeName) ? { top: 0, left: 0 } : offsetParent.offset()

      // Subtract element margins
      // note: when an element has margin: auto the offsetLeft and marginLeft
      // are the same in Safari causing offset.left to incorrectly be 0
      offset.top  -= parseFloat( $(elem).css('margin-top') ) || 0
      offset.left -= parseFloat( $(elem).css('margin-left') ) || 0

      // Add offsetParent borders
      parentOffset.top  += parseFloat( $(offsetParent[0]).css('border-top-width') ) || 0
      parentOffset.left += parseFloat( $(offsetParent[0]).css('border-left-width') ) || 0

      // Subtract the two offsets
      return {
        top:  offset.top  - parentOffset.top,
        left: offset.left - parentOffset.left
      }
    },
    // 找到第一个定位过的祖先元素，意味着它的css中的position 属性值为“relative”, “absolute” or “fixed”
    // $('div')会返回所有div的定位元素的一个数组
    offsetParent: function() {
      return this.map(function(){
        // 当元素的 style.display 设置为 "none" 时，offsetParent 返回 null
        var parent = this.offsetParent || document.body
        // rootNodeRE = /^(?:body|html)$/i,
        // 也许是做兼容, 因为offsetParent本来就是返回最近的定位元素
        while (parent && !rootNodeRE.test(parent.nodeName) && $(parent).css("position") == "static")
          parent = parent.offsetParent
        return parent
      })
    }
  }

  // for now
  $.fn.detach = $.fn.remove

  // Generate the `width` and `height` functions
  ;['width', 'height'].forEach(function(dimension){
    // width => Width
    var dimensionProperty =
      dimension.replace(/./, function(m){ return m[0].toUpperCase() })

    $.fn[dimension] = function(value){
      var offset, el = this[0]
      // window.innerWidth 包括侧边滚动条的宽度
      if (value === undefined) return isWindow(el) ? el['inner' + dimensionProperty] :
       // document.documentElement.scrollWidth 不包括浏览器侧边滚动条的宽度
        isDocument(el) ? el.documentElement['scroll' + dimensionProperty] :
        (offset = this.offset()) && offset[dimension]
      else return this.each(function(idx){
        // 设置全部的with
        el = $(this)
        el.css(dimension, funcArg(this, value, idx, el[dimension]()))
      })
      // this.each
    // each: function(callback){
    //   emptyArray.every.call(this, function(el, idx){
    //     return callback.call(el, idx, el) !== false
    //   })
    //   return this
    // },
    }
  })

  // 递归遍历node及其子节点, 节点交由fun函数处理
  function traverseNode(node, fun) {
    fun(node)
    for (var i = 0, len = node.childNodes.length; i < len; i++)
      traverseNode(node.childNodes[i], fun)
  }

  // Generate the `after`, `prepend`, `before`, `append`,
  // `insertAfter`, `insertBefore`, `appendTo`, and `prependTo` methods.
    // adjacencyOperators = [ 'after', 'prepend', 'before', 'append' ],
  adjacencyOperators.forEach(function(operator, operatorIndex) {
    var inside = operatorIndex % 2 //=> prepend, append

    $.fn[operator] = function(){
      // arguments can be nodes, arrays of nodes, Zepto objects and HTML strings
      var argType, nodes = $.map(arguments, function(arg) {
            var arr = []
            argType = type(arg)
            if (argType == "array") {
              arg.forEach(function(el) {
                // DOM node
                if (el.nodeType !== undefined) return arr.push(el)
                // Zepto对象
                else if ($.zepto.isZ(el)) return arr = arr.concat(el.get())
                // html string
                // 这里需要注意 el不能是<p></p> 这种没有内容的标签,
                // 否则zepto.fragment返回的是$()类型的, 不是Array [{}// Zepto对象], $.map return的flatten无法将数组中的类数组数组化
                arr = arr.concat(zepto.fragment(el))
              })
              return arr
            }
            // 这里arg可以是<p></p> 因为arg返回Zepto对象, 在$.map return 的flatten函数中数组化(类数组 => 数组)
            return argType == "object" || arg == null ?
              arg : zepto.fragment(arg)
          }),
          parent, copyByClone = this.length > 1
      if (nodes.length < 1) return this

      return this.each(function(_, target){
        parent = inside ? target : target.parentNode

        // convert all methods to a "before" operation
        target = operatorIndex == 0 ? target.nextSibling : //after
                 operatorIndex == 1 ? target.firstChild :  //prepend
                 operatorIndex == 2 ? target :             // before
                 null  //append

        var parentInDocument = $.contains(document.documentElement, parent)

        nodes.forEach(function(node){
          if (copyByClone) node = node.cloneNode(true)
          else if (!parent) return $(node).remove()

          // append: target null 插在结尾
          parent.insertBefore(node, target)
          // 因为script标签是通过innerHTML插入的, 所以不会执行
          if (parentInDocument) traverseNode(node, function(el){
            if (el.nodeName != null && el.nodeName.toUpperCase() === 'SCRIPT' &&
            // type 为'' 或JavaScript , 不存在外部脚本
               (!el.type || el.type === 'text/javascript') && !el.src){
              var target = el.ownerDocument ? el.ownerDocument.defaultView : window
              target['eval'].call(target, el.innerHTML)
            }
          })
        })
      })
    }

    // after    => insertAfter
    // prepend  => prependTo
    // before   => insertBefore
    // append   => appendTo
    // $('<li>first list item</li>').prependTo('ul') 相当于 prepend 主语和宾语交换
    $.fn[inside ? operator+'To' : 'insert'+(operatorIndex ? 'Before' : 'After')] = function(html){
      $(html)[operator](this)
      return this
    }
  })

  zepto.Z.prototype = Z.prototype = $.fn

  // Export internal API functions in the `$.zepto` namespace
  zepto.uniq = uniq
  zepto.deserializeValue = deserializeValue
  $.zepto = zepto

  return $
})()

// If `$` is not yet defined, point it to `Zepto`
window.Zepto = Zepto
window.$ === undefined && (window.$ = Zepto)
