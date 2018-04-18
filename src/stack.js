//     Zepto.js
//     (c) 2010-2016 Thomas Fuchs
//     Zepto.js may be freely distributed under the MIT license.

;(function($){
  $.fn.end = function(){
    // 返回上一个状态
    return this.prevObject || $()
  }

  $.fn.andSelf = function(){
    // 将上一个状态的集合加入到现集合中
    return this.add(this.prevObject || $())
  }

  'filter,add,not,eq,first,last,find,closest,parents,parent,children,siblings'.split(',').forEach(function(property){
    var fn = $.fn[property]
    $.fn[property] = function(){
      var ret = fn.apply(this, arguments)
      // 保存这些操作之前 原来的集合
      ret.prevObject = this
      return ret
    }
  })
})(Zepto)
