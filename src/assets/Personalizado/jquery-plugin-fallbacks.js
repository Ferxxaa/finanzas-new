(function (window) {
    var $ = window.jQuery || window.$;

    if (!$ || !$.fn) {
        return;
    }

    if (typeof $.fn.slimscroll !== 'function') {
        $.fn.slimscroll = function () {
            return this;
        };
    }

    if (typeof $.fn.datetimepicker !== 'function') {
        $.fn.datetimepicker = function () {
            return this;
        };
    }
})(window);