'use strict'

var httpClientFactory = {
  create: function(accepts, dataType) {
    return function httpClient(url, params, callbacks) {
      // TODO: parse params arg
      if (!callbacks) {
        callbacks = params;
        params = ''
      }

      var fullUrl = url + params;
      var afterSend;

      $.ajax({
        url : fullUrl,
        contentType: 'application/json',
        accepts: accepts,
        dataType: dataType,
        // ugly
        // timeout: callbacks.timeout || null,
        beforeSend: function() {
          if (callbacks.beforeSend) afterSend = callbacks.beforeSend();
        },
        success: function() {
          if (afterSend) afterSend();
          if (callbacks.success) callbacks.success.apply(null, arguments);
        },
        error: function() {
          if (afterSend) afterSend();
          if (callbacks.error) callbacks.error.apply(null, arguments);
        }
      });
    }
  }
};

module.exports = httpClientFactory;

// temporary, for testing
if (!window.httpClientFactory) {
  window.httpClientFactory = httpClientFactory;
}
