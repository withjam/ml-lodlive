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

  LodLiveUtils.isSameAsLine = function(label, x1, y1, x2, y2, canvas, toId) {

    // eseguo i calcoli e scrivo la riga di connessione tra i cerchi
    // calculate the angle and draw the line between nodes
    var lineangle = (Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI) + 180;
    var x2bis = x1 - Math.sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1)) + 60;
    //canvas.detectPixelRatio();
    canvas.rotateCanvas({
      rotate : lineangle,
      x : x1,
      y : y1
    }).drawLine({
      strokeStyle : "#000",
      strokeWidth : 1,
      strokeCap : 'bevel',
      x1 : x1 - 60,
      y1 : y1,
      x2 : x2bis,
      y2 : y1
    });

    if (lineangle > 90 && lineangle < 270) {
      canvas.rotateCanvas({
        rotate : 180,
        x : (x2bis + x1) / 2,
        y : (y1 + y1) / 2
      });
    }
    label = $.trim(label).replace(/\n/g, ', ');

    // inserisco l'etichetta
    // add the label
    canvas.drawText({
      fillStyle : "#000",
      strokeStyle : "#000",
      x : (x2bis + x1 + ((x1 + 60) > x2 ? -60 : +60)) / 2,
      y : (y1 + y1 - ((x1 + 60) > x2 ? 18 : -18)) / 2,
      text : ((x1 + 60) > x2 ? " « " : "") + label + ((x1 + 60) > x2 ? "" : " » "),
      align : "center",
      strokeWidth : 0.01,
      fontSize : 11,
      fontFamily : "'Open Sans',Verdana"
    }).restoreCanvas().restoreCanvas();

    // ed inserisco la freccia per determinarne il verso della relazione
    // insert the arrow to determine the direction of the relationship
    lineangle = Math.atan2(y2 - y1, x2 - x1);
    var angle = 0.79;
    var h = Math.abs(8 / Math.cos(angle));
    var fromx = x2 - 60 * Math.cos(lineangle);
    var fromy = y2 - 60 * Math.sin(lineangle);
    var angle1 = lineangle + Math.PI + angle;
    var topx = (x2 + Math.cos(angle1) * h) - 60 * Math.cos(lineangle);
    var topy = (y2 + Math.sin(angle1) * h) - 60 * Math.sin(lineangle);
    var angle2 = lineangle + Math.PI - angle;
    var botx = (x2 + Math.cos(angle2) * h) - 60 * Math.cos(lineangle);
    var boty = (y2 + Math.sin(angle2) * h) - 60 * Math.sin(lineangle);

    canvas.drawLine({
      strokeStyle : "#000",
      strokeWidth : 1,
      x1 : fromx,
      y1 : fromy,
      x2 : botx,
      y2 : boty
    });
    canvas.drawLine({
      strokeStyle : "#000",
      strokeWidth : 1,
      x1 : fromx,
      y1 : fromy,
      x2 : topx,
      y2 : topy
    });
  };

  LodLiveUtils.customLines = function(context, method) {
    console.log('customLines', method);
    if (LodLiveUtils[method]) {
      return LodLiveUtils[method].apply(this, Array.prototype.slice.call(arguments, 2));
    }
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
    var backPosArray = backPos.split(" ");
    if (pos.x || pos.x == 0) {
      backPosArray[0] = pos.x + 'px';
    }
    if (pos.y || pos.y == 0) {
      backPosArray[1] = pos.y + 'px';
    }
    if (hasString) {
      backPos = "left " + backPosArray[0] + " top " + backPosArray[1];
    } else {
      backPos = backPosArray[0] + " " + backPosArray[1];
    }
  } catch (e) {
    alert(e);
  }
  this.css({
    'background-position' : backPos
  });
  return this;
};
