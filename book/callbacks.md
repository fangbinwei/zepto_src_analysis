# callbacks

# 整体代码结构
这章主要分析zepto.js的一个扩展模块callbacks, 该模块在deferred模块中会用到.

首先看一下, callbacks的整体代码结构
```JavaScript
;(function($){
  $.Callbacks = function(options) {
  // ...
    Callbacks = {
    // ...
    }
    return Callbacks
  }
})(Zepto)
```
直接在\$上扩展了一个Callbacks方法, 其接受options对象, 如{once:1, memory: 1}, Callbacks方法内部维护了一个用于存放回调函数的数组list.

Option flags:

- once: Callbacks fired at most one time. 

fire()是否可以重复执行(fire会遍历回调函数list中的回调函数并执行), 若设置为true, 在触发过fire()后, 后续无法再直接调用fire()(但有间接调用fire()的方式)

 - memory: Remember the most recent context and arguments.
 
若memory设置为true, 在调用过fire()之后, memory中会记录fire时的context,args

 - stopOnFalse: Cease iterating over callback list 

在遍历回调函数list时, 若回调函数返回false, 则break, 中止list中回调的继续执行

 - unique: Permit adding at most one instance of the same callback 

设置添加的回调函数是不是具有唯一性,是否可以重复添加

***
下面看一些\$.Callbacks的用法, 例子主要涉及到option中的memory参数.

```JavaScript
    var a = function (arg) {
      console.log('callback a ' + arg)
    }
    var b = function (arg) {
      console.log('callback b ' + arg)
    }

    var callback = $.Callbacks()
    callback.add(a)
    callback.fire('fire')// callback a fire
    callback.add(b)
    callback.fire('another fire') // callback b another fire

    var callbackMemory = $.Callbacks({memory: 1})
    callbackMemory.add(a)
    callbackMemory.fire('fire memory') // callback a fire memory
    callbackMemory.add(b) // callback b fire memory
```

调用\$.Callbacks(), 可以返回一个Callbacks对象, 利用其add()方法, 可以往内部维护的回调函数list中添加后续要执行的回调, 接着可以调用fire()方法, 执行list中的回调. 

设置了memory之后, 函数内部会维护一个memory私有变量, 在执行过fire()方法后, memory变量会保存fire()执行时的context和arguments, 在下次调用add()方法时, 会使用memory中的context和arguments间接去触发fire(), 所以add()添加的回调能够立即执行.

刚开始在看到memory和add()方法这种奇怪的行为时, 我很疑惑, 居然还有这种操作? 有什么用? 其实在Deferred模块中需要用到, Deferred模块是想要实现Promise的行为.

试想一下如下的场景, 
```JavaScript
let p1 = new Promise(function(resolve, reject)) {
    resolve(42);
}
p1.then(function(value) {  
    console.log(value); //42
})
```
resolve(), 可以用\$.Callbacks().fire()来实现.
then(), 是向回调list中添加回调函数, 可以用\$.Callbacks().add()来实现

那么如果\.then() 还未执行的时候, 这时list中还没有任何内容, 而resolve()先执行了, 那么resolve()在执行的时候, 没有任何回调会被执行. 所以memory的机制就是为了解决这种场景的问题, 在add()之前, fire()先执行了, 但是memory保存了context, arguments, 那么在add()添加回调的时候, !!memory为true, 那就直接触发fire(), 执行添加的回调.
***

# 具体实现细节 
## 一些变量声明
```JavaScript
;(function($){
  $.Callbacks = function(options) {
    // options为undefined时,默认为{}
    options = $.extend({}, options)

    var memory, // Last fire value (for non-forgettable lists)
        fired,  // Flag to know if list was already fired
        firing, // Flag to know if list is currently firing
        firingStart, // First callback to fire (used internally by add and fireWith)
        firingLength, // End of the loop when firing
        firingIndex, // Index of currently firing callback (modified by remove if needed)
        // 存储回调函数的列表
        list = [], // Actual callback list 
        stack = !options.once && [], // Stack of fire calls for repeatable lists

        // ...
    return Callbacks
  }
})(Zepto)
```

`options = $.extend({}, options)`, 使用这种方式对options进行处理, 可以避免没有传入options的情况, 不过ES6已经支持默认参数. 之后声明memory参数, 如果options中设置了memory为true, 那么在fire()函数中会对memory变量进行赋值. fired用于表明是否执行过fire(). firing则是表明当前是否正在执行回调函数list中的回调. 

firingStart, firingLength, firingIndex都是涉及遍历list时的参数. list 是一个数组, 用于存放待执行的回调函数. stack与options.once有关, 若once为true, stack则为false, 否则为[].

## 内部fire()函数
```JavaScript
var fire = function(data) {
          memory = options.memory && data // data -> [context, args]
          fired = true
          firingIndex = firingStart || 0
          // 重置firingStart
          firingStart = 0
          firingLength = list.length
          firing = true
          // 循环list, 执行回调
          // data[0]context data[1]args
          for ( ; list && firingIndex < firingLength ; ++firingIndex ) {
            if (list[firingIndex].apply(data[0], data[1]) === false && options.stopOnFalse) {
            // 返回false 并设置了stopOnFalse的情况
              memory = false
              break
            }
          }
          firing = false
          if (list) {
        // stack = !options.once && []  once 为false, 执行stack中的回调
            if (stack) stack.length && fire(stack.shift())
            else if (memory) list.length = 0
            else Callbacks.disable()
          }
```
### 变量初始化
```JavaScript
          memory = options.memory && data // data -> [context, args]
          fired = true
          firingIndex = firingStart || 0
          // 重置firingStart
          firingStart = 0
          firingLength = list.length
          firing = true
```
fire()函数执行时, 首先判断options.memory的情况, 若其为true(!!memory===true), 则将fire()函数的参数data赋值到memory中, data是由context和arguments组成, 后面会提到. 接着设置flag fired为true, 并初始化firingIndex, firingStart, firingLength.

### 遍历list
```JavaScript
          for ( ; list && firingIndex < firingLength ; ++firingIndex ) {
            if (list[firingIndex].apply(data[0], data[1]) === false && options.stopOnFalse) {
            // 返回false 并设置了stopOnFalse的情况
              memory = false
              break
            }
          }
          firing = false
```
在设置flag firing为true后, 开始遍历list数组, 若回调函数返回为false, 并且设置了options.stopOnFlase, 则跳出循环. 遍历list之后, 将firing设置为false.

### 内部fire()函数的一些状态检测
```JavaScript
          if (list) {
        // stack = !options.once && []  once 为false, 执行stack中的回调
            if (stack) stack.length && fire(stack.shift())
            else if (memory) list.length = 0
            else Callbacks.disable()
          }
```
首先是对list的判断, 之所以需要这么做, 是因为在遍历list的过程中, list中的回调函数可能会改变list的状态, 例如将list设置为undefined(disable操作).

stack与options.once有关, 若设置options.once为false( 代表可以多次调用fire()执行list中的回调), 则stack为数组. 当调用fire()时, 若firing为true( 例如list中有一些异步函数), 那么此时fire()会将[context, arguments]推入stack中. 若检测到stack.length不为0, 则将stack中的[context, arguments]取出并执行.

```JavaScript
     else if (memory) list.length = 0
```
若options.once设置为true, 则stack为false. 此时我们再看它下面的语句, once设置为true, 那么已经不能直接fire(), 此时若memory存在, 那么就清空list, 为什么?  因为没有存在的必要, 这就是options.once的含义, 它们只能执行1次. memory存在的时候, 还可以通过add()来间接触发fire(), 若memory也为false, 则执行Callbacks.disable(). 

## Callbacks对象

Callbacks对象主要向外部提供一些API, 大部分都支持链式调用.
```JavaScript
Callbacks = {
          add: function() {
          // ..
            return this
          },
          remove: function() {
          // ...
            return this
          },
          has: function(fn) {
            return !!(list && (fn ? $.inArray(fn, list) > -1 : list.length))
          },
          empty: function() {
            firingLength = list.length = 0
            return this
          },
          // 禁用回调, fire, remove, fireWith, add 等失效
          disable: function() {
            list = stack = memory = undefined
            return this
          },
          // 判断是否执行过disable()
          disabled: function() {
            return !list
          },
          lock: function() {
            stack = undefined
            if (!memory) Callbacks.disable()
            return this
          },
          locked: function() {
            return !stack
          },
          fireWith: function(context, args) {
          // ..
            return this
          },
          fire: function() {
            return Callbacks.fireWith(this, arguments)
          },
          fired: function() {
            return !!fired
          }
        }
```

### disable()
```JavaScript
          disable: function() {
            list = stack = memory = undefined
            return this
          },
```

disable()方法将list, stack, memory, 都设为undefined, 此时Callbacks对象上的fire(), remove(), fireWith(), add()都将失效.

### has()
```JavaScript
      has: function(fn) {
        // 若有fn参数,判断list中是否有fn, 否则判断list中是否有回调函数
        return !!(list && (fn ? $.inArray(fn, list) > -1 : list.length))
      },
```
has()方法主要用于判断list数组中是否已经包含某个回调函数fn. 使用\$.inArray实现, 其实用到[].indexOf.call().

### fire()
```JavaScript
          fire: function() {
            return Callbacks.fireWith(this, arguments)
          },
```
fire()调用的是fireWith()方法, 传入context和arguments.

```JavaScript
          fireWith: function(context, args) {
            // list 没有fire过 或 stack存在(!!options.once 为false)
            if (list && (!fired || stack)) {
              args = args || []
              // args.slice() 对数组进行拷贝, 由于memory会存储上此次的context,args, 防止被修改?
              args = [context, args.slice ? args.slice() : args]
              // 回调正在触发,已经fire过,则加入到stack中
              if (firing) stack.push(args)
              else fire(args)
            }
            return this
          },
```

fireWith()首先判断list是否存在, fireWith()继续执行的情况有两种:
1. 若fired为false, list中的回调没有执行过, 则执行if语句的内容. 
2. 若fired为true, 则说明list中的回调函数已经执行过1次, 此时判断stack的状态, 若!!stack为true, 则说明options.once为false, list中的回调函数允许多次执行, 则执行if语句的内容.

其它情况下fireWith()直接return.

if语句的内容主要是对context和args进行修正, args最后的形式是[context, arguments], 这里若传入的args为数组, 则调用其slice(), 进行拷贝, 应该是为了防止对数组的修改, 更加安全.

接下来就是对firing的判断, 若list正在遍历中, 则将args加入到stack中, 在list遍历完后, 内部fire()函数会检查stack, 并执行. 否则, 直接调用fire().
```JavaScript
      if (firing) stack.push(args)
      else fire(args)
```

这里有一个小细节, Callbacks.fire(arguments) -> Callbacks.fireWith(context, args) ->  fire(data).

Callbacks.fire()调用Callbacks.fireWith() 传入的是一个类数组arguments, 
```JavaScript
      return Callbacks.fireWith(this, arguments)
```

Callbacks.fire('im args'), 最终执行内部fire(data), data[1]是一个类数组, 内部函数fire()中使用了apply(), 这里有一个知识点apply()可以处理类数组.
```JavaScript
if (list[firingIndex].apply(data[0], data[1]) === false && options.stopOnFalse) {
```

### add()
```javascript
      add: function() {
        if (list) {
          var start = list.length,
              add = function(args) {
                $.each(args, function(_, arg){
                  if (typeof arg === "function") {
                    // unique为true,且list中不包含该callback, 或者unique为true则push
                    if (!options.unique || !Callbacks.has(arg)) list.push(arg)
                  }
                  // arg为数组或类数组,则递归调用add函数
                  else if (arg && arg.length && typeof arg !== 'string') add(arg)
                })
              }
          add(arguments)
          // list正在firing, 则修正firingLength, 以便刚add的callback也能够执行到
          if (firing) firingLength = list.length
          // 注意执行过fire, 会设置memory, 直接add 没有执行过fire,是不会执行下面的语句
          else if (memory) {
            // 设置fire()中的firingStart
            firingStart = start
            fire(memory)
          }
        }
        return this
      },
```
#### 内部私有函数add()
add()方法内部定义了一个私有的函数add()
```JavaScript
add = function(args) {
        $.each(args, function(_, arg){
          if (typeof arg === "function") {
            // unique为true,且list中不包含该callback, 或者unique为true则push
            if (!options.unique || !Callbacks.has(arg)) list.push(arg)
          }
          // arg为数组或类数组,则递归调用add函数
          else if (arg && arg.length && typeof arg !== 'string') add(arg)
        })
      }
```
使用\$.each()遍历传入的参数, 若为函数, 则push到lish中, 否则使用`arg&&arg.length&& typeof arg !== 'string'`来判断其是否为数组/类数组, 并递归调用私有函数add().

```JavaScript
        if (!options.unique || !Callbacks.has(arg)) list.push(arg)
```
在添加回调到list中时, 若options.unique设置了true, 则会检查list中是否已经添加了该回调, 防止重复添加.

#### 使用私有函数add()添加回调
```JavaScript
      add(arguments)
      // list正在firing, 则修正firingLength, 以便刚add的callback也能够执行到
      if (firing) firingLength = list.length
      // 注意执行过fire, 会设置memory, 直接add 没有执行过fire,是不会执行下面的语句
      else if (memory) {
        // 设置fire()中的firingStart
        firingStart = start
        fire(memory)
      }
```

在定义了私有函数add()之后, 直接调用添加回调函数到list中. 

之后判断firing, 若正在遍历执行list, firing则为true, 则调整firingLength, 使得能够遍历到刚添加的回调函数.若firing为false, 且!!memory为true, 则设置firingStart, 调用fire(). 

这里提一下, firingStart的值其实和options.once有关, 若options.once为false, 则firingStart会随着add()的调用, 值是在逐渐增大的, 因为list.length随着add()的调用在增大.  若options.once为true, options.memory为true, 内部fire()函数中会有将list.length置零的操作, 如下.
```JavaScript
        if (stack) stack.length && fire(stack.shift())
        else if (memory) list.length = 0
```

### remove
```JavaScript
      remove: function() {
        if (list) {
          $.each(arguments, function(_, arg){
            var index
            // 判断remove的参数是否在list中
            while ((index = $.inArray(arg, list, index)) > -1) {
              list.splice(index, 1)
              // Handle firing indexes
              if (firing) {
                if (index <= firingLength) --firingLength
                if (index <= firingIndex) --firingIndex
              }
            }
          })
        }
        return this
      },
```
#### 遍历list
```JavaScript
    (index = $.inArray(arg, list, index)) > -1
```
remove()方法主要是对传入的参数进行遍历, 使用\$.inArray()来判断list中是否存在需要remove的回调函数, 若存在, 则使用splice()删除, 这里有一个细节, 使用index保存位置索引, 使得搜索更有效率.

#### 调整list相关参数
```JavaScript
      if (firing) {
        if (index <= firingLength) --firingLength
        if (index <= firingIndex) --firingIndex
      }
```
如果firing为true, 则调用remove(fn)方法, 需要调整list相关参数, 避免该操作对遍历的影响. 这里有个疑问, 存在index>firingLength的情况吗? 

### empty
```JavaScript
      empty: function() {
        firingLength = list.length = 0
        return this
      },
```
empty()方法用于清空回调函数list, list.length = 0, 即可实现. 即便firing为true, 由于firingLength赋值为0, list的遍历也会终止.

### lock
```JavaScript
      lock: function() {
        stack = undefined
        if (!memory) Callbacks.disable()
        return this
      },
```
lock()方法与disable()方法类似, 有两种情况
1. !memory为true, 等同于disable()
2. !memory为false, 此时, 只是将stack置为undefined(类似options.once为true), lock后, 无法继续直接调用fire(), 但可以使用add()方法间接触发fire().

***
# Callbacks执行流程图
关于add(), fire()方法, 这里画了它们的执行流程图, 可以帮助理解代码. 至于它们该称为"函数", 还是"方法", 这边就不细分了.

![add()][1]

![fire()][2]

[1]: https://raw.githubusercontent.com/fangbinwei/zepto_src_analysis/master/book/image/callbacks/%24.Callbacks().add().png
[2]: https://raw.githubusercontent.com/fangbinwei/zepto_src_analysis/master/book/image/callbacks/%24.Callbacks().fire().png