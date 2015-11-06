'use strict'

var httpClientFactory = {
  /*
   * Create a new httpClient instance
   *
   * @param {String} endpoint - the request endpoint URL
   * @param {Object|String} defaultParams - the default URL params
   * @param {String} accepts - accepts header mime-type (from profile)
   * @param {String} dataType - `json` or `jsonp`
   * @return {Function} an httpClient instance
   */
  create: function(endpoint, defaultParams, accepts, dataType) {

    function parseParams(params) {
      // TODO if (typeof defaultParams === 'object') ...

      return defaultParams + '&' + $.param(params)
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

      var fullUrl = endpoint + '?' + parseParams(params);
       var afterSend;

       $.ajax({
        url: fullUrl,
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
