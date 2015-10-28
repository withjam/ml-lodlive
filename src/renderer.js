'use strict'

var utils = require('./utils.js');

/**
 * Built-in "always on" tools
 */
// TODO: where should these live?
var _builtinTools = {
  'docInfo': '<div class="actionBox docInfo" rel="docInfo"><span class="fa fa-list"></span></div>',
  'tools': '<div class="actionBox tools" rel="tools"><span class="fa fa-cog"></span></div>'
};

/**
 * Built-in tools
 */
// TODO: where should these live?
var _builtins = {
  'expand': {
    title: 'Expand all',
    icon: 'fa fa-arrows-alt',
    handler: function(obj, inst) {
      var idx = 0;
      var elements = obj.find('.relatedBox:visible');
      var totalElements = elements.length;
      var onTo = function() {
        var elem= elements.eq(idx++);
        if (elem.length) {
          elem.click();
        }
        if (idx < totalElements) {
          window.setTimeout(onTo, 120);
        }
      };
      window.setTimeout(onTo, 120);
    }
  },
  'info': {
    title: 'More info',
    icon: 'fa fa-info-circle',
    handler: function(obj, inst) {
      // TODO: ?
    }
  },
  'rootNode': {
    title: 'Make root node',
    icon: 'fa fa-dot-circle-o',
    handler: function(obj, instance) {
      instance.context.empty();
      instance.init(obj.attr('rel'));
    }
  },
  'remove': {
    title: 'Remove this node',
    icon: 'fa fa-trash',
    handler: function(obj, inst) {
      inst.removeDoc(obj);
    }
  },
  'openPage': {
    title: 'Open in another page',
    icon: 'fa fa-external-link',
    handler: function(obj, inst) {
      window.open(obj.attr('rel'));
    }
  }
};

function LodLiveRenderer(arrows, tools, nodeIcons, refs) {
  this.arrows = arrows;
  this.tools = tools;
  this.nodeIcons = nodeIcons;
  this.refs = refs;
}

/**
 * Render a loading glyph
 *
 * @param {Element} target - a jQuery element
 * @return {Function} a function to remove the loading glyph
 */
LodLiveRenderer.prototype.loading = function loading(target) {
  var top = target.height() / 2 - 8;

  // TODO: issue #18
  // '<i class="fa fa-spinner fa-spin" style="margin-top:' + top + 'px;margin-left: 5px"/></i>'
  var loader = $('<img class="loader" style="margin-top:' + top + 'px" src="img/ajax-loader.gif"/>');

  target.append(loader);

  return function() {
    loader.remove();
  };
};

/**
 * Configure hover interactions for `target`
 *
 * Defaults to `renderer.msg(target.attr('data-title'), 'show')`
 *
 * @param {Object} target - jQuery object containing one-or-more elements
 * parma {Function} [showFn] - function to invoke on hover
 */
LodLiveRenderer.prototype.hover = function hover(target, showFn) {
  var renderer = this;

  target.each(function() {
    var el = $(this);
    el.hover(function() {
      if (showFn) return showFn();
      renderer.msg(el.attr('data-title'), 'show');
    }, function() {
      renderer.msg(null, 'hide');
    });
  });
};

/**
 * Creates (and centers) the first URI box
 */
LodLiveRenderer.prototype.firstBox = function(firstUri) {
  var renderer = this;
  var ctx = renderer.context;
  var ch = ctx.height();
  var cw = ctx.width();

  // FIXME: we don't want to assume we scroll the entire window here
  // since we could be just a portion of the screen or have multiples
  ctx.parent().scrollTop(ch / 2 - ctx.parent().height() / 2 + 60);
  ctx.parent().scrollLeft(cw / 2 - ctx.parent().width() / 2 + 60);

  // console.log(ctx.parent().scrollTop());

  var top = (ch - 65) / 2 + (ctx.scrollTop() || 0);
  var left = (cw - 65) / 2 + (ctx.scrollLeft() || 0);

  //console.log('centering top: %s, left: %s', top, left);

  var aBox = $(renderer.boxTemplate)
  .attr('id', renderer.hashFunc(firstUri))
  .attr('rel', firstUri)
  // TODO: move styles to external sheet where possible
  .css({
    left : left,
    top : top,
    opacity: 0,
    zIndex: 1
  })
  .animate({ opacity: 1}, 1000);

  renderer.context.append(aBox);

  return aBox;
};

/**
 * Generate "always on" tools
 */
// TODO: rename
LodLiveRenderer.prototype.generateNodeIcons = function(anchorBox) {
  var renderer = this;

  renderer.nodeIcons.forEach(function(opts) {
    var obj;

    if (opts.builtin) {
      // TODO: throw error if not exist
      obj = jQuery(_builtinTools[opts.builtin] || '<span class="no such builtin"></span>');
    } else {  // construct custom action box
      obj = $('<div class="actionBox custom"></div>').data('action-handler', opts.handler);
      $('<span></span>').addClass(opts.icon).attr('title',opts.title).appendTo(obj);
    }
    obj.appendTo(anchorBox);
  });
};

/**
 * Generate tools for a box
 */
LodLiveRenderer.prototype.generateTools = function(container, obj, inst) {
  var renderer = this;
  var tools = container.find('.lodlive-toolbox');

  if (!tools.length) {
    tools = $('<div class="lodlive-toolbox"></div>').hide();

    renderer.tools.forEach(function(toolConfig) {
      if (toolConfig.builtin) {
        toolConfig = _builtins[toolConfig.builtin];
      }

      // TODO: throw error
      if (!toolConfig) return;

      var icon = $('<span></span>').addClass(toolConfig.icon);

      $('<div></div>')
      .addClass('innerActionBox')
      .attr('title', utils.lang(toolConfig.title))
      .append(icon)
      .appendTo(tools)
      .on('click', function() {
        toolConfig.handler.call($(this), obj, inst);
      });
    });

    var toolWrapper = $('<div class="lodlive-toolbox-wrapper"></div>').append(tools);
    container.append(toolWrapper);
  }

  return tools;
};

/**
 * Gets all canvases containing lines related to `id`
 *
 * @param {String} id - the id of a subject or object node
 * @returns {Array<Object>} an array of canvas objects
 */
LodLiveRenderer.prototype.getRelatedCanvases = function(id) {
  var canvases = [];
  var subjectIds = this.refs.getSubjectRefs(id);

  // canvas holding lines from id
  canvases.push($('#line-' + id));

  // canvases holding lines to id
  subjectIds.forEach(function(subjectId) {
    canvases.push($('#line-' + subjectId));
  });

  return canvases;
};

/**
 * Clear all lines related to `id`, or clear all canvases
 *
 * @param {String} [id] - the id of a subject or object node
 * @param {Array<Object>} [canvases] - an array of canvas objects
 */
LodLiveRenderer.prototype.clearLines = function(arg) {
  var canvases;

  if (Array.isArray(arg)) {
    canvases = arg;
  } else {
    canvases = this.getRelatedCanvases(arg);
  }

  canvases.forEach(function(canvas) {
    canvas.clearCanvas();
  });
};

/**
 * Gets all node pairs related to `id`
 *
 * @param {String} id - the id of a subject or object node
 * @param {Boolean} excludeSelf - exclude pairs that include the identified node (default `false`)
 * @returns {Array<Object>} an array containing pairs of related nodes, and the canvas for their line
 */
LodLiveRenderer.prototype.getRelatedNodePairs = function(id, excludeSelf) {
  var renderer = this;
  var pairs = [];
  var node;
  var nodeCanvas;

  // get objects where id is the subject
  var objectIds = renderer.refs.getObjectRefs(id)

  // get subjects where id is the object
  var subjectIds = renderer.refs.getSubjectRefs(id);

  if (!excludeSelf) {
    node = renderer.context.find('#' + id);
    nodeCanvas = $('#line-' + id);

    objectIds.forEach(function(objectId) {
      pairs.push({
        from: node,
        to: renderer.context.find('#' + objectId),
        canvas: nodeCanvas
      });
    });
  }

  subjectIds.forEach(function(subjectId) {
    var nestedObjectIds = renderer.refs.getObjectRefs(subjectId);
    var subjectNode = renderer.context.find('#' + subjectId);
    var subjectCanvas = renderer.context.find('#line-' + subjectId);

    nestedObjectIds.forEach(function(objectId) {
      if (excludeSelf && objectId === id) {
        return;
      }

      pairs.push({
        from: subjectNode,
        to: renderer.context.find('#' + objectId),
        canvas: subjectCanvas
      });
    });
  });

  return pairs;
};

/**
 * Draw all lines related to `id`, or draw lines for all provided node pairs
 *
 * @param {String} [id] - the id of a subject or object node
 * @param {Array<Object>} [pairs] an array containing pairs of related nodes and their canvas
 */
LodLiveRenderer.prototype.drawLines = function(arg) {
  var renderer = this;
  var pairs;

  if (Array.isArray(arg)) {
    pairs = arg;
  } else {
    pairs = renderer.getRelatedNodePairs(arg);
  }

  pairs.forEach(function(pair) {
    renderer.drawLine(pair.from, pair.to, pair.canvas);
  });
};

/**
 * Draws a line from `from` to `to`, on `canvas`
 *
 * @param {Object} from - jQuery node
 * @param {Object} to - jQuery node
 * @param {Object} [canvas] - jQuery canvas node
 * @param {String} [propertyName] - the predicates from which to build the line label
 */
LodLiveRenderer.prototype.drawLine = function(from, to, canvas, propertyName) {
  var renderer = this;
  var pos1 = from.position();
  var pos2 = to.position();
  var fromId = from.attr('id');
  var toId = to.attr('id');

  if (!canvas) {
    canvas = $('#line-' + fromId);
  }

  if (!canvas.length) {
    canvas = $('<canvas></canvas>')
    .attr('height', renderer.context.height())
    .attr('width', renderer.context.width())
    .attr('id', 'line-' + fromId)
    .css({
      position: 'absolute',
      top: 0,
      left: 0,
      zIndex: '0'
    });

    canvas.data().lines = {};

    renderer.context.append(canvas);
  }

  // TODO: just build the label directly, skip the data-propertyName-{ID} attribute
  if (propertyName && !canvas.data('propertyName-' + toId)) {
    canvas.attr('data-propertyName-' + toId, propertyName);
  }

  if (!canvas.data().lines[toId]) {
    canvas.data().lines[toId] = {};
  }

  var line = canvas.data().lines[toId];

  var lineStyle = line.lineStyle || 'standardLine';
  var label = line.label;
  var labelArray;

  if (!label) {
    labelArray = canvas.attr('data-propertyName-' + toId).split(/\|/);

    label = labelArray.map(function(labelPart) {
      labelPart = $.trim(labelPart);

      if (renderer.arrows[ labelPart ]) {
        lineStyle = renderer.arrows[ labelPart ] + 'Line';
      }

      return utils.shortenKey(labelPart);
    })
    // deduplicate
    .filter(function(value, index, self) {
      return self.indexOf(value) === index;
    })
    .join(', ');

    line.label = label;
    line.lineStyle = lineStyle;
  }

  var x1 = pos1.left + from.width() / 2;
  var y1 = pos1.top + from.height() / 2;
  var x2 = pos2.left + to.width() / 2;
  var y2 = pos2.top + to.height() / 2;

  if (lineStyle === 'isSameAsLine') {
    renderer.isSameAsLine(label, x1, y1, x2, y2, canvas, toId);
  } else {
    renderer.standardLine(label, x1, y1, x2, y2, canvas, toId);
  }
};

/**
 *  Draws a line
 */
LodLiveRenderer.prototype.standardLine = function(label, x1, y1, x2, y2, canvas, toId) {

  // eseguo i calcoli e scrivo la riga di connessione tra i cerchi
  var lineangle = (Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI) + 180;
  var x2bis = x1 - Math.sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1)) + 60;
  //canvas.detectPixelRatio();
  canvas.rotateCanvas({
    rotate : lineangle,
    x : x1,
    y : y1
  }).drawLine({
    strokeStyle : '#fff',
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
  canvas.drawText({// inserisco l'etichetta
    fillStyle : '#606060',
    strokeStyle : '#606060',
    x : (x2bis + x1 + ((x1 + 60) > x2 ? -60 : +60)) / 2,
    y : (y1 + y1 - ((x1 + 60) > x2 ? 18 : -18)) / 2,
    text : label ,
    align : 'center',
    strokeWidth : 0.01,
    fontSize : 11,
    fontFamily : '"Open Sans",Verdana'
  }).restoreCanvas().restoreCanvas();
  //TODO:  why is this called twice?

  // ed inserisco la freccia per determinarne il verso della
  // relazione
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
    strokeStyle : '#fff',
    strokeWidth : 1,
    x1 : fromx,
    y1 : fromy,
    x2 : botx,
    y2 : boty
  });
  canvas.drawLine({
    strokeStyle : '#fff',
    strokeWidth : 1,
    x1 : fromx,
    y1 : fromy,
    x2 : topx,
    y2 : topy
  });
};

/**
 * Draws a line somewhat differently, apparently
 */
LodLiveRenderer.prototype.isSameAsLine = function(label, x1, y1, x2, y2, canvas, toId) {

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
    strokeStyle : '#000',
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
    fillStyle : '#000',
    strokeStyle : '#000',
    x : (x2bis + x1 + ((x1 + 60) > x2 ? -60 : +60)) / 2,
    y : (y1 + y1 - ((x1 + 60) > x2 ? 18 : -18)) / 2,
    text : ((x1 + 60) > x2 ? ' « ' : '') + label + ((x1 + 60) > x2 ? '' : ' » '),
    align : 'center',
    strokeWidth : 0.01,
    fontSize : 11,
    fontFamily : '"Open Sans",Verdana'
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
    strokeStyle : '#000',
    strokeWidth : 1,
    x1 : fromx,
    y1 : fromy,
    x2 : botx,
    y2 : boty
  });
  canvas.drawLine({
    strokeStyle : '#000',
    strokeWidth : 1,
    x1 : fromx,
    y1 : fromy,
    x2 : topx,
    y2 : topy
  });
};

LodLiveRenderer.prototype.msg = function(msg, action, type, endpoint, inverse) {
  var renderer = this;
  var msgPanel = renderer.container.find('.lodlive-message-container')
  var msgs;

  if (!msg) msg = '';

  switch(action) {
    case 'init':
      if (!msgPanel.length) {
        msgPanel = $('<div class="lodlive-message-container"></div>');
        renderer.container.append(msgPanel);
      }
      break;

    default:
      msgPanel.hide();
  }

  msgPanel.empty();
  msg = msg.replace(/http:\/\/.+~~/g, '');
  msg = msg.replace(/nodeID:\/\/.+~~/g, '');
  msg = msg.replace(/_:\/\/.+~~/g, '');
  msg = utils.breakLines(msg);
  msg = msg.replace(/\|/g, '<br />');

  msgs = msg.split(' \n ');

  if (type === 'fullInfo') {
    msgPanel.append('<div class="endpoint">' + endpoint + '</div>');
    // why 2?
    if (msgs.length === 2) {
      msgPanel.append('<div class="from upperline">' + (msgs[0].length > 200 ? msgs[0].substring(0, 200) + '...' : msgs[0]) + '</div>');
      msgPanel.append('<div class="from upperline">'+ msgs[1] + '</div>');
    } else {
      msgPanel.append('<div class="from upperline">' + msgs[0] + '</div>');
    }
  } else {
    if (msgs.length === 2) {
      msgPanel.append('<div class="from">' + msgs[0] + '</div>');
      if (inverse) {
        msgPanel.append('<div class="separ inverse sprite"></div>');
      } else {
        msgPanel.append('<div class="separ sprite"></div>');
      }

      msgPanel.append('<div class="from">' + msgs[1] + '</div>');
    } else {
      msgPanel.append('<div class="from">' + msgs[0] + '</div>');
    }
  }

  msgPanel.show();
};

LodLiveRenderer.prototype.errorBox = function(destBox) {
  var renderer = this;

  destBox.children('.box').addClass('errorBox');
  destBox.children('.box').html('');
  var jResult = $('<div class="boxTitle"><span>' + utils.lang('endpointNotAvailable') + '</span></div>');
  destBox.children('.box').append(jResult);
  destBox.children('.box').hover(function() {
    renderer.msg(utils.lang('endpointNotAvailableOrSLow'), 'show', 'fullInfo', destBox.attr('data-endpoint'));
  }, function() {
    renderer.msg(null, 'hide');
  });
};

LodLiveRenderer.prototype.init = function(container) {
  if (typeof container === 'string') {
    container = $(container);
  }
  if (!container.length) {
    throw new Error('LodLive: no container found');
  }

  // TODO: move styles to external sheet
  this.container = container.css('position', 'relative');
  this.context = $('<div class="lodlive-graph-context"></div>');

  var graphContainer = $('<div class="lodlive-graph-container"></div>');

  this.context.appendTo(this.container).wrap(graphContainer);
};

var rendererFactory = {
  create: function(arrows, tools, nodeIcons, refs) {
    return new LodLiveRenderer(arrows, tools, nodeIcons, refs);
  }
};


module.exports = rendererFactory;

// temporary, for testing
if (!window.LodLiveRenderer) {
  window.LodLiveRenderer = LodLiveRenderer;
}
if (!window.rendererFactory) {
  window.rendererFactory = rendererFactory;
}
