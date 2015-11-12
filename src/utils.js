'use strict';

var _translations = {};

/**
 * Register a set of translations, for example ('en-us', { greeting: 'Hello' })
 */
function registerTranslation(langKey, data) {
  _translations[langKey] = data;
}

function setDefaultTranslation(langKey) {
  _translations['default'] = _translations[langKey] || _translations['default'];
}

function lang(obj, langKey) {
  var lang = langKey ? _translations[langKey] || _translations['default'] : _translations['default'];
  return (lang && lang[obj]) || obj;
}

// TODO: remove
function breakLines(msg) {
  msg = msg.replace(/\//g, '/<span style="font-size:1px"> </span>');
  msg = msg.replace(/&/g, '&<span style="font-size:1px"> </span>');
  msg = msg.replace(/%/g, '%<span style="font-size:1px"> </span>');
  return msg;
}

function hashFunc(str) {
  if (!str) { return str; }
  for(var r=0, i=0; i<str.length; i++) {
    r = (r<<5) - r+str.charCodeAt(i);
    r &= r;
  }
  return r;
}

function shortenKey(str) {
  str = jQuery.trim(str);
  var lastSlash = str.lastIndexOf('/'), lastHash = str.lastIndexOf('#');
  return lastSlash > lastHash ? str.substring(lastSlash + 1) : str.substring(lastHash + 1);
}

function circleChords(radius, steps, centerX, centerY, breakAt, onlyElement) {
  var values = [];
  var i = 0;
  if (onlyElement) {
    // ottimizzo i cicli evitando di calcolare elementi che non
    // servono
    i = onlyElement;
    var radian = (2 * Math.PI) * (i / steps);
    values.push([centerX + radius * Math.cos(radian), centerY + radius * Math.sin(radian)]);
  } else {
    for (; i < steps; i++) {
      // calcolo le coodinate lungo il cerchio del box per
      // posizionare
      // strumenti ed altre risorse
      var radian = (2 * Math.PI) * (i / steps);
      values.push([centerX + radius * Math.cos(radian), centerY + radius * Math.sin(radian)]);
    }
  }
  return values;
}

var LodLiveUtils = {
  registerTranslation: registerTranslation,
  setDefaultTranslation: setDefaultTranslation,
  lang: lang,
  breakLines: breakLines,
  hashFunc: hashFunc,
  shortenKey: shortenKey,
  circleChords: circleChords
};

module.exports = LodLiveUtils;

if (!window.LodLiveUtils) {
  window.LodLiveUtils = LodLiveUtils;
}
