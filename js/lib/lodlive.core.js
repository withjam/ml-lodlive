/*
 *
 * lodLive 1.0
 * is developed by Diego Valerio Camarda, Silvia Mazzini and Alessandro Antonuccio
 *
 * Licensed under the MIT license
 *
 * plase tell us if you use it!
 *
 * geodimail@gmail.com
 *
 *  Heavily refactored by matt@mattpileggi.com to eliminate third-party dependencies and support multiple LodLive instances
 *
 */

(function($) {
  'use strict';

  var jwin = $(window), jbody = $(document.body);

  var DEFAULT_BOX_TEMPLATE = '<div class="boxWrapper lodlive-node defaultBoxTemplate"><div class="ll-node-anchor"></div><div class="lodlive-node-label box sprite"></div></div>';

  /**
   * Built-in tools
   */
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

  /* experimental renderer component */

  function LodLiveRenderer(arrows, tools) {
    this.arrows = arrows;
    this.tools = tools;
  }

  /**
   * Render a loading glyph
   *
   * @param {Element} dest - a jQuery element
   * @return {Function} a function to remove the loading glyph
   */
  LodLiveRenderer.prototype.loading = function loading(dest) {
    var target = dest.children('.box');
    var top = target.height() / 2 - 8;
    target.html(
      // TODO: issue #18
      // '<i class="fa fa-spinner fa-spin" style="margin-top:' + top + 'px;margin-left: 5px"/></i>'
      '<img style="margin-top:' + top + 'px" src="img/ajax-loader.gif"/>'
    );

    // console.log(dest)
    // console.log('loading')

    return function() {
      target.html('');
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
   * Generate tools for a box
   */
  LodLiveRenderer.prototype.generateTools = function(container, obj, inst) {
    var renderer = this;
    var tools = container.find('.lodlive-toolbox');

    if (!tools.length) {
      tools = $('<div class="lodlive-toolbox"></div>').hide();

      jQuery.each(renderer.tools, function() {
        // TODO: use param instead
        var toolConfig = this;
        var t;

        if (toolConfig.builtin) {
          toolConfig = _builtins[toolConfig.builtin];
        }

        if (!toolConfig) return;

        t = jQuery('<div class="innerActionBox" title="' + LodLiveUtils.lang(toolConfig.title) + '"><span class="' + toolConfig.icon + '"></span></div>');
        t.appendTo(tools).on('click', function() { toolConfig.handler.call($(this), obj, inst); });
      });

      var toolWrapper = $('<div class="lodlive-toolbox-wrapper"></div>').append(tools);
      container.append(toolWrapper);
    }

    return tools;
  };

  /**
   * Draws a line
   */
  LodLiveRenderer.prototype.drawaLine = function(from, to, propertyName) {
    var renderer = this;
    var start;
    var pos1 = from.position();
    var pos2 = to.position();
    var aCanvas = $('#line-' + from.attr('id'));
    // console.debug(new Date().getTime()+'moving - '+(new Date())+" -
    // #line-" +
    // from.attr("id") + "-" + to.attr("id"))
    if (aCanvas.length == 1) {
      if (propertyName) {
        aCanvas.attr('data-propertyName-' + to.attr('id'), propertyName);
      }
      renderer.processDraw(pos1.left + from.width() / 2, pos1.top + from.height() / 2, pos2.left + to.width() / 2, pos2.top + to.height() / 2, aCanvas, to.attr('id'));
    } else {
      aCanvas = $('<canvas data-propertyName-' + to.attr('id') + '="' + propertyName + '" height="' + renderer.context.height() + '" width="' + renderer.context.width() + '" id="line-' + from.attr('id') + '"></canvas>');
      renderer.context.append(aCanvas);
      aCanvas.css({
        'position' : 'absolute',
        'zIndex' : '0',
        'top' : 0,
        'left' : 0
      });
      renderer.processDraw(pos1.left + from.width() / 2, pos1.top + from.height() / 2, pos2.left + to.width() / 2, pos2.top + to.height() / 2, aCanvas, to.attr('id'));
    }
  };

  LodLiveRenderer.prototype.processDraw = function(x1, y1, x2, y2, canvas, toId) {
    var renderer = this;
    var start;

    // recupero il nome della proprieta'
    var label = '';

    var lineStyle = 'standardLine';
    //FIXME:  don't use IDs
    if (renderer.context.find('#' + toId).length > 0) {

      label = canvas.attr('data-propertyName-' + toId);

      // TODO: literal regexp?
      var labeArray = label.split('\|');

      label = '\n';

      for (var o = 0; o < labeArray.length; o++) {

        if (renderer.arrows[$.trim(labeArray[o])]) {
          lineStyle = renderer.arrows[$.trim(labeArray[o])] + 'Line';
        }

        var shortKey = LodLive.shortenKey(labeArray[o]);
        var lastHash = shortKey.lastIndexOf('#');
        var lastSlash = shortKey.lastIndexOf('/');

        if (label.indexOf('\n' + shortKey + '\n') == -1) {
          label += shortKey + '\n';
        }
      }
    }
    //if (lineStyle === 'standardLine') { it appears they all end up back here anyway
    if (lineStyle !== 'isSameAsLine') {

      renderer.standardLine(label, x1, y1, x2, y2, canvas, toId);

    } else {
      //TODO: doesn't make sense to have these live in different files.  Should make line drawers an extensible interface
      renderer.customLines(renderer.context, lineStyle, label, x1, y1, x2, y2, canvas, toId);
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

  /**
   *  Invokes a line drawing method
   */
  LodLiveRenderer.prototype.customLines = function(context, method) {
    console.log('customLines', method);
    if (this[method]) {
      return this[method].apply(this, Array.prototype.slice.call(arguments, 2));
    }
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
    msg = LodLiveUtils.breakLines(msg);
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
    var jResult = $('<div class="boxTitle"><span>' + LodLiveUtils.lang('endpointNotAvailable') + '</span></div>');
    destBox.children('.box').append(jResult);
    renderer.hover(destBox.children('.box'), function() {
      renderer.msg(LodLiveUtils.lang('endpointNotAvailableOrSLow'), 'show', 'fullInfo', destBox.attr('data-endpoint'));
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
    // TODO:
    // renderer.enableDrag();
  };

  var rendererFactory = {
    create: function(arrows, tools) {
      return new LodLiveRenderer(arrows, tools);
    }
  };

  // temporary, for testing
  if (!window.LodLiveRenderer) {
    window.LodLiveRenderer = LodLiveRenderer;
  }

  /* experimental HTTP Client component */

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
      // console.log('httpClientFactory create')

      // TODO: client side proxying based on the profile??

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
        // console.log('httpClient')

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
      };
    }
  };

  // temporary, for testing
  if (!window.httpClientFactory) {
    window.httpClientFactory = httpClientFactory;
  }

  var sparqlClientFactory = {
    // sparqlProfile = profile.connections['http:'].sparql
    // defaultSparqlProfile: passed in for now, but should be a static reference ...
    create: function(sparqlProfile, defaultSparqlProfile, httpClient) {

      function getQuery(axis, iri) {
        var pattern = sparqlProfile && sparqlProfile[axis] ?
                      sparqlProfile[axis] :
                      defaultSparqlProfile[axis];

        // ~~ === bnode; TODO: remove
        return pattern.replace(/\{URI\}/ig, iri.replace(/^.*~~/, ''));
      }

      function parseResults(bindings) {
        var info = { uris: [], bnodes: [], values: [] };

        $.each(bindings, function(key, value) {
          var newVal = {};
          newVal[value.property.value] = value.object.value;
          if (value.object.type === 'uri') {
            info.uris.push(newVal);
          } else if (value.object.type === 'bnode') {
            info.bnodes.push(newVal);
          } else {
            info.values.push(newVal);
          }
        });

        return info;
      }

      return {
        document: function(iri, callbacks) {
          var axis = 'document';
          var params = { query: getQuery(axis, iri) };
          // setTimeout(function() {
          //   callbacks.error(new Error('blah'))
          // }, 1)

          return httpClient(params, {
            beforeSend: callbacks.beforeSend,
            error: callbacks.error,
            success : function(json) {
              var info;

              if ( !(json && json.results && json.results.bindings) ) {
                console.error(json);
                return callbacks.error(new Error('malformed results'));
              }

              info = parseResults(json.results.bindings);
              callbacks.success(info);
            }
          });
        },
        bnode: function(iri, callbacks) {
          var axis = 'bnode';
          return httpClient({ query: getQuery(axis, iri) }, callbacks);
        },
        documentUri: function(iri, callbacks) {
          var axis = 'documentUri';
          var params = { query: getQuery(axis, iri) };

          return httpClient(params, {
            beforeSend: callbacks.beforeSend,
            error: callbacks.error,
            success : function(json) {
              var info;

              if ( !(json && json.results && json.results.bindings) ) {
                console.error(json);
                return callbacks.error(new Error('malformed results'));
              }

              info = parseResults(json.results.bindings);
              callbacks.success(info);
            }
          });
        },
        inverse: function(iri, callbacks) {
          var axis = 'inverse';
          var params = { query: getQuery(axis, iri) };

          return httpClient(params, {
            beforeSend: callbacks.beforeSend,
            error: callbacks.error,
            success : function(json) {
              var info;

              if ( !(json && json.results && json.results.bindings) ) {
                console.error(json);
                return callbacks.error(new Error('malformed results'));
              }

              info = parseResults(json.results.bindings);
              callbacks.success(info);
            }
          });
        },
        inverseSameAs: function(iri, callbacks) {
          var axis = 'inverseSameAs';
          return httpClient({ query: getQuery(axis, iri) }, callbacks);
        }
      };
    }
  };

  // temporary, for testing
  if (!window.sparqlClientFactory) {
    window.sparqlClientFactory = sparqlClientFactory;
  }

  /** LodLiveProfile constructor - Not sure this is even necessary, a basic object should suffice - I don't think it adds any features or logic
    * @Class LodLiveProfile
    */
  function LodLiveProfile() {

  }

  //utility functions - might belong somewhere else but here for now so I can see them
  LodLive.shortenKey = function(str) {
    str = jQuery.trim(str);
    var lastSlash = str.lastIndexOf('/'), lastHash = str.lastIndexOf('#');
    return lastSlash > lastHash ? str.substring(lastSlash + 1) : str.substring(lastHash + 1);
  };

  function enableDrag(instance) {

    // watch mouse move events on the container to move anything being dragged
    instance.container.on('mousemove', function(event) {
      var cx, cy, scrx, scry, lastx, lasty, diffx, diffy;
      cx = event.clientX;
      cy = event.clientY;
      lastx = instance.ll_lastx;
      lasty = instance.ll_lasty;
      diffx = lastx - cx;
      diffy = lasty - cy;
      instance.ll_lasty = cy;
      instance.ll_lastx = cx;
      scrx = instance.context.parent().scrollLeft();
      scry = instance.context.parent().scrollTop();
      if (instance.ll_dragging) {
        // dragging a node
        if (!instance.ll_isdragging) {
          var divid = instance.ll_dragging.attr('id');
          instance.ll_isdragging = true;
          // just started the drag
          // remove any lines connected to this node
          // TODO: find a better way to handle lines
          $('#line-' + divid).clearCanvas();
          var generatedRev = instance.storeIds['rev' + divid];
          // find all the generated lines
          if (generatedRev) {
            // this finds all lines each drag start, not my favorite but fix later
            for (var a = 0; a < generatedRev.length; a++) {
              var generated = instance.storeIds['gen' + generatedRev[a]];
              $('#line-' + generatedRev[a]).clearCanvas();
            }
          }
        }
        instance.ll_dragging.css({ left: cx + scrx - instance.ll_dragoffx, top: cy + scry - instance.ll_dragoffy });
      } else if (instance.ll_panning) {
        instance.context.parent().scrollLeft( scrx + diffx);
        instance.context.parent().scrollTop( scry + diffy);
      }
      // do nothing otherwise
    });

    instance.container.on('mousedown', '.lodlive-node', function(event) {
      var node = jQuery(this), divid = node.attr('id');
      // mark the node as being dragged using event-delegation
      instance.ll_dragging = node;
      instance.ll_panning = false;
      // store offset of event so node moves properly
      instance.ll_dragoffx = event.offsetX;
      instance.ll_dragoffy = event.offsetY;
      event.stopPropagation();
      event.preventDefault();
    });
    instance.container.on('mousedown', function(event) {
      instance.ll_dragging = false;
      instance.ll_panning = true;
      event.stopPropagation();
      event.preventDefault();
    });
    function cancelDrag() {
        if (instance.ll_dragging) {
          // redraw the lines TODO: figure out a better way to handle lines
          instance.drawAllLines(instance.ll_dragging);
        }
        instance.ll_isdragging = false;
        instance.ll_dragging = false;
        instance.ll_panning = false;
    }
    instance.container.on('mouseup', cancelDrag);
    jQuery(document).on('keydown', function(event) {
      // console.log('keypress', event);
      if (event.keyCode === 27) {
        // esc key
        cancelDrag();
      }
    });

  }

  // instance methods

  /**
    * Initializes a new LodLive instance based on the given context (dom element) and possible options
    *
    * @param {Element|string} container jQuery element or string, if a string jQuery will use it as a selector to find the element
    * @param {object=} options optional hash of options
    */
  function LodLive(container,options) {
    this.container = container;
    this.options = options;
    this.UI = options.UI || {};
    this.debugOn = options.debugOn && window.console; // don't debug if there is no console

    // allow them to override the docInfo function
    if (this.UI.docInfo) {
      this.docInfo = this.UI.docInfo;
    }
    if (this.UI.nodeHover) {
      this.msg = this.UI.nodeHover;
    }

    // simple MD5 implementation to eliminate dependencies
    // can still pass in MD5 (or some other algorithm) if desired
    this.hashFunc = this.options.hashFunc || LodLiveUtils.hashFunc;

    // TODO: move to renderer
    this.boxTemplate =  this.options.boxTemplate || DEFAULT_BOX_TEMPLATE;

    var httpClient = httpClientFactory.create(
      this.options.connection['http:'].endpoint,
      this.options.endpoints.all,
      this.options.connection['http:'].accepts,
      this.getAjaxDataType()
    );

    this.sparqlClient = sparqlClientFactory.create(
      this.options.connection['http:'].sparql,
      this.options.default.sparql,
      httpClient
    );

    this.renderer = rendererFactory.create(
      this.options.arrows,
      this.options.UI.tools
    );

    this.renderer.init(container);
    this.container = this.renderer.container;
    this.context = this.renderer.context;

    // TODO: move to renderer.init()
    enableDrag(this);

    // temporary, need access from both components
    this.renderer.hashFunc = this.hashFunc;
    this.renderer.boxTemplate = this.boxTemplate
  }

  LodLive.prototype.init = function(firstUri) {
    // instance data
    this.imagesMap = {};
    this.mapsMap = {};
    this.infoPanelMap = {};
    this.connection = {};
    this.innerPageMap = {};
    this.storeIds = {};
    this.ignoreBnodes = this.UI.ignoreBnodes;

    // TODO: look these up on the context object as data-lodlive-xxxx attributes
    // TODO: set these by default on the instance via the options -
    // consider putting them under 'flags' or some other property

    // TODO: where appropriate, replace magic number 25
    // this.relationsLimit = 25;

    // TODO: this method is missing; implement it, or remove flag
    // this.doStats = false

    // TODO: retrieve these from the profile
    this.doInverse = true;
    this.doAutoExpand = true;
    this.doAutoSameas = true;

    // explicitly disabled, for now
    this.doCollectImages = false;
    this.doDrawMap = false;

    this.classMap = {
      // TODO: let CSS drive color
      counter : Math.floor(Math.random() * 13) + 1
    };

    var firstBox = this.renderer.firstBox(firstUri);
    this.openDoc(firstUri, firstBox);

    // TODO: do this in renderer.init()?
    this.renderer.msg('', 'init');
  };

  /**
   * Gets the Ids of all active objects with references from `subject`
   *
   * @param {String} subject - the Id of an active subject
   * @return {Array<String>} object Ids
   */
  LodLive.prototype.getObjectRefs = function(subject) {
    return this.storeIds['gen' + subject] || [];
  };

  /**
   * Sets `objects` as the list of references from `subject`
   *
   * @param {String} subject - the Id of an active subject
   * @param {Array<String>} objects - the Ids of `subject`'s objects
   */
  LodLive.prototype.setObjectRefs = function(subject, objects) {
    this.storeIds['gen' + subject] = objects;
  }

  /**
   * Adds an active object reference from `subject`
   *
   * @param {String} subject - the Id of an active subject
   * @param {String} object - the Id of an object of `subject`
   */
  LodLive.prototype.addObjectRef = function(subject, object) {
    var objects = this.getObjectRefs(subject);

    if (objects.indexOf(object) === -1) {
      objects.push(object);
    }

    this.setObjectRefs(subject, objects);
  };

  /**
   * Gets the Ids of all active subjects with references to `object`
   *
   * @param {String} object - the Id of an active object
   * @return {Array<String>} subject Ids
   */
  LodLive.prototype.getSubjectRefs = function(object) {
    return this.storeIds['rev' + object] || [];
  };

  /**
   * Sets `subjects` as the list of references from `object`
   *
   * @param {String} subjects - the Ids of `object`'s subjects
   * @param {Array<String>} object - the Id of an active object
   */
  LodLive.prototype.setSubjectRefs = function(object, subjects) {
    this.storeIds['rev' + object] = subjects;
  }

  /**
   * Adds an active subject reference to `object`
   *
   * @param {String} object - the Id of an active object
   * @param {String} subject - the Id of a subject of `object`
   */
  LodLive.prototype.addSubjectRef = function(object, subject) {
    var subjects = this.getSubjectRefs(object);

    if (subjects.indexOf(subject) === -1) {
      subjects.push(subject);
    }

    this.setSubjectRefs(object, subjects);
  };

  // TODO: remove unnecessary param
  LodLive.prototype.autoExpand = function(obj) {
    var inst = this;
    var expandables = [];

    var start;
    if (inst.debugOn) {
      start = new Date().getTime();
    }

    function accumulateExpandables() {
      var box = $(this);
      var aId = box.attr('relmd5');

      // if a subject box exists
      if (inst.context.children('#' + aId).length) {
        expandables.push(box);
      }
    }

    // accumulate expandable property boxes, including hidden ones
    // TODO: deconstruct innerPageMap
    $.each(inst.innerPageMap, function(key, element) {
      var closed = element.children('.relatedBox:not([class*=exploded])');

      // attach .innerPage, if necessary
      if (closed.length && !element.parent().length) {
        inst.context.append(element);
      }

      closed.each(accumulateExpandables);
    });

    // accumulate expandable property boxes
    inst.context.find('.relatedBox:not([class*=exploded])').each(accumulateExpandables);

    // TODO: object identity doesn't work with jquery; group by id?
    // expandables = expandables.filter(function(value, index, self) {
    //   return self.indexOf(value) === index;
    // });

    expandables.forEach(function(box) {
      box.click();
    });

    inst.context.children('.innerPage').detach();

    if (inst.debugOn) {
      console.debug((new Date().getTime() - start) + '  autoExpand ');
    }
  };

  LodLive.prototype.addNewDoc = function(originalCircle, ele) {
    var inst = this;
    var exist = true;
    var fromInverse = null;

    var rel = ele.attr('rel');
    var aId = ele.attr('relmd5');
    var circleId = ele.data('circleid');
    var propertyName = ele.data('property');
    var isInverse = ele.is('.inverse');

    // TODO: rename for clarity ?
    // var subjectId = circleId; var objectId = aId;

    if (!isInverse) {
      // TODO: add explaination for early return
      if (inst.getObjectRefs(circleId).indexOf(aId) > -1) {
        return;
      }

      inst.addObjectRef(circleId, aId);
      inst.addSubjectRef(aId, circleId);
    }

    var newObj = inst.context.find('#' + aId);

    // verifico se esistono box rappresentativi dello stesso documento
    // nella pagina
    if (!newObj.length) {
      exist = false;
      newObj = $(inst.boxTemplate)
      .attr('id', aId)
      .attr('rel', rel);
    }

    // nascondo l'oggetto del click e carico la risorsa successiva
    ele.hide();

    if (!exist) {
      var pos = parseInt(ele.attr('data-circlePos'), 10);
      var parts = parseInt(ele.attr('data-circleParts'), 10);

      var radiusFactor = parts > 10 ?
                         2 + (pos % 2) :
                         5 / 2;

      var chordsListExpand = inst.circleChords(
        originalCircle.width() * radiusFactor,
        parts,
        originalCircle.position().left + originalCircle.width() / 2,
        originalCircle.position().top + originalCircle.height() / 2,
        null,
        pos
      );

      inst.context.append(newObj);
      // FIXME: eliminate inline CSS where possible
      newObj.css({
        left : (chordsListExpand[0][0] - newObj.height() / 2),
        top : (chordsListExpand[0][1] - newObj.width() / 2),
        opacity : 1,
        zIndex : 99
      });

      if (isInverse) {
        fromInverse = 'div[data-property="' + propertyName + '"][rel="' + rel + '"]';
      }

      inst.openDoc(rel, newObj, fromInverse);
    }

    if (!isInverse) {
      inst.renderer.drawaLine(originalCircle, newObj, propertyName);
    }
  };

  LodLive.prototype.removeDoc = function(obj, callback) {
    var inst = this;
    var isRoot = inst.context.find('.lodlive-node').length == 1;
    if (isRoot) {
        alert('Cannot Remove Only Box');
        return;
    }
    var start;
    if (inst.debugOn) {
      start = new Date().getTime();
    }

    inst.context.find('.lodlive-toolbox').remove(); // why remove and not hide?

    var id = obj.attr('id');
    inst.context.find('#line-' + id).clearCanvas();

    var generatedRev = inst.storeIds['rev' + id];
    if (generatedRev) {
      for (var a = 0; a < generatedRev.length; a++) {
        inst.context.find('#line-' + generatedRev[a]).clearCanvas();
      }
    }
    inst.docInfo();
    var cp = inst.context.find('.lodLiveControlPanel');

    if (inst.doCollectImages) {
      var imagesMap = inst.imagesMap;
      if (imagesMap[id]) {
        delete imagesMap[id];
        inst.updateImagePanel(cp);
        cp.find('a[class*=img-' + id + ']').remove();
      }
    }

    if (inst.doDrawMap) {
      var mapsMap = inst.mapsMap;
      if (mapsMap[id]) {
        delete mapsMap[id];
        inst.updateMapPanel(cp);
      }
    }

    obj.fadeOut('normal', null, function() {
      obj.remove();
      $.each(inst.innerPageMap, function(key, element) {
        if (element.children('.' + id).length) {
          var keyEle = inst.context.find('#' + key);
          keyEle.append(element);
          var lastClick = keyEle.find('.lastClick').attr('rel');
          if (!keyEle.children('.innerPage').children('.' + lastClick).length) {
            //TODO: again, why detaching?
            keyEle.children('.innerPage').detach();
          }
        }
      });

      inst.context.find('div[relmd5=' + id + ']').each(function() {
        var found = $(this);
        found.show();
        found.removeClass('exploded');
      });

      var generated = inst.storeIds['gen' + id];
      var generatedRev = inst.storeIds['rev' + id];
      var int, int2, generatedBy;

      if (generatedRev) {

        for (int = 0; int < generatedRev.length; int++) {

          generatedBy = inst.storeIds['gen' + generatedRev[int]];

          if (generatedBy) {

            for (int2 = 0; int2 < generatedBy.length; int2++) {

              if (generatedBy[int2] === id) {

                generatedBy.splice(int2, 1);

              }
            }
          }
          // don't need to set it again since it modifies the same object
          // inst.storeIds['gen' + generatedRev[int]] = generatedBy;
        }
      }
      // really wish there were comments here, why these two loops?
      if (generated) {

        for (int = 0; int < generated.length; int++) {

          generatedBy = inst.storeIds['rev' + generated[int]];

          if (generatedBy) {
            for (int2 = 0; int2 < generatedBy.length; int2++) {
              if (generatedBy[int2] == id) {
                generatedBy.splice(int2, 1);
              }
            }
          }
          // don't need to set it again since it modifies the same object
          // inst.storeIds['rev' + generated[int] = generatedBy;
        }
      }

      generatedRev = inst.storeIds['rev' +  id];
      //TODO: three loops? look for a way to simplify
      if (generatedRev) {

        for (int = 0; int < generatedRev.length; int++) {

          generated = inst.storeIds['gen' + generatedRev[int]];
          if (generated) {

            for (int2 = 0; int2 < generated.length; int2++) {

              inst.renderer.drawaLine(inst.context.find('#' + generatedRev[int]), inst.context.find('#' + generated[int2]));

            }
          }
        }
      }
      delete inst.storeIds['rev' + id];
      delete inst.storeIds['gen' + id];

    });

    if (inst.debugOn) {
      console.debug((new Date().getTime() - start) + '  removeDoc ');
    }
  };

  LodLive.prototype.addClick = function(obj, callback) {
    var inst = this;
    var start;
    if (inst.debugOn) {
      start = new Date().getTime();
    }

    // per ogni nuova risorsa collegata al documento corrente imposto le
    // azioni "onclick"

    obj.find('.relatedBox').each(function() {
      var box = $(this);
      box.attr('relmd5', inst.hashFunc(box.attr('rel')));
      box.click(function(evt) {
        box.addClass('exploded');
        inst.addNewDoc(obj, box);
        evt.stopPropagation();
      });

      inst.renderer.hover(box, function() {
        inst.renderer.msg(box.data('title'), 'show', null, null, box.is('.inverse'));
      });
    });

    obj.find('.groupedRelatedBox').each(function() {
      var box = $(this);
      box.click(function() {
        if (box.data('show')) {
          box.data('show', false);
          inst.docInfo();
          box.removeClass('lastClick');
          obj.find('.' + box.attr('rel')).fadeOut('fast');
          box.fadeTo('fast', 1);
          obj.children('.innerPage').detach();
        } else {
          box.data('show', true);
          obj.append(inst.innerPageMap[obj.attr('id')]);
          inst.docInfo();
          obj.find('.lastClick').removeClass('lastClick').click();
          if (!obj.children('.innerPage').length) {
            obj.append(inst.innerPageMap[obj.attr('id')]);
          }
          box.addClass('lastClick');
          obj.find('.' + box.attr('rel') + ':not([class*=exploded])').fadeIn('fast');
          box.fadeTo('fast', 0.3);
        }
      });

      inst.renderer.hover(box, function() {
        inst.renderer.msg(box.attr('data-title'), 'show', null, null, box.is('.inverse'));
      });
    });

    inst.innerPageMap[obj.attr('id')] = obj.children('.innerPage');
    obj.children('.innerPage').detach();
    // aggiungo le azioni dei tools
    obj.on('click', '.actionBox', function(evt) {
      var el = $(this), handler = el.data('action-handler'), rel = el.attr('rel');
      if (handler) {
        handler.call(el, obj, inst, evt);
      } else {
        switch(rel) {
          case 'docInfo':  inst.docInfo(obj); break;
          case 'tools': inst.renderer.generateTools(el, obj, inst).fadeToggle('fast'); break;
        }
      }
    });

    //FIXME: why do we need a callback if not async?
    if (callback) {
      callback();
    }

    if (inst.debugOn) {
      console.debug((new Date().getTime() - start) + '  addClick ');
    }
  };

  /**
    * Default function for showing info on a selected node.  Simply opens a panel that displays it's properties.  Calling it without an object will close it.
    * @param {Object=} obj a jquery wrapped DOM element that is a node, or null.  If null is passed then it will close any open doc info panel
   **/
  LodLive.prototype.docInfo = function(obj) {
    var inst = this;
    var docInfo = inst.container.find('.lodlive-docinfo');
    var URI;

    if (obj == null || ((URI = obj.attr('rel')) && docInfo.is('[rel="'+ URI + '"]'))) {
      console.log('hiding docInfo');
      docInfo.fadeOut('fast').removeAttr('rel');
      return;
    }

    if (!docInfo.length) {
      docInfo = $('<div class="lodlive-docinfo" rel="' + URI + '"></div>');
      inst.container.append(docInfo);
    }

    // duplicated code ...
    // var URI = obj.attr('rel');
    docInfo.attr('rel', URI);

    inst.sparqlClient.document(URI, {
      success : function(info) {
        docInfo.empty().fadeIn();
        inst.formatDoc(docInfo, info.values, info.uris, info.bnodes, URI);
      },
      error : function(e, b, v) {
        var values = [{
          'http://system/msg' : 'Could not find document: ' + URI
        }];
        inst.formatDoc(docInfo, values, [], [], URI);
      }
    });
  };

  LodLive.prototype.drawAllLines = function(obj) {

    var inst = this, id = obj.attr('id'), a;

    var generated = inst.storeIds['gen' + id];
    var generatedRev = inst.storeIds['rev' + id];
    // elimino la riga se giÃ  presente (in caso di
    // spostamento di un
    // box)
    inst.context.find('#line-' + id).clearCanvas();
    if (generated) {
      for (a = 0; a < generated.length; a++) {
        inst.renderer.drawaLine(obj, inst.context.find('#' + generated[a]));
      }
    }

    if (generatedRev) {
      for (a = 0; a < generatedRev.length; a++) {
        generated = inst.storeIds['gen' + generatedRev[a]];
        $('#line-' + generatedRev[a]).clearCanvas();
        if (generated) {
          for (var a2 = 0; a2 < generated.length; a2++) {
            inst.renderer.drawaLine(inst.context.find('#' + generatedRev[a]), inst.context.find('#' + generated[a2]));
          }
        }
      }
    }

  };

  LodLive.prototype.formatDoc = function(destBox, values, uris, bnodes, URI) {
    var inst = this;

    var start;
    if (inst.debugOn) {
      console.debug('formatDoc ' + 0);
      start = new Date().getTime();
    }

    //TODO:  Some of these seem like they should be Utils functions instead of on the instance, not sure yet
    // recupero il doctype per caricare le configurazioni specifiche
    var docType = inst.getJsonValue(uris, 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'default');
    // carico le configurazioni relative allo stile
    destBox.addClass(inst.getProperty('document', 'className', docType));
    // ed ai path degli oggetti di tipo immagine
    var images = inst.getProperty('images', 'properties', docType);
    // ed ai path dei link esterni
    var weblinks = inst.getProperty('weblinks', 'properties', docType);
    // ed eventuali configurazioni delle proprietÃ  da mostrare
    // TODO: fare in modo che sia sempre possibile mettere il dominio come fallback
    var propertiesMapper = inst.getProperty('document', 'propertiesMapper', URI.replace(/(http:\/\/[^\/]+\/).+/, '$1'));

    // se la proprieta' e' stata scritta come stringa la trasformo in un
    // array
    if (!Array.isArray(images)) {
      images = [images];
    }
    if (!Array.isArray(weblinks)) {
      weblinks = [weblinks];
    }

    var result = '<div></div>';
    var jResult = $(result);
    // destBox.append(jResult);

    // estraggo i contenuti
    var contents = [];
    $.each(values, function(key, value) {
      for (var akey in value) {
        var newVal = {};
        newVal[akey] = value[akey];
        contents.push(newVal);
      }
    });

    if (inst.debugOn) {
      console.debug('formatDoc ' + 1);
    }
    // calcolo le uri e le url dei documenti correlati
    var connectedImages = [];
    var connectedWeblinks = [];
    var types = [];

    $.each(uris, function(key, value) {
      for (var akey in value) {
        var newVal = {};
        newVal[akey] = value[akey];
        // escludo la definizione della classe, le proprieta'
        // relative alle immagini ed ai link web
        if (akey != 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type') {
          if ($.inArray(akey, images) != -1) {
            connectedImages.push(newVal);
          } else if ($.inArray(akey, weblinks) != -1) {
            connectedWeblinks.push(newVal);
          }
        } else {
          types.push(unescape(value[akey]));
        }
      }
    });

    if (inst.debugOn) {
      console.debug('formatDoc ' + 2);
    }

    // aggiungo al box le immagini correlate
    var imagesj = null;
    if (connectedImages.length > 0) {
      imagesj = $('<div class="section" style="height:80px"></div>');
      $.each(connectedImages, function(key, value) {
        for (var akey in value) {
          imagesj.append('<a class="relatedImage" href="' + unescape(value[akey]) + '"><img src="' + unescape(value[akey]) + '"/></a>');
        }
      });
    }

    if (inst.debugOn) {
      console.debug('formatDoc ' + 3);
    }

    var webLinkResult = null;
    // aggiungo al box i link esterni correlati
    if (connectedWeblinks.length > 0) {
      webLinkResult = '<div class="section"><ul style="padding:0;margin:0;display:block;overflow:hidden;tex-overflow:ellipses">';
      $.each(connectedWeblinks, function(key, value) {
        for (var akey in value) {
          webLinkResult += '<li><a class="relatedLink" target="_blank" data-title="' + akey + ' \n ' + unescape(value[akey]) + '" href="' + unescape(value[akey]) + '">' + unescape(value[akey]) + '</a></li>';
        }
      });
      webLinkResult += '</ul></div>';
      // jContents.append(webLinkResult);
    }

    if (inst.debugOn) {
      console.debug('formatDoc ' + 4);
    }
    // aggiungo al box le informazioni descrittive della risorsa
    var jContents = $('<div></div>');

    if (inst.debugOn) {
      console.debug('formatDoc ' + 5);
    }

    if (types.length > 0) {
      var jSection = $('<div class="section"><label data-title="http://www.w3.org/1999/02/22-rdf-syntax-ns#type">type</label><div></div></div>');

      inst.renderer.hover( jSection.find('label') );

      for (var int = 0; int < types.length; int++) {
        var shortKey = LodLive.shortenKey(types[int]);
        // is this really appended to ALL children divs or we looking for something specific?
        jSection.children('div').append('<span title="' + types[int] + '">' + shortKey + ' </span>');
      }

      jContents.append(jSection);
    }

    if (inst.debugOn) {
      console.debug('formatDoc ' + 6);
    }

    if (imagesj) {
      jContents.append(imagesj);
    }

    if (webLinkResult) {
      //TODO: delegate hover
      var jWebLinkResult = $(webLinkResult);
      inst.renderer.hover( jWebLinkResult.find('a') );
      jContents.append(jWebLinkResult);
    }

    if (inst.debugOn) {
      console.debug('formatDoc ' + 7);
    }

    if (propertiesMapper) {
      $.each(propertiesMapper, function(filter, label) {
        //show all properties
        $.each(contents, function(key, value) {
          for (var akey in value) {
            if (filter == akey) {
              var shortKey = label;
              try {
                var jSection = $('<div class="section"><label data-title="' + akey + '">' + shortKey + '</label><div>' + unescape(value[akey]) + '</div></div>');
                inst.renderer.hover( jSection.find('label') );
                jContents.append(jSection);
              } catch (e) {
                // /console.debug(value[akey] + " --- " + shortKey);
              }
              return true;
            }
          }
        });
      });

    } else {
      //show all properties
      $.each(contents, function(key, value) {
        for (var akey in value) {
          var shortKey = akey;
          // calcolo una forma breve per la visualizzazione
          // dell'etichetta della proprieta'
          while (shortKey.indexOf('/') > -1) {
            shortKey = shortKey.substring(shortKey.indexOf('/') + 1);
          }
          while (shortKey.indexOf('#') > -1) {
            shortKey = shortKey.substring(shortKey.indexOf('#') + 1);
          }
          try {

            var jSection = $('<div class="section"><label data-title="' + akey + '">' + shortKey + '</label><div>' + unescape(value[akey]) + '</div></div>');
            inst.renderer.hover( jSection.find('label') );
            jContents.append(jSection);
          } catch (e) { // what are we catching here?
            // /console.debug(value[akey] + " --- " + shortKey);
          }
        }
      });
    }

    if (bnodes.length > 0) {
      // processo i blanknode
      $.each(bnodes, function(key, value) {
        for (var akey in value) {
          var shortKey = LodLive.shortenKey(akey);

          var jBnode = $('<div class="section"><label data-title="' + akey + '">' + shortKey + '</label><span class="bnode"></span></div><div class="separ sprite"></div>');
          inst.renderer.hover( jBnode.find('label') );
          inst.resolveBnodes(unescape(value[akey]), URI, jBnode, jContents);

        }
      });
    }

    if (contents.length == 0 && bnodes.length == 0) {
      var jSection = $('<div class="section"><label data-title="' + LodLiveUtils.lang('resourceMissingDoc') + '"></label><div>' + LodLiveUtils.lang('resourceMissingDoc') + '</div></div><div class="separ sprite"></div>');
      inst.renderer.hover( jSection.find('label') );
      jContents.append(jSection);
    }

    destBox.append(jResult);
    destBox.append(jContents);
    // destBox.append("<div class=\"separLast\"></div>");

    // aggiungo le funzionalita' per la visualizzazione delle immagini
    //FIXME: consolidate this
    jContents.find('.relatedImage').each(function() {
      $(this).fancybox({
        'transitionIn' : 'elastic',
        'transitionOut' : 'elastic',
        'speedIn' : 400,
        'type' : 'image',
        'speedOut' : 200,
        'hideOnContentClick' : true,
        'showCloseButton' : false,
        'overlayShow' : false
      });

      $(this).find('img').each(function() {
        $(this).load(function() {
          if ($(this).width() > $(this).height()) {
            $(this).height($(this).height() * 80 / $(this).width());
            $(this).width(80);
          } else {
            $(this).width($(this).width() * 80 / $(this).height());
            $(this).height(80);
          }
        });
        $(this).error(function() {
          $(this).attr('title', LodLiveUtils.lang('noImage') + ' \n' + $(this).attr('src'));
          $(this).attr('src', 'img/immagine-vuota-' + $.jStorage.get('selectedLanguage') + '.png');
        });
      });
    });

    if (inst.debugOn) {
      console.debug((new Date().getTime() - start) + '  formatDoc ');
    }
  };

  LodLive.prototype.getAjaxDataType = function() {
    // TODO: consider accepting URL as parameter and detect if it requires JSONP or not
    return this.options.endpoints.jsonp ? 'jsonp' : 'json';
  };

  LodLive.prototype.resolveBnodes = function(val, URI, destBox, jContents) {
    var inst = this;

    var start;
    if (inst.debugOn) {
      start = new Date().getTime();
    }

    inst.sparqlClient.bnode(val, {
      beforeSend : function() {
        // destBox.find('span[class=bnode]').html('<img src="img/ajax-loader-black.gif"/>');
        if (inst.debugOn) {
          console.debug('beforeSend resolveBnodes')
        }
        return inst.renderer.loading( destBox.find('span[class=bnode]') );
      },
      success : function(json) {
        // s/b unnecessary
        // destBox.find('span[class=bnode]').html('');
        json = json['results']['bindings'];
        $.each(json, function(key, value) {
          var shortKey = LodLive.shortenKey(value.property.value);
          if (value.object.type == 'uri') {

          } else if (value.object.type == 'bnode') {
            var jBnode = $('<span><label data-title="' + value.property.value + '"> / ' + shortKey + '</label><span class="bnode"></span></span>');
            inst.renderer.hover( jBnode.find('label' ) );
            destBox.find('span[class=bnode]').attr('class', '').append(jBnode);
            inst.resolveBnodes(value.object.value, URI, destBox, jContents);
          } else {
            destBox.find('span[class=bnode]').append('<div><em title="' + value.property.value + '">' + shortKey + '</em>: ' + value.object.value + '</div>');
            // destBox.find('span[class=bnode]').attr("class",
            // "");
          }
          jContents.append(destBox);
          if (jContents.height() + 40 > $(window).height()) {

            // TODO: slimScroll is no long included, and seems to be unnecessary
            // jContents.slimScroll({
            //   height : $(window).height() - 40,
            //   color : '#fff'
            // });

            jContents.parent().find('div.separLast').remove();
          } else {
            jContents.parent().append('<div class="separLast"></div>');
          }
        });
      },
      error : function(e, b, v) {
        // s/b unnecessary
        // destBox.find('span[class=bnode]').html('');
      }
    });

    if (inst.debugOn) {
      console.debug((new Date().getTime() - start) + '  resolveBnodes ');
    }
    return val;
  };

  //TODO: this doesn't need to be on the prototype since it's a stateless utility function - are the metrics necessary?
  LodLive.prototype.circleChords = function(radius, steps, centerX, centerY, breakAt, onlyElement) {
    var inst = this;
    var start;
    if (inst.debugOn) {
      start = new Date().getTime();
    }
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
    if (inst.debugOn) {
      console.debug((new Date().getTime() - start) + '  circleChords ');
    }
    return values;
  };

  LodLive.prototype.getRelationshipCSS = function(uri) {
    return this.UI.relationships && this.UI.relationships.hasOwnProperty(uri) ? this.UI.relationships[uri] : {};
  };

  LodLive.prototype.getJsonValue = function(map, key, defaultValue) {
    var inst = this;
    var start;
    if (inst.debugOn) {
      start = new Date().getTime();
    }
    var returnVal = [];
    $.each(map, function(skey, value) {
      for (var akey in value) {
        if (akey == key) {
          returnVal.push(unescape(value[akey]));
        }
      }
    });
    if (returnVal == []) {
      returnVal = [defaultValue];
    }
    if (inst.debugOn) {
      console.debug((new Date().getTime() - start) + '  getJsonValue');
    }
    return returnVal;
  };

  /**
    * Get a property within an area of a context
    *
    * @param {string} area the name of the area
    * @param {string} prop the name of the property
    * @param {array | string} context a context name or an array of context names
    * @returns {string=} the property, if found
    */
  LodLive.prototype.getProperty = function(area, prop, context) {
    var inst = this, lodLiveProfile = inst.options;

    var start;
    if (inst.debugOn) {
      start = new Date().getTime();
    }


    if (Array.isArray(context)) {

      for (var a = 0; a < context.length; a++) {

        if (lodLiveProfile[context[a]] && lodLiveProfile[context[a]][area]) {
          if (prop) {
            return lodLiveProfile[context[a]][area][prop] ? lodLiveProfile[context[a]][area][prop] : lodLiveProfile['default'][area][prop];
          } else {
            return lodLiveProfile[context[a]][area] ? lodLiveProfile[context[a]][area] : lodLiveProfile['default'][area];
          }

        }
      }

    } else {
      // it's expected to be a string if not an array
      context = context + '';
      if (lodLiveProfile[context] && lodLiveProfile[context][area]) {
        if (prop) {
          return lodLiveProfile[context][area][prop] ? lodLiveProfile[context][area][prop] : lodLiveProfile['default'][area][prop];
        } else {
          return lodLiveProfile[context][area] ? lodLiveProfile[context][area] : lodLiveProfile['default'][area];
        }

      }

    }

    if (inst.debugOn) {
      console.debug((new Date().getTime() - start) + '  getProperty');
    }

    if (lodLiveProfile['default'][area]) {
      if (prop) {
        return lodLiveProfile['default'][area][prop];
      } else {
        return lodLiveProfile['default'][area];
      }
    } else {
      return '';
    }
  };


  LodLive.prototype.format = function(destBox, values, uris, inverses) {
    var inst = this, classMap = inst.classMap, lodLiveProfile = inst.options;

    var start;
    if (inst.debugOn) {
      start = new Date().getTime();
    }
    var containerBox = destBox.parent('div');
    var anchorBox = containerBox.find('.ll-node-anchor');
    var thisUri = containerBox.attr('rel') || '';

    // recupero il doctype per caricare le configurazioni specifiche
    var docType = inst.getJsonValue(uris, 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'default');
    if (thisUri.indexOf('~~') != -1) {
      docType = 'bnode';
    }
    // carico le configurazioni relative allo stile
    var aClass = inst.getProperty('document', 'className', docType);
    if (docType == 'bnode') {
      aClass = 'bnode';
    }

    // destBox.addClass(aClass);
    if (aClass == null || aClass == 'standard' || aClass == '') {
      if (classMap[docType]) {
        aClass = classMap[docType];
      } else {

        aClass = 'box' + classMap.counter;
        //FIXME: this is strange, why manually keeping a counter?
        //FIXME:  13 is a magic number, why?
        if (classMap.counter === 13) {
          classMap.counter = 1;
        } else {
          classMap.counter += 1;
        }
        classMap[docType] = aClass;
      }
    }
    containerBox.addClass(aClass);
    // ed ai path da mostrare nel titolo del box
    var titles = inst.getProperty('document', 'titleProperties', docType);
    // ed ai path degli oggetti di tipo immagine
    var images = inst.getProperty('images', 'properties', docType);
    // ed ai path dei link esterni
    var weblinks = inst.getProperty('weblinks', 'properties', docType);
    // e le latitudini
    var lats = inst.getProperty('maps', 'lats', docType);
    // e le longitudini
    var longs = inst.getProperty('maps', 'longs', docType);
    // e punti
    var points = inst.getProperty('maps', 'points', docType);

    // se la proprieta' e' stata scritta come stringa la trasformo in un
    // array
    if ( typeof titles === 'string') {
      titles = [titles];
    }
    if ( typeof images === 'string') {
      images = [images];
    }
    if ( typeof weblinks === 'string') {
      weblinks = [weblinks];
    }
    if ( typeof lats === 'string') {
      lats = [lats];
    }
    if ( typeof longs === 'string') {
      longs = [longs];
    }
    if ( typeof points === 'string') {
      points = [points];
    }

    // gestisco l'inserimento di messaggi di sistema come errori o altro
    titles.push('http://system/msg');

    // aggiungo al box il titolo
    var result = '<div class="boxTitle"><span class="ellipsis_text">';
    for (var a = 0; a < titles.length; a++) {
      var resultArray = inst.getJsonValue(values, titles[a], titles[a].indexOf('http') == 0 ? '' : titles[a]);
      if (titles[a].indexOf('http') != 0) {
        if (result.indexOf($.trim(unescape(titles[a])) + ' \n') == -1) {
          result += $.trim(unescape(titles[a])) + ' \n';
        }
      } else {
        for (var af = 0; af < resultArray.length; af++) {
          if (result.indexOf(unescape(resultArray[af]) + ' \n') == -1) {
            result += unescape(resultArray[af]) + ' \n';
          }
        }
      }

    }
    var dataEndpoint = containerBox.attr('data-endpoint') || '';

    // TODO: early return?
    if (uris.length == 0 && values.length == 0) {
      result = '<div class="boxTitle" data-tooltip="' + LodLiveUtils.lang('resourceMissing') + '"><a target="_blank" href="' + thisUri + '"><span class="spriteLegenda"></span>' + thisUri + '</a>';
    }

    result += '</span></div>';
    var jResult = $(result);
    if (jResult.text() == '' && docType == 'bnode') {
      jResult.text('[blank node]');
    } else if (jResult.text() == '') {
      var titleDef = '(Error)';
      try {
          titleDef = inst.options.default.document.titleName[thisUri];
      }catch(ex) {
          titleDef = inst.options.default.document.titleProperties[thisUri];
      }
      if(titleDef){
          jResult.text(titleDef);
      } else {
        jResult.text(LodLiveUtils.lang('noName'));
      }
    }
    destBox.append(jResult);

    var resourceTitle = jResult.text();
    jResult.data('tooltip', resourceTitle);

    inst.renderer.hover(destBox, function() {
      console.log('destbox hover title', resourceTitle);
      inst.renderer.msg(resourceTitle, 'show', 'fullInfo', containerBox.attr('data-endpoint'));
    });

    // calcolo le uri e le url dei documenti correlati
    var connectedDocs = [];
    var invertedDocs = [];
    var propertyGroup = {};
    var propertyGroupInverted = {};

    // Image rendering has been disabled; keeping for posterity ...
    // var connectedImages = [];

    // Map rendering has been disabled; keeping for posterity ...
    // var connectedLongs = [];
    // var connectedLats = [];

    function groupByObject(inputArray, type) {
      var tmpIRIs = {};
      var outputArray = [];

      inputArray.forEach(function(uriObj) {
        // TODO: ensure only one key?
        var property = Object.keys(uriObj)[0];
        var object = uriObj[property];
        var newObj = {};
        var newKey, previousKey, previousIndex;

        // Image rendering has been disabled; keeping for posterity ...
        // if (type === 'uris' && images.indexOf(property) > -1) {
        //   newObj[property] = escape(resourceTitle);
        //   connectedImages.push(newObj);
        //   return;
        // }

        // skip `weblinks` properties
        if (type === 'uris' && weblinks.indexOf(property) > -1) return;

        // TODO: checking for bnode of bnode?
        if (type === 'inverses' && docType == 'bnode' && object.indexOf('~~') > -1) return;

        // group by object
        if (tmpIRIs.hasOwnProperty(object)) {
          previousIndex = tmpIRIs[object];
          previousKey = Object.keys(outputArray[ previousIndex ])[0]
          newKey = previousKey + ' | ' + property;
          newObj[ newKey ] = object;
          outputArray[ previousIndex ] = newObj;
        } else {
          outputArray.push(uriObj);
          tmpIRIs[object] = outputArray.length - 1;
        }
      });

      return outputArray;
    }

    connectedDocs = groupByObject(uris, 'uris');
    if (inverses) {
      invertedDocs = groupByObject(inverses, 'inverses');
    }

    function groupByPropertyKey(inputArray) {
      var group = {};

      // group URIs by property key
      inputArray.forEach(function(uriObj) {
        // TODO: ensure only one key?
        var property = Object.keys(uriObj)[0];
        var object = uriObj[property];

        if (group.hasOwnProperty(property)) {
          group[property].push(object);
        } else {
          group[property] = [object];
        }
      });

      return group;
    }

    // group URIs by property key
    propertyGroup = groupByPropertyKey(connectedDocs);
    // group inverse URIs by property key
    propertyGroupInverted = groupByPropertyKey(invertedDocs);

    // Map rendering has been disabled; keeping for posterity ...
    // if (inst.doDrawMap) {
    //   for (var a = 0; a < points.length; a++) {
    //     var resultArray = inst.getJsonValue(values, points[a], points[a]);
    //     for (var af = 0; af < resultArray.length; af++) {
    //       if (resultArray[af].indexOf(' ') != -1) {
    //         eval('connectedLongs.push(\'' + unescape(resultArray[af].split(' ')[1]) + '\')');
    //         eval('connectedLats.push(\'' + unescape(resultArray[af].split(' ')[0]) + '\')');
    //       } else if (resultArray[af].indexOf('-') != -1) {
    //         eval('connectedLongs.push(\'' + unescape(resultArray[af].split('-')[1]) + '\')');
    //         eval('connectedLats.push(\'' + unescape(resultArray[af].split('-')[0]) + '\')');
    //       }
    //     }
    //   }
    //   for (var a = 0; a < longs.length; a++) {
    //     var resultArray = inst.getJsonValue(values, longs[a], longs[a]);
    //     for (var af = 0; af < resultArray.length; af++) {
    //       eval('connectedLongs.push(\'' + unescape(resultArray[af]) + '\')');
    //     }
    //   }
    //   for (var a = 0; a < lats.length; a++) {
    //     var resultArray = inst.getJsonValue(values, lats[a], lats[a]);
    //     for (var af = 0; af < resultArray.length; af++) {
    //       eval('connectedLats.push(\'' + unescape(resultArray[af]) + '\')');
    //     }
    //   }

    //   if (connectedLongs.length > 0 && connectedLats.length > 0) {
    //     var mapsMap = inst.mapsMap;
    //     mapsMap[containerBox.attr('id')] = {
    //       longs : connectedLongs[0],
    //       lats : connectedLats[0],
    //       title : thisUri + '\n' + escape(resourceTitle)
    //     };
    //     inst.updateMapPanel(inst.context.find('.lodlive-controlPanel'));
    //   }
    // }

    // Image rendering has been disabled; keeping for posterity ...
    // if (inst.doCollectImages) {
    //   if (connectedImages.length > 0) {
    //     var imagesMap = inst.imagesMap;
    //     imagesMap[containerBox.attr('id')] = connectedImages;
    //     inst.updateImagePanel(inst.context.find('.lodlive-controlPanel'));
    //   }
    // }

    // No longer used; keeping for posterity ...
    // totRelated = Object.keys(propertyGroup).length +
    //              Object.keys(propertyGroupInverted).length;

    // calcolo le parti in cui dividere il cerchio per posizionare i link
    // var chordsList = this.lodlive('circleChords',
    // destBox.width() / 2 + 12, ((totRelated > 1 ? totRelated - 1 :
    // totRelated) * 2) + 4, destBox.position().left + destBox.width() /
    // 2, destBox.position().top + destBox.height() / 2, totRelated +
    // 4);

    var chordsList = inst.circleChords(75, 24, destBox.position().left + 65, destBox.position().top + 65);
    var chordsListGrouped = inst.circleChords(95, 36, destBox.position().left + 65, destBox.position().top + 65);

    // iterates over connectedDocs and invertedDocs, creating DOM nodes and calculating CSS positioning
    function createPropertyBoxes(inputArray, inputGroup, isInverse) {
      var counter = 1;
      var inserted = {};
      var innerCounter = 1;
      var objectList = [];
      var innerObjectList = [];

      inputArray.forEach(function(value, i) {
        // TODO: refactor; modular arithmetic for CSS positioning
        // counter appears to equal the count of groupedProperties mod 14 plus 1 or 2
        if (counter === 15) {
          counter = 1;
        }

        // TODO: ensure only one key?
        var key = Object.keys(value)[0];
        var obj = null;

        if (inputGroup[key] && inputGroup[key].length > 1) {
          if (!inserted[key]) {
            innerCounter = 1;
            inserted[key] = true;

            var objBox = createPropertyGroup(key, inputGroup[key], counter, isInverse);
            objectList.push(objBox);
            counter++;
          }

          // TODO: magic number; why 25?
          if (innerCounter < 25) {
            obj = createGroupedRelatedBox(key, value[key], innerCounter, isInverse);
          }

          innerCounter++;
        } else {
          obj = createRelatedBox(key, value[key], counter, isInverse);
          counter++;
        }

        // TODO: when will object be null? innerCounter >= 25?
        if (obj) {
          addRelatedBoxProperties(obj, key, containerBox, isInverse);

          if (obj.hasClass('aGrouped')) {
            innerObjectList.push(obj);
          } else {
            objectList.push(obj);
          }
        }
      });

      return {
        objectList: objectList,
        innerObjectList: innerObjectList
      }
    }

    // create a node to represent a group of related properties (star-circle)
    function createPropertyGroup(key, groupValue, counter, isInverse) {
      var objBox = $('<div></div>')
      .addClass('groupedRelatedBox')
      .attr('rel', inst.hashFunc(key))
      .attr('data-property', key)
      .attr('data-title', key + ' \n ' + (groupValue.length) + ' ' + LodLiveUtils.lang('connectedResources'))
      .css(inst.getRelationshipCSS(key))
      .css({
        'top':  (chordsList[counter][1] - 8) + 'px',
        'left': (chordsList[counter][0] - 8) + 'px'
      });

      if (isInverse) {
        objBox.addClass('inverse');
        objBox.attr('rel', inst.hashFunc(key) + '-i');
      }

      var keyArray = key.split(' ');

      if (unescape(groupValue[0]).indexOf('~~') > -1) {
        objBox.addClass('isBnode');
      } else {
        for (var i = 0; i < keyArray.length; i++) {
          if (lodLiveProfile.arrows[keyArray[i]]) {
            objBox.addClass(lodLiveProfile.arrows[keyArray[i]]);
          }
        }
      }

      return objBox;
    }

    // create a node to represent a property in a group of related properties
    function createGroupedRelatedBox(key, keyedValue, innerCounter, isInverse) {
      var rel;

      // TODO: this seems inlikely... the bnode marker isn't ever at the beginning of keyedValue
      // is the condition a typo?
      if (isInverse) {
        rel = unescape(keyedValue.indexOf('~~') === 0 ? thisUri + keyedValue : keyedValue);
      } else {
        rel = unescape(keyedValue)
      }

      var obj = $('<div></div>')
      .addClass('aGrouped relatedBox ' + inst.hashFunc(unescape(keyedValue)).toString())
      .attr('rel', rel)
      .attr('data-title', key + ' \n ' + unescape(keyedValue))
      .attr('data-circlePos', innerCounter)
      .attr('data-circleParts', 36)
      .css({
        display: 'none',
        position: 'absolute',
        top: (chordsListGrouped[innerCounter][1] - 8) + 'px',
        left: (chordsListGrouped[innerCounter][0] - 8) + 'px'
      });

      if (isInverse) {
        obj.addClass('inverse ' + inst.hashFunc(key) + '-i');
      } else {
        obj.addClass(inst.hashFunc(key).toString());
      }

      return obj;
    }

    // create a node to represent a related property
    function createRelatedBox(key, keyedValue, counter, isInverse) {
      var obj = $('<div></div>')
      .addClass('relatedBox ' + inst.hashFunc(unescape(keyedValue)).toString())
      .attr('rel', unescape(keyedValue))
      .attr('data-title', key + ' \n ' + unescape(keyedValue))
      .attr('data-circlePos', counter)
      .attr('data-circleParts', 24)
      .css({
        top: (chordsList[counter][1] - 8) + 'px',
        left: (chordsList[counter][0] - 8) + 'px'
      });

      if (isInverse) {
        obj.addClass('inverse');
      }

      return obj;
    }

    function addRelatedBoxProperties(obj, key, containerBox, isInverse) {
      obj.attr('data-circleid', containerBox.attr('id'))
      .attr('data-property', key)
      .css(inst.getRelationshipCSS(key));

      // se si tratta di un  Bnode applico una classe diversa
      var keyArray = key.split(' ');
      if (obj.attr('rel').indexOf('~~') > -1) {
        obj.addClass('isBnode');
      } else {
        for (var i = 0; i < keyArray.length; i++) {
          if (lodLiveProfile.arrows[keyArray[i]]) {
            obj.addClass(lodLiveProfile.arrows[keyArray[i]]);
          }
        }
      }
    }

    var connectedNodes = createPropertyBoxes(connectedDocs, propertyGroup, false);
    var invertedNodes = createPropertyBoxes(invertedDocs, propertyGroupInverted, true);

    // aggiungo al box i link ai documenti correlati
    var objectList = connectedNodes.objectList.concat(invertedNodes.objectList);
    var innerObjectList = connectedNodes.innerObjectList.concat(invertedNodes.innerObjectList);

    var page = 0;
    var totPages = objectList.length > 14 ? (objectList.length / 14 + (objectList.length % 14 > 0 ? 1 : 0)) : 1;
    for (var i = 0; i < objectList.length; i++) {
      if (i % 14 == 0) {
        page++;
        var aPage = $('<div class="page page' + page + '" style="display:none"></div>');
        if (page > 1 && totPages > 1) {
          aPage.append('<div class="llpages pagePrev sprite" data-page="page' + (page - 1) + '" style="top:' + (chordsList[0][1] - 8) + 'px;left:' + (chordsList[0][0] - 8) + 'px"></div>');
        }
        if (totPages > 1 && page < totPages - 1) {
          aPage.append('<div class="llpages pageNext sprite" data-page="page' + (page + 1) + '" style="top:' + (chordsList[15][1] - 8) + 'px;left:' + (chordsList[15][0] - 8) + 'px"></div>');
        }
        containerBox.append(aPage);
      }
      containerBox.children('.page' + page).append(objectList[i]);
    }
    page = 0;
    totPages = innerObjectList.length / 24 + (innerObjectList.length % 24 > 0 ? 1 : 0);
    if (innerObjectList.length > 0) {
      containerBox.append('<div class="innerPage"></div>');
      for (var i = 0; i < innerObjectList.length; i++) {
        containerBox.children('.innerPage').append(innerObjectList[i]);
      }
    }
    containerBox.children('.page1').fadeIn('fast');
    containerBox.children('.page').children('.llpages').click(function() {
      var llpages = $(this);
      containerBox.find('.lastClick').removeClass('lastClick').click();
      llpages.parent().fadeOut('fast', null, function() {
        $(this).parent().children('.' + llpages.attr('data-page')).fadeIn('fast');
      });
    }); {
      // append the tools
      jQuery.each(inst.UI.nodeIcons, function(index) {
        var opts = this, obj;
        if (opts.builtin) {
          obj = jQuery(_builtinTools[opts.builtin] || '<span class="no such builtin"></span>');
        } else {  // construct custom action box
          var obj = $('<div class="actionBox custom"></div>').data('action-handler', opts.handler);
          $('<span></span>').addClass(opts.icon).attr('title',opts.title).appendTo(obj);
        }
        obj.appendTo(anchorBox);
      });
    }
    if (inst.debugOn) {
      console.debug((new Date().getTime() - start) + '  format ');
    }
  };

  var _builtinTools = {
    'docInfo': '<div class="actionBox docInfo" rel="docInfo"><span class="fa fa-list"></span></div>',
    'tools': '<div class="actionBox tools" rel="tools"><span class="fa fa-cog"></span></div>'
  };

  LodLive.prototype.openDoc = function(anUri, destBox, fromInverse) {
    var inst = this;
    // assuming this based on other methods ...
    var lodLiveProfile = inst.options;

    if (!anUri) {
      $.error('LodLive: no uri for openDoc');
    }

    var start;
    if (inst.debugOn) {
      start = new Date().getTime();
    }

    var uris = [];
    var values = [];

    if (inst.debugOn) console.log('composing query with anUri', anUri);

    // TODO: what is methods && what is doStats? neither exist ...
    // if (inst.doStats) {
    //   methods.doStats(anUri);
    // }

    // NOTE: previously extracted endpoint from SPARQLquery
    destBox.attr('data-endpoint', lodLiveProfile.connection['http:'].endpoint);

    // TODO: figure out why this doesn't work ...
    // destBox.data('endpoint', lodLiveProfile.connection['http:'].endpoint);

    // var SPARQLquery = inst.composeQuery(anUri, 'documentUri');

    // NOTE: previously fell back to inst.guessingEndpoint(anUri,
    // (if SPARQLquery was http://system/dummy)
    // callbacks:
    //   success: inst.openDoc(anUri, destBox, fromInverse);
    //   failure: inst.parseRawResource(destBox, anUri, fromInverse);

      inst.sparqlClient.documentUri(anUri, {
        beforeSend : function() {
          // destBox.children('.box').html('<img style=\"margin-top:' + (destBox.children('.box').height() / 2 - 8) + 'px\" src="img/ajax-loader.gif"/>');
          if (inst.debugOn) {
            console.debug('beforeSend openDoc')
          }
          return inst.renderer.loading(destBox)
        },
        success : function(info) {
          // reformat values for compatility

          // escape values
          info.values = info.values.map(function(value) {
            var keys = Object.keys(value)
            keys.forEach(function(key) {
              value[key] = escape(value[key])
            })
            return value
          });

          // TODO: filter info.uris where object value === anURI (??)

          // escape URIs
          info.uris = info.uris.map(function(value) {
            var keys = Object.keys(value)
            keys.forEach(function(key) {
              value[key] = escape(value[key])
            })
            return value
          });

          // parse bnodes, escape and add to URIs

          // TODO: refactor `format()` and remove this
          info.bnodes.forEach(function(bnode) {
            var keys = Object.keys(bnode)
            var value = {};
            keys.forEach(function(key) {
              value[key] = escape(anUri + '~~' + bnode[key])
            })
            info.uris.push(value);
          })

          delete info.bnodes;

          if (inst.debugOn) {
            console.debug((new Date().getTime() - start) + '  openDoc eval uris & values');
          }

          // s/b unnecessary
          // destBox.children('.box').html('');

          if (inst.doInverse) {

            // SPARQLquery = inst.composeQuery(anUri, 'inverse');

            inst.sparqlClient.inverse(anUri, {
              beforeSend : function() {
                // destBox.children('.box').html('<img id="1234" style=\"margin-top:' + (destBox.children('.box').height() / 2 - 5) + 'px\" src="img/ajax-loader.gif"/>');
                if (inst.debugOn) {
                  console.debug('beforeSend openDoc inverses')
                }
                return inst.renderer.loading(destBox);
              },
              success : function(inverseInfo) {
                var inverses = [];

                // escape values
                inverseInfo.values = inverseInfo.values.map(function(value) {
                  var keys = Object.keys(value)
                  keys.forEach(function(key) {
                    value[key] = escape(value[key])
                  })
                  return value
                });

                // escape URIs
                inverseInfo.uris = inverseInfo.uris.map(function(value) {
                  var keys = Object.keys(value)
                  keys.forEach(function(key) {
                    value[key] = escape(value[key])
                  })
                  return value
                });

                inverses = inverseInfo.uris.concat(inverseInfo.values);

                // parse bnodes, escape and add to URIs

                // parse bnodes and add to URIs
                // TODO: refactor `format()` and remove this
                inverseInfo.bnodes.forEach(function(bnode) {
                  var keys = Object.keys(bnode);
                  var value = {};
                  keys.forEach(function(key) {
                    value[key] = anUri + '~~' + bnode[key];
                  });
                  inverses.push(value);
                });

                if (inst.debugOn) {
                  console.debug((new Date().getTime() - start) + '  openDoc inverse eval uris ');
                }

                var callback = function() {
                  // s/b unnecessary
                  // destBox.children('.box').html('');

                  inst.format(destBox.children('.box'), info.values, info.uris, inverses);
                  inst.addClick(destBox, fromInverse ? function() {
                    //TODO: dynamic selector across the entire doc here seems strange, what are the the possibilities?  Is it only a DOM element?
                    try {
                      //TODO: find out if we only pass jquery objects in as fromInverse, no need to wrap it again
                      $(fromInverse).click();
                    } catch (e) {
                    }
                  } : null);
                  if (inst.doAutoExpand) {
                    inst.autoExpand(destBox);
                  }
                };

                if (inst.doAutoSameas) {
                  inst.findInverseSameAs(anUri, inverses, callback);
                } else {
                  callback();
                }

              },
              error : function(e, b, v) {
                // s/b unnecessary
                // destBox.children('.box').html('');

                inst.format(destBox.children('.box'), info.values, info.uris);

                inst.addClick(destBox, fromInverse ? function() {
                  try {
                    $(fromInverse).click();
                  } catch (e) {
                  }
                } : null);
                if (inst.doAutoExpand) {
                  inst.autoExpand(destBox);
                }
              }
            });
          } else {
            inst.format(destBox.children('.box'), info.values, info.uris);
            inst.addClick(destBox, fromInverse ? function() {
              try {
                $(fromInverse).click();
              } catch (e) {
              }
            } : null);
            if (inst.doAutoExpand) {
              inst.autoExpand(destBox);
            }
          }
        },
        error : function(e, b, v) {
          inst.renderer.errorBox(destBox);
        }
      });

    if (inst.debugOn) {
      console.debug((new Date().getTime() - start) + '  openDoc');
    }
  };

  LodLive.prototype.findInverseSameAs = function(anUri, inverse, callback) {
    var inst = this;

    // TODO: why two options? (useForInverseSameAs and doAutoSameas)
    if (!inst.options.connection['http:'].useForInverseSameAs) return;

    var start;
    if (inst.debugOn) {
      start = new Date().getTime();
    }

    inst.sparqlClient.inverseSameAs(anUri, {
      success : function(json) {
        json = json.results.bindings;

        $.each(json, function(key, value) {
          var newObj = {};
          var key = value.property && value.property.value || 'http://www.w3.org/2002/07/owl#sameAs';
          newObj[key] = escape(value.object.value);
          // TODO: why the 2nd array element?
          inverse.splice(1, 0, newObj);
        });

        callback();
      },
      error : function(e, b, v) {
        callback();
      }
    });

    if (inst.debugOn) {
      console.debug((new Date().getTime() - start) + '  findInverseSameAs');
    }
  };

  //TODO: these line drawing methods don't care about the instance, they should live somewhere else


  // expose our Constructor if not already present
  if (!window.LodLive) {
    window.LodLive = LodLive;
  }

  /* end lines*/;
  /**
    * jQuery plugin for initializing a LodLive instance.  This will initialize a new LodLive instance for each matched element.
    * @param {object | string=} options for legacy support this can be a string which is the method, \n
    *   new callers should send an options object which should contain at least 'profile': an instance of LodLiveProfile with which to configure the instance \n
    *   it may also contain 'method': the name of a LodLive prototype method to invoke (init is default) \n
    *   if invoking a method with arguments, 'args': may be included as an array of arguments to pass along to the method \n
    *   When invoking 'init', the entire options will be sent along to the init(ele, options) call and 'args' will be ignored
    *
    * If selector.lodlive() is called without any arguments, then the existing instance of LodLive will be returned.  \n
    *  **** This is NOT backwards compatible **** \n
    * But it is necessary due to the need to pass in a LodLiveProfile option.  This version of LodLive makes use of NO GLOBAL VARIABLES! \n
    * The bare miniumum to create a new LodLive instance is selector.lodlive({profile: someProfileInstance }); \n
    * More complex instances can be created by passing in more options: \n
    *   selector.lodlive({ profile: someProfileInstance, hashFunc: someHashingFunction, firstURI: 'string URI to load first'});
    */
  jQuery.fn.lodlive = function(options) {
    // if no arguments are provided, then we attempt to return the instance on what is assumed to be a single element match
    if (!arguments.length) {
      return this.data('lodlive-instance');
    }

    if (typeof options === 'string') { // legacy support, method was the only argument
      options = { method: options };
    }
    // we support multiple instances of LodLive on a page, so initialize (or apply) for each matched element
    return this.each(function() {
      var ele = $(this), ll = ele.data('lodlive-instance');
      // no method defaults to init
      if (!options.method || options.method.toLowerCase() === 'init') {

        ll = new LodLive(ele, options.profile);
        ele.data('lodlive-instance', ll);
        ll.init(options.firstUri); // pass in this element and the complete options

      } else if (LodLive.prototype.hasOwnProperty(options.method) && ele.data('lodlive-instance')) {

        ll[options.method].apply(ll, options.method.args || []); // if calling a method with arguments, the options should contain a property named 'args';
      } else {

        jQuery.error('Method ' + options.method + ' does not exist on jQuery.lodlive');

      }

    });
  };

})(jQuery);
