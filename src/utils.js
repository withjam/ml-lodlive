'use strict';

var LodLiveUtils = {};

var _translations = {};

LodLiveUtils.getSparqlConf = function(what, where, lodLiveProfile) {
  return where.sparql && where.sparql[what] ? where.sparql[what] : lodLiveProfile['default'].sparql[what];
};

/**
  * Register a set of translations, for example ('en-us', { greeting: 'Hello' })
**/
LodLiveUtils.registerTranslation = function(langKey, data) {
  _translations[langKey] = data;
};

LodLiveUtils.setDefaultTranslation = function(langKey) {
  _translations['default'] = _translations[langKey] || _translations['default'];
};

LodLiveUtils.lang = function(obj, langKey) {
  var lang = langKey ? _translations[langKey] || _translations['default'] : _translations['default'];
  return (lang && lang[obj]) || obj;
};

LodLiveUtils.breakLines = function breakLines(msg) {
  msg = msg.replace(/\//g, '/<span style="font-size:1px"> </span>');
  msg = msg.replace(/&/g, '&<span style="font-size:1px"> </span>');
  msg = msg.replace(/%/g, '%<span style="font-size:1px"> </span>');
  return msg;
};

LodLiveUtils.hashFunc = function hashFunc(str) {
  if (!str) { return str; }
  for(var r=0, i=0; i<str.length; i++) {
    r = (r<<5) - r+str.charCodeAt(i);
    r &= r;
  }
  return r;
};

LodLiveUtils.shortenKey = function(str) {
  str = jQuery.trim(str);
  var lastSlash = str.lastIndexOf('/'), lastHash = str.lastIndexOf('#');
  return lastSlash > lastHash ? str.substring(lastSlash + 1) : str.substring(lastHash + 1);
};

module.exports = LodLiveUtils;

if (!window.LodLiveUtils) {
  window.LodLiveUtils = LodLiveUtils;
}
