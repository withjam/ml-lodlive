(function () {
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

  if (!window.LodLiveUtils) {
    window.LodLiveUtils = LodLiveUtils;
  }

})();

// a causa di un baco di opera e firefox implmento una funzione apposita per
// settare la posizione dei background
// Due to a bug in opera and firefox implement a specific function for
// Setting the position of the background
// TODO: what bug, and what versions?
$.fn.setBackgroundPosition = function(pos) {
  'use strict';

  var backPos = $.trim(this.css('background-position'));
  var hasString = backPos.indexOf('left') == -1 ? false : true;
  // added fix for chrome 25
  backPos = backPos.replace(/top/gi, '').replace(/left/gi, '');
  backPos = $.trim(backPos.replace(/  /g, ' '));

  try {
    var backPosArray = backPos.split(' ');
    if (pos.x || pos.x == 0) {
      backPosArray[0] = pos.x + 'px';
    }
    if (pos.y || pos.y == 0) {
      backPosArray[1] = pos.y + 'px';
    }
    if (hasString) {
      backPos = 'left ' + backPosArray[0] + ' top ' + backPosArray[1];
    } else {
      backPos = backPosArray[0] + ' ' + backPosArray[1];
    }
  } catch (e) {
    alert(e);
  }
  this.css({
    'background-position' : backPos
  });
  return this;
};
