//     Zepto.js
//     (c) 2010-2016 Thomas Fuchs
//     Zepto.js may be freely distributed under the MIT license.

;(function($){
  // Create a collection of callbacks to be fired in a sequence, with configurable behaviour
  // Option flags:
  //   - once: Callbacks fired at most one time. fire是否可以重复执行, 若设置为true, stack则为false, 执行一次fire()后则执行disable()
  //   - memory: Remember the most recent context and arguments 用来记录fire时的context,args
  //   - stopOnFalse: Cease iterating over callback list 回调函数返回false 则中止list中回调的继续执行
  //   - unique: Permit adding at most one instance of the same callback 设置添加的callback是不是具有唯一性,是否可以重复添加
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
        fire = function(data) {
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
        },

        Callbacks = {
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
          has: function(fn) {
            // 若有fn参数,判断list中是否有fn, 否则判断list中是否有回调函数
            return !!(list && (fn ? $.inArray(fn, list) > -1 : list.length))
          },
          // 清空list 若有正在firing的函数,其执行完 后续也不会去循环list
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
          // 若memory存在, lock后不能继续fire, 但能add,并触发fire
          // 若memory存在, 等同于options.once设置为true
          lock: function() {
            stack = undefined
            if (!memory) Callbacks.disable()
            return this
          },
          locked: function() {
            return !stack
          },
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
          fire: function() {
            return Callbacks.fireWith(this, arguments)
          },
          // 判断回调是否fire过
          fired: function() {
            return !!fired
          }
        }

    return Callbacks
  }
})(Zepto)
