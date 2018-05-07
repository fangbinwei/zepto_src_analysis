# deferred

# Deferred? Promise?

deferred模块是想要模拟Promise, ES6采用了*Promise/A+规范*, 至于deferred模块其是否完全实现了该规范, 暂不追究.
> Promise规范

> https://zhuanlan.zhihu.com/p/25178630

> https://segmentfault.com/a/1190000002452115

可能你会比较疑惑Deferred 和Promise是不是同一个东西, jQuery, Zepto里怎么冒出个Deferred来, 我觉得Deferred算是Promise的超集, Deferred包含了Promise.

ES6的Promise在使用的时候就需要通过构造函数传递的方法, 进行resolve, reject, 如下
```JavaScript
    let p1 = new Promise(function(resolve, reject) {
        resolve(41)
    })
    p1.then(function(value) {
        console.log(value)// 41
    })
```

而Deferred , 可以先创建Deferred对象, 但不用马上写resolve, reject, 不需要通过构造函数传递resolve, reject.
```JavaScript
    let deferred = $.Deferred()
    //...
    // 合适的时机到了
    deferred.resolve(41)
    // deferred.then()// 直接调用then()在zepto中也可行
    deferred.promise().then(function(value){
       console.log(value) //41 
    })
```
以上算是一些比较粗浅的认识, 具体可以看一下, 下面这篇文章, 讲得比较细致,
> http://liubin.org/promises-book/#deferred-and-promise

# 整体代码结构
首先看一下deferred模块的整体结构, 

```JavaScript
;(function($){
  var slice = Array.prototype.slice

  function Deferred(func) {
    return deferred
  }

  $.when = function(sub) {
    return deferred.promise()
  }

  $.Deferred = Deferred
})(Zepto)
```
其在\$下扩展了when和Deferred方法, \$.when方法类似Promise.all()

***

# Deferred()函数
```JavaScript
function Deferred(func) {
    var tuples = [
          // action, add listener, listener list, final state
          [ "resolve", "done", $.Callbacks({once:1, memory:1}), "resolved" ],
          [ "reject", "fail", $.Callbacks({once:1, memory:1}), "rejected" ],
          [ "notify", "progress", $.Callbacks({memory:1}) ]
        ],
        state = "pending",
        promise = {
          state: function() {
            return state
          },
          always: function() {
            deferred.done(arguments).fail(arguments)
            return this
          },
          then: function(/* fnDone [, fnFailed [, fnProgress]] */) {
            var fns = arguments
            return Deferred(function(defer){
              $.each(tuples, function(i, tuple){
                var fn = $.isFunction(fns[i]) && fns[i]
                deferred[tuple[1]](function(){
                  var returned = fn && fn.apply(this, arguments)
                  if (returned && $.isFunction(returned.promise)) {
                    returned.promise()
                      .done(defer.resolve)
                      .fail(defer.reject)
                      .progress(defer.notify)
                  } else {
                    var context = this === promise ? defer.promise() : this,
                        values = fn ? [returned] : arguments
                    defer[tuple[0] + "With"](context, values)
                  }
                })
              })
              fns = null
            }).promise()
          },

          promise: function(obj) {
            return obj != null ? $.extend( obj, promise ) : promise
          }
        },
        deferred = {}

    $.each(tuples, function(i, tuple){
      var list = tuple[2],
          stateString = tuple[3]

      promise[tuple[1]] = list.add

      if (stateString) {
        list.add(function(){
          state = stateString
        }, tuples[i^1][2].disable, tuples[2][2].lock)
      }

      deferred[tuple[0]] = function(){
        deferred[tuple[0] + "With"](this === deferred ? promise : this, arguments)
        return this
      }
      deferred[tuple[0] + "With"] = list.fireWith
    })

    promise.promise(deferred)
    if (func) func.call(deferred, deferred)
    return deferred
  }
```

## 一些变量的声明
```JavaScript
    var tuples = [
          // action, add listener, listener list, final state
          [ "resolve", "done", $.Callbacks({once:1, memory:1}), "resolved" ],
          [ "reject", "fail", $.Callbacks({once:1, memory:1}), "rejected" ],
          [ "notify", "progress", $.Callbacks({memory:1}) ]
        ],
        state = "pending",
```
state的初始状态为pending.

tuples变量定义了一个数组, 为了后续能够比较方便地在promise对象上定义done, fail等方法.
resolve, reject, notify对应了callbacks模块中的fire()方法. done, fail, progress, 则对应了add()方法, 第3个参数是它们所对应维护的\$.Callbacks, 第4个参数是最后的state.

- resolve, pending -> resolved
- reject, pending -> rejected

可以发现, notify的\$.Callbacks()中的参数和其他两个有点区别, 对于resolve, reject, once参数为true, 这是为了设定只能resolve, reject 1 次. 而notify的执行(调用fire())次数不受限制, 个人觉得notify可以用在类似进度条的场景, 可以多次调用, 给出进度信息, 或者记录一些log.

```JavaScript
        promise = {
          //...
          }
        },
        deferred = {}
```
接着声明了promise和deferred对象

## 遍历tuple
```JavaScript
    $.each(tuples, function(i, tuple){
      var list = tuple[2],
          stateString = tuple[3]

      promise[tuple[1]] = list.add

      if (stateString) {
        list.add(function(){
          state = stateString
        }, tuples[i^1][2].disable, tuples[2][2].lock)
      }

      deferred[tuple[0]] = function(){
        deferred[tuple[0] + "With"](this === deferred ? promise : this, arguments)
        return this
      }
      deferred[tuple[0] + "With"] = list.fireWith
    })

    promise.promise(deferred)
    if (func) func.call(deferred, deferred)
    return deferred
  }
```
### done/fial/progress

list 是$.Callbacks(options)的返回值. stateString是resolve/reject. 在promise对象定义了done/fail/progress, 其实就是list.add, 注意这个list是它们各自的list.

```JavaScript
  if (stateString) {
    list.add(function(){
      state = stateString
    }, tuples[i^1][2].disable, tuples[2][2].lock)
  }
```
对于resolve/reject, 会使用list.add()添加若干个默认会执行的回调, 首先改变state, 从pending -> resolve/reject.

i^1是异或操作

| 0^1 | 1^1| 2^1 |
| :---: | :---: | :---: |
| 1 | 0 | 3 |

resolve, 会将reject所对应的list disable, 返回来, 执行reject的时候, 会将resolve所对应的list disable. resolve/reject都会将notify所对应的list lock. disable和lock的区别在callbacks模块章有提到, 在memory为true的情况下, lock之后, 还可以通过add()来间接触发fire().

### resolve/reject/notify/resolveWith/rejectWith/notifyWith
```JavaScript
  deferred[tuple[0]] = function(){
    // resolveWith rejectWith notifyWith(context, args)
    deferred[tuple[0] + "With"](this === deferred ? promise : this, arguments)
    return this
  }
  // deferred.resolveWith/rejectWith/notifyWith 参数为(context[, args])
  deferred[tuple[0] + "With"] = list.fireWith
```

在deferred对象上定义resolve/reject/notify, 内部是调用了list.fireWith(context, args) 

```JavaScript
    deferred[tuple[0] + "With"](this === deferred ? promise : this, arguments)
```

这里判断了this, 若是deferred, 则将promise作为context, 因此, 下面的例子中, deferred.then的函数参数中this指向deferred.promise(). 
```JavaScript
    let deferred = $.Deferred()
    deferred.resolve(41)

    let then1 = deferred.then(function(value){
    // this -> deferred.promise()
    // this === deferred.promise() //true
       return value 
    })
```

## 用promise扩展deferred

```JavaScript
    promise.promise(deferred)
    if (func) func.call(deferred, deferred)
    return deferred
```
### promise.promise()
```JavaScript
  promise: function(obj) {
    return obj != null ? $.extend( obj, promise ) : promise
  }
```
promise.promise(deferred), 在deferred对象上扩展了promise的state,always,then,promise方法, 用\$.extend()实现.

至于为什么这么做, 暂时没有想要一定要非这么做不可的理由. 

那么既然deferred 上有了promise的所有方法, 那像是提供deferred.promise()方法的意义是什么? 反正deferred上什么方法都有了, 还获取promise干嘛呢? 不同与deferred, promise上的方法都无法改变state的状态. 后面会说到promise.then()方法返回的就是一个promise对象, 其可以防止用户对Deferred中state的修改, 因为无法调用resolve/reject()等方法. 杜绝了像下面这样的例子, 
```JavaScript
    let deferred = $.Deferred()
    deferred.resolve(41)
    let then1 = deferred.then(function(value){
        console.log('before wait, value: ', value) // before wait value: 41
        return wait()
    })
    then1.reject() // error! then1返回的是Deferred(func).promise() 没有reject()方法
    let then2 = then1.then(function(value) {
        console.log('done')
    })

    function wait() {
        let deferred = $.Deferred()
        setTimeout(() => {
            deferred.resolve(42)
        },5000)
        return deferred
    }
```

```JavaScript
    if (func) func.call(deferred, deferred)
```
若Deferred带有函数参数, 则调用call(), 传入context 和 args, 都是deferred

这个操作主要是在promise中.then()方法用到, 涉及到链式调用等情况.

## promise对象

### state

```JavaScript
  state: function() {
    return state
  },
```

### always
```JavaScript
  always: function() {
    deferred.done(arguments).fail(arguments)
    return this
  },
```
把arguments 加入resolve对应的list中 和 reject对应的list中, 这样无论是resolve还是reject, 总是会被调用.

### then
```JavaScript
      then: function(/* fnDone [, fnFailed [, fnProgress]] */) {
        var fns = arguments
        return Deferred(function(defer){
          $.each(tuples, function(i, tuple){
            var fn = $.isFunction(fns[i]) && fns[i]
            deferred[tuple[1]](function(){
              var returned = fn && fn.apply(this, arguments)
              if (returned && $.isFunction(returned.promise)) {
                returned.promise()
                  .done(defer.resolve)
                  .fail(defer.reject)
                  .progress(defer.notify)
              } else {
                var context = this === promise ? defer.promise() : this,
                    values = fn ? [returned] : arguments
                defer[tuple[0] + "With"](context, values)
              }
            })
          })
          fns = null
        }).promise()
      },
```
then()方法主要是用来往deferred中对应resolve/reject/notify的list中添加回调函数, 除此之外还要保证其可以链式调用, 添加的回                                                                                                                                      调函数有可能返回promise对象.

#### 返回值
```JavaScript
return Deferred(func).promise()
```
then()方法返回的是一个promise对象, 可以支持链式调用.

#### 遍历tuples, 添加回调fnDone/fnFailed/fnProgress
```JavaScript
      var fns = arguments
      $.each(tuples, function(i, tuple){
        var fn = $.isFunction(fns[i]) && fns[i]
        deferred[tuple[1]](function(){
          var returned = fn && fn.apply(this, arguments)
          if (returned && $.isFunction(returned.promise)) {
            returned.promise()
              .done(defer.resolve)
              .fail(defer.reject)
              .progress(defer.notify)
          } else {
            var context = this === promise ? defer.promise() : this,
                values = fn ? [returned] : arguments
            defer[tuple[0] + "With"](context, values)
          }
        })
      })
```
首先判断传入参数是否是函数, 并调用deferred.done/fail/progress添加一个回调函数, 该回调函数的职责主要有两个:

1. 执行then()传入的函数参数
2. 判断传入函数的返回值, 根据其是否有promise方法, 进行不同的处理

```JavaScript
      if (returned && $.isFunction(returned.promise)) {
        // console.log('if')
        // 当then(fn) 中函数fn执行完，触发return的promise所对应deferred的resolve
        returned.promise()
          .done(defer.resolve)
          .fail(defer.reject)
          .progress(defer.notify)
      }
```
##### promise情况
如果是返回值有promise方法, 说明then()传入的是一个deferred/promise对象, 并调用promise的done/fail/progress 绑定defer.resolve/reject/notify, 使该函数执行完后, 能够将状态继续传给defer, defer来自 Deferred(function(defer){}), 这里可能听着有点绕. 下面会举栗子.

##### 非promise情况
```JavaScript
 } else {
        var context = this === promise ? defer.promise() : this,
            values = fn ? [returned] : arguments
        defer[tuple[0] + "With"](context, values)
      }
```
如果不出什么幺蛾子, this === promise 是能够成立的, 因为下面这段代码不出意外, 传入的是promise
```JavaScript
 deferred[tuple[0] + "With"](this === deferred ? promise : this, arguments)
```
如果fn回调函数存在, 它的返回值包装成数组, 传给resolveWith/rejectWith/notifyWith, 因为callbacks模块中, 会调用apply来执行.

##### 释放引用
```JavaScript
fns = null
```

### then的一个栗子
下面看一个栗子, 包含了同步和异步的情况,
```JavaScript
    let deferred = $.Deferred()
    deferred.resolve(41)
    let then1 = deferred.then(function(value){
      console.log('before wait, value: ', value)
      return wait()
    })

    let then2 = then1.then(function(value) {
        console.log(value) //42
    })

    function wait() {
        let deferred = $.Deferred()
        setTimeout(() => {
            deferred.resolve(42)
        },5000)
        return deferred
    }
```
![deferred][1]

[1]: https://raw.githubusercontent.com/fangbinwei/zepto_src_analysis/master/book/image/deferred/zepto_deferred.png

# \$.when()
$.when() 类似Promise.all(), 管理一个队列, 队列中是一系列Promise对象(zepto中是deferred/promise), 在队列中所有Promise对象resolve后, 才执行回调函数.

## 一些变量声明
```JavaScript
  $.when = function(sub) {
    var resolveValues = slice.call(arguments),
        len = resolveValues.length,
        i = 0,
        remain = len !== 1 || (sub && $.isFunction(sub.promise)) ? len : 0,
        deferred = remain === 1 ? sub : Deferred(),
        progressValues, progressContexts, resolveContexts,
        updateFn = function(i, ctx, val){
          return function(value){
            ctx[i] = this
            val[i] = arguments.length > 1 ? slice.call(arguments) : value
            if (val === progressValues) {
              deferred.notifyWith(ctx, val)
            } else if (!(--remain)) {
              deferred.resolveWith(ctx, val)
            }
          }
        }
```
resolveValues的初始值是arguments的数组化后的副本, 后续会用来存放\$.Deferred().resolve(args)中的args.

len表示\$.when()传入参数的数量

```JavaScript
    remain = len !== 1 || (sub && $.isFunction(sub.promise)) ? len : 0,
```
1. 若len!==1, remain = len
2. 若len===1, 则判断sub是否有promise方法, 若有, remain = 1, 否则 remain =0

remain可以理解为arguments的长度, 后续会根据\$.when()传入的参数是否有promise方法进行修正.

```JavaScript
   deferred = remain === 1 ? sub : Deferred(),
```
若remain为1, 则deferred赋值为sub, 否则使用Deferred(). 

这里需要注意remain为1的情况,\$.when(sub) return的是sub.promise(), \$.when(sub).done/fail/notify等都是直接在sub.promise()上进行, remain不为0的情况, 使用Deferred()创建了一个代理deferred, 当队列中的对象全部resolve后, 会触发代理deferred的resolve. reject/notify的情况也类似.

```JavaScript
progressValues, progressContexts, resolveContexts,
```
接着定义progressValues, 用于保存队列中的对象notify时传递的value, progressContext, resolveContexts, 分别保存队列中对象notify和resolve的context.

### updateFn
```JavaScript
    updateFn = function(i, ctx, val){
      return function(value){
        ctx[i] = this
        val[i] = arguments.length > 1 ? slice.call(arguments) : value
        
        if (val === progressValues) {
          deferred.notifyWith(ctx, val)
        } else if (!(--remain)) {
          deferred.resolveWith(ctx, val)
        }
      }
    }
```
\$.when()可以传入一系列含promise方法的对象, 这些对象在resolve/notify后, 都会执行updateFn()返回的函数, 为了方便下文叙述, 我们将其返回的函数记为**updateFnReturn**.

i 是\$.when()传入参数 arguments的索引, 即队列的索引, ctx是用于保存队列中对象resolve/notify时的context, 是一个数组, val是用于保存队列中对象resolve/notify时的参数, 即上面代码中的value, val也是一个数组.

```JavaScript
    val[i] = arguments.length > 1 ? slice.call(arguments) : value
```
若arguments长度大于1, 则val[i]赋值为arguments数组化的一个副本, 如果长度为1, val[i]直接赋值为value.
```JavaScript
        if (val === progressValues) {
          deferred.notifyWith(ctx, val)
        } else if (!(--remain)) {
          deferred.resolveWith(ctx, val)
        }
```
队列中的对象在resolve/notify后都会执行updateFnReturn, 需要区别这两种情况.

val === progressValues的时候, 说明队列中的对象调用了notify, 马上执行deferred.notifyWith(ctx, val), 需要注意\$.when()返回的就是这里的deferred.promise(), 再次提醒ctx, val都是数组, 所以\$.when(sub).progress(func)的func中的this也是一个数组, 

如果不是调用了notify, 就说明调用了resolve, 那就将remain减1, 当remain减到了0, 说明队列中的对象全部resolve完了, 此时再最后调用deferred.resolveWith, 执行\$.when(sub).done(func)所添加的回调.

## 队列长度为1的情况
当remain为1时, deferred = sub, 直接return deferred.promise()

## 队列长度为0的情况
```JavaScript
    if (!remain) deferred.resolveWith(resolveContexts, resolveValues)
```
1. $.when()没有传入参数, resolveContexts 为undefined, resolveValues为空数组[].
2. 传入的参数没有promise方法,如下, 则resolveContexts为空数组, resolveValues与传入参数有关, 若为undefined, resolveValues是[undefined,]这种空数组的形式.
```JavaScript
function two() {
    console.log('two')
}
$.when(two())
```

## 队列长度大于1的情况
```JavaScript
    if (len > 1) {
      progressValues = new Array(len)
      progressContexts = new Array(len)
      resolveContexts = new Array(len)
      for ( ; i < len; ++i ) {
        if (resolveValues[i] && $.isFunction(resolveValues[i].promise)) {
          resolveValues[i].promise()
            .done(updateFn(i, resolveContexts, resolveValues))
            .fail(deferred.reject)
            .progress(updateFn(i, progressContexts, progressValues))
        } else {
          // 若resolveValues[i]为非异步函数(返回值没有promise函数), remain对应减1
          --remain
        }
      }
    }
```
首先初始化progressValues, progressContexts, resolveContexts, 然后判断resolveValues数组中的各项是否有promise方法, 若没有, remain自减.

若resolveValues[i]有promise方法, 则调用其promise上的done/fail/progress 传入updateFn(i, ctx, val)的返回函数或deferred.reject, 若调用了fail(deferred.reject), 后续deferred.resolveWith都不会执行, 因为他们对应的list 已经disable.

## \$.when的示例
```JavaScript
    var wait = function() {
      var defer = $.Deferred()
      var tasks = function() {
        defer.notify('before done')
        console.log('wait function done!')
        defer.notify('after done')
        defer.reject('wait reject')
        defer.notify('after resolve')// 无法执行，被lock了
      }
      setTimeout(tasks, 5000)
      // tasks()
      return defer
    }
    var wait2 = function() {
      var defer = $.Deferred()
      var tasks = function() {
        defer.notify('before done')
        console.log('wait2 function done!')
        defer.notify('after done')
        defer.resolve('wait2 resolve')
      }
      setTimeout(tasks, 5000)
      // tasks()
      return defer
    }
    function two () {
      console.log('two')
      return 'two'
    }
    $.when(wait(), two(), wait2())
     .progress(function(value, value2, value3) {
       console.log('progress value: ', value, value2, value3)
     })
     .done(function(value, value2, value3) {
       console.log('hhh successfully')
       console.log('value', value, value2, value3)
    })
     .fail(function(err) {
       console.log(err, '出错了')
     })
```
```
two
progress value:  before done undefined undefined
wait function done!
progress value:  after done undefined undefined
wait reject 出错了
wait2 function done!
```

# 小结
还是喜欢ES6的Promise, 个人觉得分什么deferred, promise, 弄得太乱了, 不易于理解代码.