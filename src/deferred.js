//     Zepto.js
//     (c) 2010-2016 Thomas Fuchs
//     Zepto.js may be freely distributed under the MIT license.
//
//     Some code (c) 2005, 2013 jQuery Foundation, Inc. and other contributors

;(function($){
  var slice = Array.prototype.slice

  function Deferred(func) {
    var tuples = [
          // action, add listener, listener list, final state
          // memory:1 add新的callback后会用memory中的context args 调用callback
          // once: 1 只能fire1次
          //  不设置once则可以一直fire, 且队列中的callback数量随着add 一直增加
          [ "resolve", "done", $.Callbacks({once:1, memory:1}), "resolved" ],
          [ "reject", "fail", $.Callbacks({once:1, memory:1}), "rejected" ],
          // 未设置once 或once为false， 是否设置memory 只影响add callback后，是否立即执行callback
          [ "notify", "progress", $.Callbacks({memory:1}) ]
        ],
        state = "pending",
        promise = {
          state: function() {
            return state
          },
          // 无论是resolve 还是reject, 总是执行
          always: function() {
            deferred.done(arguments).fail(arguments)
            return this
          },
          // then方法返回的还是一个promise对象，可以链式调用
          then: function(/* fnDone [, fnFailed [, fnProgress]] */) {
            var fns = arguments
            // defer: then() return的promise所对应的deferred
            return Deferred(function(defer){
              $.each(tuples, function(i, tuple){
                var fn = $.isFunction(fns[i]) && fns[i]
                // 将回调add到当前deferred对应的list中(then()方法所在环境的deferred)
                deferred[tuple[1]](function(){
                  var returned = fn && fn.apply(this, arguments)
                  // 异步情况：若返回的是一个包含promise方法的对象
                  if (returned && $.isFunction(returned.promise)) {
                    // console.log('if')
                    // 当then(fn) 中异步函数fn执行完，触发return的promise所对应deferred的resolve
                    returned.promise()
                      .done(defer.resolve)
                      .fail(defer.reject)
                      .progress(defer.notify)
                      // 非异步情况
                  } else {
                    // console.log('else')
                    // console.log(this === promise, this)
                    var context = this === promise ? defer.promise() : this,
                        values = fn ? [returned] : arguments
                        // 将函数返回值和context fireWith， 保存为memory， callback队列中一旦add进函数，就触发
                        // 当then(fn) 中同步函数fn执行完，触发return的promise所对应deferred的resolve
                    defer[tuple[0] + "With"](context, values)
                  }
                })
              })
              //释放引用
              fns = null
              // then 方法返回promise对象
            }).promise()
          },

          promise: function(obj) {
            return obj != null ? $.extend( obj, promise ) : promise
          }
        },
        deferred = {}

    $.each(tuples, function(i, tuple){
      // list -> $.Callbacks({once:, memory:})
      var list = tuple[2],
      // stateString resolve/reject
          stateString = tuple[3]

          // promise.done/fail/progress
      promise[tuple[1]] = list.add

      if (stateString) {
        list.add(function(){
          // state pending ->resolve/reject
          state = stateString
          // ^按位异或 0^1 1, 1^1 0, 2^1 3
          // resolve, reject disable, progress lock
          // reject, resolve disable, progress lock
          // notify, undefined, progress lock
        }, tuples[i^1][2].disable, tuples[2][2].lock)// 最后会将notify的callback队列lock，lock后其不能fire
      }

      // deferred.resolve/reject/notify 参数为([args])
      deferred[tuple[0]] = function(){
        // resolveWith rejectWith notifyWith(context, args)
        deferred[tuple[0] + "With"](this === deferred ? promise : this, arguments)
        return this
      }
      // deferred.resolveWith/rejectWith/notifyWith 参数为(context[, args])
      deferred[tuple[0] + "With"] = list.fireWith
    })

    // deferred extend了promise的属性
    promise.promise(deferred)
    if (func) func.call(deferred, deferred)
    return deferred
  }

  $.when = function(sub) {
    var resolveValues = slice.call(arguments),
        len = resolveValues.length,
        i = 0,
        // 若len不为1 remain = len 
        // 若len为1, 则判断sub是否为异步对象，若是，则remain = 1， 若不是，remain = 0
        remain = len !== 1 || (sub && $.isFunction(sub.promise)) ? len : 0,
        deferred = remain === 1 ? sub : Deferred(),
        progressValues, progressContexts, resolveContexts,
        updateFn = function(i, ctx, val){
          return function(value){
            // 存入promise对象
            ctx[i] = this
            // 将resolve 或 progress的值存入resolveValues/ progressValues中
            // 修改val[i]就指向 progressValues[i]/resolveValues[i] 这里需要注意传入的是数组
            val[i] = arguments.length > 1 ? slice.call(arguments) : value
            
            // 如果是sub中的notify执行了,立刻执行deferred.notify
            if (val === progressValues) {
              // console.log('ctx', i, ctx, val)
              deferred.notifyWith(ctx, val)
              // remain 为0时，说明所有异步函数都已经执行完毕，将它们resolve的参数，进行统一resolve
            } else if (!(--remain)) {
              deferred.resolveWith(ctx, val)
            }
          }
        }

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
    // 直接resolve
    // 函数无参数(resolveContexts 为undefined)，或参数不为异步对象(resolveContexts为空数组)
    if (!remain) deferred.resolveWith(resolveContexts, resolveValues)
    // console.log('resolveContexts', resolveContexts,
    // 'resolveValues', resolveValues,
    // 'progressValues', progressValues)
    return deferred.promise()
  }

  $.Deferred = Deferred
})(Zepto)
