//     Zepto.js
//     (c) 2010-2016 Thomas Fuchs
//     Zepto.js may be freely distributed under the MIT license.

;(function($){
  $.fn.serializeArray = function() {
    var name, type, result = [],
      add = function(value) {
        // 如果value为数组, 则调用它的forEach
        if (value.forEach) return value.forEach(add)
        result.push({ name: name, value: value })
      }
      // form的elements包含了表单中所有的控件集合
    if (this[0]) $.each(this[0].elements, function(_, field){
      type = field.type, name = field.name
      // 排除fieldset
      if (name && field.nodeName.toLowerCase() != 'fieldset' &&
      // 排除禁用的控件
        !field.disabled && type != 'submit' && type != 'reset' && type != 'button' && type != 'file' &&
        // 如果是radio checkbox, 它们需要是被选中的
        ((type != 'radio' && type != 'checkbox') || field.checked))
          add($(field).val())
    })
    return result
  }

  // 将表单的元素拼接成 name1=value1&name2=value2的形式
  $.fn.serialize = function(){
    var result = []
    this.serializeArray().forEach(function(elm){
      result.push(encodeURIComponent(elm.name) + '=' + encodeURIComponent(elm.value))
    })
    return result.join('&')
  }

  $.fn.submit = function(callback) {
    // 有callback 则进行绑定
    if (0 in arguments) this.bind('submit', callback)
    // 无参数,则触发submit
    else if (this.length) {
      var event = $.Event('submit')
      this.eq(0).trigger(event)
      if (!event.isDefaultPrevented()) this.get(0).submit()
    }
    return this
  }

})(Zepto)
