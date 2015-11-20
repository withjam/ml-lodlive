'use strict'

var httpClientFactory = {
  /*
   * Create a new httpClient instance
   *
   * @param {Object} connection - connection configuration
   * @prop {String} connection.endpoint - the request endpoint URL
   * @prop {Object|String} connection.defaultParams - the default URL params
   * @prop {Object} connection.headers - request headers
   * @prop {Boolean} jsonp - make a JSONP request instead of AJAX
   * @return {Function} an httpClient instance
   */
  create: function(connection) {
    if (!connection.endpoint) {
      throw new Error('missing required connection.endpoint for httpClient');
    }

    function parseParams(params) {
      if (!connection.defaultParams) {
        return $.param(params)
      } else if (typeof connection.defaultParams === 'object') {
        return $.param($.extend({}, connection.defaultParams, params))
      } else {
        return connection.defaultParams + '&' + $.param(params)
      }
    }

    /**
     * Makes an http request
     *
     * @param {Object} params - URL params
     * @param {Object} callbacks
     *
     * @prop {Function} callbacks.beforeSend
     * @prop {Function} callbacks.success
     * @prop {Function} callbacks.error
     */
    return function httpClient(params, callbacks) {

      var fullUrl = connection.endpoint + '?' + parseParams(params);
      var afterSend;

      $.ajax({
        url: fullUrl,
        contentType: 'application/json',
        dataType: connection.jsonp ? 'jsonp': 'json',
        headers: connection.headers || {},
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
