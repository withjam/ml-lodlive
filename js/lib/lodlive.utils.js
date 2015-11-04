// TODO: remove; this doesn't appear to be used

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
