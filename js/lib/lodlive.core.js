'use strict';
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

  var jwin = $(window), jbody = $(document.body);

  // simple MD5 implementation to eliminate dependencies, can still pass in MD5 (or some other algorithm) as options.hashFunc if desired
  function hashFunc(str) {
    if (!str) { return str; }
    for(var r=0, i=0; i<str.length; i++) {
      r = (r<<5) - r+str.charCodeAt(i);
      r &= r;
    }
    return r;
  }

  var DEFAULT_BOX_TEMPLATE = '<div class="boxWrapper lodlive-node defaultBoxTemplate"><div class="ll-node-anchor"></div><div class="lodlive-node-label box sprite"></div></div>';

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
      console.log('keypress', event);
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

    // container elements
    this.container = container.css('position', 'relative');
    this.context = jQuery('<div class="lodlive-graph-context"></div>').appendTo(container).wrap('<div class="lodlive-graph-container"></div>');
    if (typeof container === 'string') {
      container = jQuery(container);
    }
    if (!container.length) {
      throw 'LodLive: no container found';
    }
    enableDrag(this);

  }

  LodLive.prototype.init = function(firstUri) {
    var instance = this;

    // instance data
    this.imagesMap = {};
    this.mapsMap = {};
    this.infoPanelMap = {};
    this.connection = {};
    this.hashFunc = this.options.hashFunc || hashFunc;
    this.innerPageMap = {};
    this.storeIds = {};
    this.boxTemplate =  this.options.boxTemplate || DEFAULT_BOX_TEMPLATE;
    this.ignoreBnodes = this.UI.ignoreBnodes;

    // TODO: look these up on the context object as data-lodlive-xxxx attributes
    // store settings on the instance
    /* TODO: set these by default on the instance via the options - consider putting them under 'flags' or some other property
    $.jStorage.set('relationsLimit', 25);
    $.jStorage.set('doStats', $.jStorage.get('doStats', true));
    $.jStorage.set('doInverse', $.jStorage.get('doAutoExpand', true));
    $.jStorage.set('doAutoExpand', $.jStorage.get('doAutoExpand', true));
    $.jStorage.set('doAutoSameas', $.jStorage.get('doAutoSameas', true));
    $.jStorage.set('doCollectImages', $.jStorage.get('doCollectImages', true));
    $.jStorage.set('doDrawMap', $.jStorage.get('doDrawMap', true));
    $.jStorage.set('showInfoConsole', $.jStorage.get('showInfoConsole', true));
    */

    var firstBox = $(this.boxTemplate);
    this.centerBox(firstBox);
    firstBox.attr('id', this.hashFunc(firstUri));
    firstBox.attr('rel', firstUri);
    firstBox.css('zIndex',1);
    this.context.append(firstBox);

    this.classMap = {
      // TODO: let CSS drive color
      counter : Math.floor(Math.random() * 13) + 1
    };

    // carico il primo documento
    this.openDoc(firstUri, firstBox);

    this.controlPanel('init');
    this.msg('', 'init');

  };

  LodLive.prototype.controlPanel = function(action) {
    var inst = this, panel = inst.controlPanelDiv;
    if (this.debugOn) {
      start = new Date().getTime();
    }
    // pannello di controllo dell'applicazione
    
    if (action == 'init') {

      panel = $('<div class="lodLiveControlPanel"></div>');
      inst.controlPanelDiv = panel;
      //FIXME: remove inline css where possible
      panel.css({
        left : 0,
        top : 10,
        position : 'fixed',
        zIndex : 999
      });
      panel.append('<div class="lodlive-panel lodlive-panel-options sprite" ></div>');
      panel.append('<div class="lodlive-panel lodlive-panel-legend sprite" ></div>');
      panel.append('<div class="lodlive-panel lodlive-panel-help sprite" ></div>');
      panel.append('<div class="lodlive-panel lodlive-panel-main" ></div>');
      panel.append('<div class="lodlive-panel2 lodlive-panel-maps sprite" ></div>');
      panel.append('<div class="lodlive-panel2 lodlive-panel-images sprite" ></div>');

      panel.children('.lodlive-panel-main,.lodlive-panel-panel2').hover(function() {
        $(this).setBackgroundPosition({
          y : -450
        });
      }, function() {
        $(this).setBackgroundPosition({
          y : -400
        });
      });

      this.context.append(panel);

      panel.attr('data-top', panel.position().top);

      panel.children('.lodlive-panel').click(function() {

        var panelChild = $(this);
        panel.children('.lodlive-panel,.lodlive-panel2').hide();
        var close = $('<div class="lodlive-panel lodlive-panel-close sprite" ></div>');
        close.click(function() {
          close.remove();
          panel.children('#panelContent').remove();
          panel.removeClass('justX');
          panel.children('.lodlive-panel,.lodlive-panel2').show();
          panel.children('.inactive').hide();
        });
        close.hover(function() {
          $(this).setBackgroundPosition({
            y : -550
          });
        }, function() {
          $(this).setBackgroundPosition({
            y : -500
          });
        });
        panel.append(close);
        //FIXME: remove inline CSS where possible
        close.css({
          position : 'absolute',
          left : 241,
          top : 0
        });
        var panelContent = $('<div class="lodlive-panel lodlive-panel-content"></div>');

        panel.append(panelContent);

        if (panelChild.is('.lodlive-panel-options')) {

          var anUl = $('<ul class="lodlive-panel-options-list"></ul>');
          panelContent.append('<div></div>');
          panelContent.children('div').append('<h2>' + LodLiveUtils.lang('options') + '</h2>').append(anUl);
          anUl.append('<li ' + ( inst.doInverse ? 'class="checked"' : 'class="check"') + ' data-value="inverse" ><span class="spriteLegenda"></span>' + LodLiveUtils.lang('generateInverse') + '</li>');
          anUl.append('<li ' + ( inst.doAutoExpand ? 'class="checked"' : 'class="check"') + ' data-value="autoExpand" ><span class="spriteLegenda"></span>' + LodLiveUtils.lang('autoExpand') + '</li>');
          anUl.append('<li ' + ( inst.doAutoSameas ? 'class="checked"' : 'class="check"') + ' data-value="autoSameas"><span class="spriteLegenda"></span>' + LodLiveUtils.lang('autoSameAs') + '</li>');

          anUl.append('<li ' + ( inst.doCollectImages ? 'class="checked"' : 'class="check"') + ' data-value="autoCollectImages"><span class="spriteLegenda"></span>' + LodLiveUtils.lang('autoCollectImages') + '</li>');
          anUl.append('<li ' + ( inst.doDrawMap ? 'class="checked"' : 'class="check"') + ' data-value="autoDrawMap"><span class="spriteLegenda"></span>' + LodLiveUtils.lang('autoDrawMap') + '</li>');

          anUl.append('<li>&#160;</li>');
          anUl.append('<li class="reload"><span  class="spriteLegenda"></span>' + LodLiveUtils.lang('restart') + '</li>');
          anUl.children('.reload').click(function() {
            context.lodlive('close');
          });
          anUl.children('li[data-value]').click(function() {

            var child = $(this), childVal = child.data('value'), checked = child.is('.check, :checked');

            if (child.is('.check')) {

              switch(childVal) {
                case 'inverse': inst.doInverse = checked; break;
                case 'autoExpand': inst.doInverse = checked; break;
                case 'autoSameas': inst.doAutoSameas = checked; break;
                case 'autoCollectImages': 
                  inst.doCollectImages = checked; 
                  panel.children('div.lodlive-panel-images').toggleClass('inactive');
                  break;
                case 'autoDrawMap':
                  inst.doDrawMap = checked;
                  panel.children('div.lodlive-panel-maps').toggleClass('inactive');
                  break;
              }
              child.toggleClass('checked');

            } else if (child.is('.help')) {

              var help = panel.find('.lodlive-panel-help').children('div').clone();

              // FIXME: eliminate fancybox dependency
              $('.videoHelp', help).fancybox({
                'transitionIn' : 'elastic',
                'transitionOut' : 'elastic',
                'speedIn' : 400,
                'type' : 'iframe',
                'width' : 853,
                'height' : 480,
                'speedOut' : 200,
                'hideOnContentClick' : false,
                'showCloseButton' : true,
                'overlayShow' : false
              });

              panelContent.append(help);

              if (help.height() > jwin.height() + 10) {
                panel.addClass('justX');
              }

            } else if (child.is('.legend')) {

              
              var legend = panel.find('.legenda').children('div').clone();

              var counter = 0;

              legend.find('span.spriteLegenda').each(function() {
                $(this).css({
                  'background-position' : '-1px -' + (counter * 20) + 'px'
                });
                counter++;
              });

              panelContent.append(legend);

              if (legend.height() > jwin.height() + 10) {
                panel.addClass('justX');
              }

            }

          });
        }

        if (!inst.doCollectImages) {

          panel.children('div.lodlive-panel-images').addClass('inactive').hide();

        }
        if (!inst.doDrawMap) {

          panel.children('div.lodlive-panel-maps').addClass('inactive').hide();

        }

        //TODO: can we consolidate behavior between panels?
        panel.on('click', '.lodlive-panel2', function() {
          var panel2 = $(this);

          panel.children('.lodlive-panel,.lodlive-panel2').hide();

          var close = $('<div class="lodlive-panel lodlive-close2 sprite" ></div>');

          close.click(function() {

            $(this).remove();
            panel.find('.lodlive-maps-container, .lodlive-images-container, .inactive').hide();
            panelContent.hide();
            panel.removeClass('justX');
            panel.children('.lodlive-panel,.lodlive-panel2').show();

          });

          //FIXME: remove inline CSS where possible
          close.hover(function() {

            $(this).setBackgroundPosition({
              y : -550
            });

          }, function() {

            $(this).setBackgroundPosition({
              y : -500
            });

          });
          //TODO: why do we append this each click on .panel2, can we just hide/show it?
          panel.append(close);

          var panel2Content = panel.find('.lodlive-panel2-content');

          if (!panel2Content.length) {
            panel2Content = $('<div class="lodlive-panel2-content"></div>');
            panel.append(panel2Content);
          } else {
            panel2Content.show();
          }

          if (panel2.is('.maps')) {

            var mapPanel = panel2Content.find('.lodlive-maps-container');

            if (!mapPanel.length) {
              mapPanel = $('<div class="lodlive-maps-container"></div>');

              panel2Content.width(800); //FIXME: magic number

              panel2Content.append(mapPanel);

              //FIXME: can we eliminate gmap3 dependency? maybe take it as an option
              mapPanel.gmap3({
                action : 'init',
                options : {
                  zoom : 2,
                  mapTypeId : google.maps.MapTypeId.HYBRID
                }
              });

            } else {
              mapPanel.show();
            }

            inst.updateMapPanel(panel);

          } else if (panelChild.is('.images')) {

            var imagePanel = panel2Contet.find('.lodlive-images-container');

            if (!imagePanel.length) {

              imagePanel = $('<div class="lodlive-images-container"><span class="lodlive-images-count"></span></div>');
              panel2Content.append(imagePanel);

            } else {
              imagePanel.show();
            }
            inst.updateImagePanel(panel);
          }
        });
      });

    } else if (action === 'move') {

      //FIXME: remove inline CSS where possible;
      if (panel.is('.justX')) {

        panel.css({
          position : 'absolute',
          left : jbody.scrollLeft(),
          top : panel.data('top')
        });

      } else {

        panel.css({
          left : 0,
          top : 10,
          position : 'fixed'
        });
        if (panel.position()) {
          panel.data('top', panel.position().top);
        }
      }

    }
    if (inst.debugOn) {
      console.debug((new Date().getTime() - start) + '  controlPanel ');
    }
  };

  LodLive.prototype.close = function() {
    document.location = document.location.pathname; // remove the query string
  };

  /**
    * Composes a query somehow, more to come
    * @param {string} resource a resource URI I think?
    * @param {string} module not sure how this is used yet
    * @param {string=} testURI optional testURI used instead of resource for something
    * @returns {string} the url
    */
  LodLive.prototype.composeQuery = function(resource, module, testURI) {
    var  url, res, endpoint, inst = this, lodLiveProfile = inst.options;

    if (inst.debugOn) {
      start = new Date().getTime();
    }

    jQuery.each( lodLiveProfile.connection, function(key, value) {

      var keySplit = key.split(',');

      for (var a = 0; a < keySplit.length; a++) {

        // checking for some sort of key, but not sure what's in the connection keys at this time
        if (( testURI ? testURI : resource).indexOf(keySplit[a]) === 0) {

          res = LodLiveUtils.getSparqlConf(module, value, lodLiveProfile).replace(/\{URI\}/ig, resource.replace(/^.*~~/, ''));

          if (value.proxy) {

            url = value.proxy + '?endpoint=' + value.endpoint + '&' + (value.endpointType ? inst.options.endpoints[value.endpointType] : inst.options.endpoints.all ) + '&query=' + encodeURIComponent(res);

          } else {

            url = value.endpoint + '?' + (value.endpointType ? inst.options.endpoints[value.endpointType] : inst.options.endpoints.all) + '&query=' + encodeURIComponent(res);

          }

          endpoint = value.endpoint;

          return false;
        }
      }

    });

    if (inst.debugOn) {

      console.debug((new Date().getTime() - start) + '  composeQuery ');

    }

    if (!url) {

      url = 'http://system/dummy?' + resource;

    }

    // counterintuitive for this to be part of a 'compose' function, but leaving it for now
    if (endpoint && inst.showInfoConsole) {

      inst.queryConsole('log', {
        title : endpoint,
        text : res,
        id : url,
        uriId : resource
      });

    }

    return url;

  };

  LodLive.prototype.guessingEndpoint = function(uri, onSuccess, onFail) {
    var base = uri.replace(/(^http:\/\/[^\/]+\/).+/, '$1'), inst = this;

    // TODO: make this more configurable by the instance or profile flags
    var guessedEndpoint = base + 'sparql?' + inst.options.endpoints.all + '&query=' + encodeURIComponent('select * where {?a ?b ?c} LIMIT 1');

    $.ajax({
      url : guessedEndpoint,
      contentType: 'application/json',
      accepts: inst.options.connection['http:'].accepts,
      dataType: inst.getAjaxDataType(),
      success : function(data) {

        if (data && data.results && data.results.bindings[0]) {

          // store this in our instance, not globally
          inst.connections[base] = {
            endpoint : base + 'sparql'
          };

          onSuccess();

        } else {

          onFail();
        }
      },

      error : function() {
        if (inst.debugOn) {
          console.log('guessingEndpointError', arguments);
        }
        onFail();
      }

    });
  };

  LodLive.prototype.msg = function(msg, action, type, endpoint, inverse) {
    // area dei messaggi
    var inst = this, msgPanel = inst.container.find('.lodlive-message-container'), msgs;
    if (!msg) msg = '';
    switch(action) {

      case 'init': 
        if (!msgPanel.length) {
          msgPanel = $('<div class="lodlive-message-container"></div>');
          inst.container.append(msgPanel);
        }
        break;

      default:
        msgPanel.hide();
    }
    msgPanel.empty();
    msg = msg.replace(/http:\/\/.+~~/g, '');
    msg = msg.replace(/nodeID:\/\/.+~~/g, '');
    msg = msg.replace(/_:\/\/.+~~/g, '');
    msg = breakLines(msg); //TODO: find where this is - no globals
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

  //FIXME: replace globalInfoPanelMap
  LodLive.prototype.queryConsole = function(action, toLog) {
    var inst = this, id = inst.hashFunc(toLog.uriId), localId = inst.hashFunc(toLog.id), infoMap = inst.infoPanelMap, panel = infoMap[id];

    switch (action) {
      case 'init': 
        panel = inst.context.find('<div id="q' + id + '" class="lodlive-query-console"></div>');
        infoMap[id] = panel;
        inst.infoPanelMap = infoMap;
        break;

      case 'log': 
        if (panel && toLog) {

          if (toLog.resource) {

            panel.append('<h3 class="sprite"><span>' + toLog.resource + '</span><a class="sprite">&#160;</a></h3>');

            panel.on('click', 'h3 a', function() {

              inst.queryConsole('close', {
                uriId : toLog.uriId
              });
            }).hover(function() {
              $(this).setBackgroundPosition({
                x : -641
              });
            }, function() {
              $(this).setBackgroundPosition({
                x : -611
              });
            });

          }

          if (toLog.title) {
            var h4 = $('<h4 class="t' + localId + ' sprite"><span>' + toLog.title + '</span></h4>');
            panel.append(h4);
            h4.hover(function() {
              h4.setBackgroundPosition({
                y : -700
              });
            }, function() {
              h4.setBackgroundPosition({
                y : -650
              });
            });

            h4.click(function() {

              if (h4.data('show')) {

                h4.data('show', false);
                h4.setBackgroundPosition({
                  x : -680
                });
                h4.removeClass('slideOpen');
                h4.next('div').slideToggle();

              } else {

                h4.data('show', true);
                h4.setBackgroundPosition({
                  x : -1290
                });
                panel.find('.slideOpen').click();
                h4.addClass('slideOpen');
                h4.next('div').slideToggle();
              }
            });
          }

          if (toLog.text) {
            var aDiv = $('<div><span><span class="contentArea">' + (toLog.text).replace(/</gi, '&lt;').replace(/>/gi, '&gt;') + '</span></span></div>');
            var aEndpoint = $.trim(panel.find('h4.t' + localId).clone().find('strong').remove().end().text()); //TODO: this looks like it could be simplified

            //FIXME: use regex to support http and https
            if (aEndpoint.indexOf('http:') === 0) {

              var aLink = $('<span class="linkArea sprite" title="' + LodLiveUtils.lang('executeThisQuery') + '"></span>');

              aLink.click(function() {
                window.open(aEndpoint + '?query=' + encodeURIComponent(toLog.text));
              });

              aLink.hover(function() {
                aLink.setBackgroundPosition({
                  x : -630
                });
              }, function() {
                aLink.setBackgroundPosition({
                  x : -610
                });
              });

              aDiv.children('span').prepend(aLink);
            }

            aDiv.css({
              opacity : 0.95
            });

            panel.append(aDiv);

          }

          if (toLog.error) {

            panel.find('h4.t' + localId + ' > span').append('<strong style="float:right">' + LodLiveUtils.lang('enpointNotAvailable') + '</strong>');

          }

          // what is this?
          if ( typeof toLog.founded == typeof 0) {

            if (!toLog.founded) {

              panel.find('h4.t' + localId + ' > span').append('<strong style="float:right">' + LodLiveUtils.lang('propsNotFound') + '</strong>');

            } else {

              panel.find('h4.t' + localId + ' > span').append('<strong style="float:right">' + toLog.founded + ' ' + LodLiveUtils.lang('propsFound') + ' </strong>');

            }

          }
          infoMap[id] = panel;
          globalInfoPanelMap = infoMap;

        }
        break;

      case 'remove': 
        delete infoMap[id];
        inst.infoPanelMap = infoMap;
        break;

      case 'show':
        inst.context.append(panel); //TODO: why are we detaching and re-attaching?
        break;

      case 'close':
        panel.detach();
        break;

    }

  };

  LodLive.prototype.updateMapPanel = function(panel) {
    var inst = this, mapPanel;

    if (inst.doDrawMap) {

      mapPanel = inst.context.find('.lodlive-maps-container');

      if (mapPanel.length && mapPanel.is(':visible')) {
        //FIXME: eliminate google maps dependency in core
        mapPanel.gmap3({
          action : 'clear'
        });
        var panelContent = inst.context.find('.lodlive-panel2-content');
        panelContent.width(800); //FIXME: magic number
        var close = panel.find('.lodlive-close2');
        var mapsMap = inst.mapsMap;
        var mapKeys = Object.keys(mapsMap);
        var mapSize = mapKeys.length;
        var mapAction = mapSize > 1 ? { action: 'autofit' } : {};

        while(mapSize--) {
          var prop = mapKeys[mapSize];
          //FIXME: eliminate google maps dependency from core
          $('#mapPanel').gmap3({
            action : 'addMarker',
            latLng : [mapsMap[prop].lats, mapsMap[prop].longs],
            title : unescape(mapsMap[prop].title)
          }, mapAction);
        }

        //FIXME: eliminate inline CSS where possible
        close.css({
          position : 'absolute',
          left : panelContent.width() + 1,
          top : 0
        });

      } else {
        inst.highlight(panel.children('.maps'), 2, 200, '-565px -450px');
      }
    }
  };

  LodLive.prototype.updateImagePanel = function(panel) {
    var inst = this;

    if (inst.doCollectImages) {

      var imagePanel = panel.find('.lodlive-images-container span:visible');
      if (imagePanel.length) {

        var panelContent = panel.find('.lodlive-panel2-content');
        var close = panel.find('.lodlive-close2');
        var imageMap = inst.imagesMap;
        var mapKeys = Object.keys(imageMap);
        var mapSize = mapKeys.length;

        if (mapSize > 0) {

          imagePanel.children('.amsg').remove(); // why is this conditional, can we just remove it even if the map is empty?
          var counter = 0;
          
          while (mapSize--) {

            var prop = mapKeys[mapSize];

            for (var a = 0; a < imageMap[prop].length; a++) {

              //FIXME: this whole thing is strange and seems very inefficient, but not completely aware enough of what it's doing to change it yet
              // triple nested maps inside an array?? surely there's a better way
              for (var key in imageMap[prop][a]) {

                if (inst.noImagesMap[prop + counter]) {
                  
                  counter--; // counter could go to -1, logic is strange - is this just for tiling?

                } else if (!imagePanel.children('.img-' + prop + '-' + counter).length) {

                  var img = $('<a href="' + unescape(key) + '" class="sprite relatedImage img-' + prop + '-' + counter + '"><img rel="' + unescape(imageMap[prop][a][key]) + '" src="' + unescape(key) + '"/></a>"');
                  img.attr('data-prop', prop);
                  imagePanel.prepend(img);
                  //FIXME: eliminate fancybox dependency from core
                  img.fancybox({
                    'transitionIn' : 'elastic',
                    'transitionOut' : 'elastic',
                    'speedIn' : 400,
                    'type' : 'image',
                    'speedOut' : 200,
                    'hideOnContentClick' : true,
                    'showCloseButton' : false,
                    'overlayShow' : false
                  });

                  //FIXME: these should be a delegated event on the imagePanel; we don't need a counter to do wrapping; 
                  img.children('img').error(function() {
                    img.remove();
                    counter--;
                    if (counter < 3) {

                      panelContent.width(148); //FIXME: magic number - this should all be handled via CSS with reponsive images and inline-blocks

                    } else {

                      var tot = (counter / 3 + (counter % 3 > 0 ? 1 : 0) + '').split('.')[0];
                      if (tot > 7) {
                        tot = 7;
                      }
                      panelContent.width(20 + (tot) * 128);
                    }
                    //FIXME: eliminate inline CSS where possible
                    close.css({
                      position : 'absolute',
                      left : panelContent.width() + 1,
                      top : 0
                    });
                    // this is where we set images into the noImagesMap - pretty sure there's a better way but not lookng closely just yet
                    inst.noImagesMap[prop + counter] = true;

                  }).load(function() {

                    var imageTag = $(this), titolo = imageTag.attr('rel'), imgW = imageTag.width(), imgH = imageTag.height();

                    //wtf with all the specific sizing?  Need to use css and eliminate this
                    if (imgW < imgH) {
                      imageTag.height(imgH * 113 / imgW);
                      imageTag.width(113);
                    } else {
                      //FIXME: eliminate inline CSS where possible
                      imageTag.css({
                        width : imgW * 113 / imgH,
                        height : 113,
                        marginLeft : -((imgW * 113 / imgH - 113) / 2)
                      });
                    }
                    var controls = $('<span class="lodlive-image-controls"><span class="imgControlCenter" title="' + LodLiveUtils.lang('showResource') + '"></span><span class="imgControlZoom" title="' + LodLiveUtils.lang('zoomIn') + '"></span><span class="imgTitle">' + titolo + '</span></span>');
                    img.append(controls);
                    //FIXME: this totally needs to be in CSS - fthis
                    img.hover(function() {
                      imageTag.hide();
                    }, function() {
                      imageTag.show();
                    });
                    controls.children('.imgControlZoom').hover(function() {
                      img.setBackgroundPosition({
                        x : -1955
                      });
                    }, function() {
                      img.setBackgroundPosition({
                        x : -1825
                      });
                    });
                    controls.children('.imgControlCenter').hover(function() {
                      img.setBackgroundPosition({
                        x : -2085
                      });
                    }, function() {
                      img.setBackgroundPosition({
                        x : -1825
                      });
                    });

                    controls.children('.imgControlCenter').click(function() {
                      panel.find('.lodlive-close2').click();
                      inst.highlight($('#'+img.attr('data-prop')).children('.box'), 8, 100, '0 0');
                      return false;
                    });

                    if (counter < 3) {
                      panelContent.width(148);
                    } else {
                      var tot = (counter / 3 + (counter % 3 > 0 ? 1 : 0) + '').split('.')[0];
                      if (tot > 7) {
                        tot = 7;
                      }
                      panelContent.width(20 + (tot) * 128);
                      close.css({
                        position : 'absolute',
                        left : panelContent.width() + 1,
                        top : 0
                      });
                    }
                  });

                }
                counter++;
              }
            }
          }
        } else {

          panelContent.width(148);

          if (!imagePanel.children('.amsg').length) {
            imagePanel.append('<span class="amsg">' + LodLiveUtils.lang('imagesNotFound') + '</span>');
          }
        }

        close.css({
          position : 'absolute',
          left : panelContent.width() + 1,
          top : 0
        });

      } else {
        inst.highlight(panel.children('.images'), 2, 200, '-610px -450px');
      }
    }

  };

  //FIXME: this needs to be a CSS animation for performance and decluttering
  LodLive.prototype.highlight = function(object, times, speed, backmove) {
    var inst = this;
    if (times > 0) {
      times--;
      var css = object.css('background-position');
      object.doTimeout(speed, function() {
        object.css({
          'background-position' : backmove
        });
        object.doTimeout(speed, function() {
          object.css({
            'background-position' : css
          });
          inst.highlight(object, times, speed, backmove);
        });
      });
    }
  };

  LodLive.prototype.centerBox = function(aBox) {
    var inst = this, ch = inst.context.height(), cw = inst.context.width(), bw = aBox.width() || 65, bh = aBox.height() || 65, start;
    if (inst.debugOn) {
      start = new Date().getTime();
    }

    var top = (ch - 65) / 2 + (inst.context.scrollTop() || 0);
    var left = (cw - 65) / 2 + (inst.context.scrollLeft() || 0);
    var props = {
      position : 'absolute',
      left : left,
      top : top,
      opacity: 0
    };

    //console.log('centering top: %s, left: %s', top, left);

    //FIXME: we don't want to assume we scroll the entire window here, since we could be just a portion of the screen or have multiples
    inst.context.parent().scrollTop(ch / 2 - inst.context.parent().height() / 2 + 60);
    inst.context.parent().scrollLeft(cw / 2 - inst.context.parent().width() / 2 + 60);
    console.log(inst.context.parent().scrollTop());
    //window.scrollBy(cw / 2 - jwin.width() / 2 + 25, ch / 2 - jwin.height() / 2 + 65);
    aBox.css(props)

      aBox.animate({ opacity: 1}, 1000);


    if (inst.debugOn) {
      console.debug((new Date().getTime() - start) + '  centerBox ');
    }
  };

  LodLive.prototype.autoExpand = function(obj) {
    var inst = this, start;
    if (inst.debugOn) {
      start = new Date().getTime();
    }

    $.each(inst.innerPageMap, function(key, element) {

      var closed = element.children('.relatedBox:not([class*=exploded])');

      if (closed.length) {

        if (!element.parent().length) {
          inst.context.append(element);
        }

        closed.each(function() {
          box = $(moreInfoOnThis);
          var aId = box.attr('relmd5');
          
          //FIXME: not sure I want IDs here but leaving for now
          var newObj = inst.context.children('#' + aId);

          if (newObj.length > 0) {
            box.click();
          }
        });

        inst.context.children('.innerPage').detach();

      }
    });

    //FIXME: this does the same thing as the function above, consolidate
    inst.context.find('.relatedBox:not([class*=exploded])').each(function() {
      var box = $(this);
      var aId = box.attr('relmd5');
      var newObj = context.children('#' + aId);
      if (newObj.length > 0) {
        box.click();
      }
    });


    if (inst.debugOn) {
      console.debug((new Date().getTime() - start) + '  autoExpand ');
    }

  };

  LodLive.prototype.addNewDoc = function(obj, ele, callback) {
    var inst = this, start;
    if (inst.debugOn) {
      start = new Date().getTime();
    }

    var aId = ele.attr('relmd5');
    var newObj = inst.context.find('#' + aId);
    var isInverse = ele.is('.inverse');
    var exist = true;
    ele = $(ele);

    // verifico se esistono box rappresentativi dello stesso documento
    // nella pagina
    if (!newObj.length) {

      newObj = $(inst.boxTemplate);
      exist = false;

    }

    var circleId = ele.data('circleid');
    var originalCircus = $('#' + circleId);

    if (inst.debugOn) {
      console.debug((new Date().getTime() - start) + '  addNewDoc 01 ');
    }

    if (!isInverse) {

      if (inst.debugOn) {

        console.debug((new Date().getTime() - start) + '  addNewDoc 02 ');
      }

      var connected = inst.storeIds['gen' + circleId];
      if (!connected) {
        connected = [aId];
      } else {
        if ($.inArray(aId, connected) == -1) {
          connected.push(aId);
        } else {
          return;
        }
      }

      if (inst.debugOn) {
        console.debug((new Date().getTime() - start) + '  addNewDoc 03 ');
      }

      inst.storeIds['gen' + circleId] = connected;

      connected = inst.storeIds['rev'+ aId];
      if (!connected) {
        connected = [circleId];
      } else {
        if ($.inArray(circleId, connected) == -1) {
          connected.push(circleId);
        }
      }
      if (inst.debugOn) {
        console.debug((new Date().getTime() - start) + '  addNewDoc 04 ');
      }
      inst.storeIds['rev' + aId] = connected;
    }

    var propertyName = ele.data('property');
    var rel = ele.attr('rel');
    newObj.attr('id', aId);
    newObj.attr('rel', rel);

    var fromInverse = isInverse ? 'div[data-property="' + propertyName + '"][rel="' + rel + '"]' : null;
    if (inst.debugOn) {
      console.debug((new Date().getTime() - start) + '  addNewDoc 05 ');
    }
    // nascondo l'oggetto del click e carico la risorsa successiva
    ele.hide();
    if (!exist) {
      if (inst.debugOn) {
        console.debug((new Date().getTime() - start) + '  addNewDoc 06 ');
      }
      var pos = parseInt(ele.attr('data-circlePos'), 10);
      var parts = parseInt(ele.attr('data-circleParts'), 10);
      var chordsListExpand = inst.circleChords(parts > 10 ? (pos % 2 > 0 ? originalCircus.width() * 3 : originalCircus.width() * 2) : originalCircus.width() * 5 / 2, parts, originalCircus.position().left + obj.width() / 2, originalCircus.position().top + originalCircus.height() / 2, null, pos);
      inst.context.append(newObj);
      //FIXME: eliminate inline CSS where possible
      newObj.css({
        left : (chordsListExpand[0][0] - newObj.height() / 2),
        top : (chordsListExpand[0][1] - newObj.width() / 2),
        opacity : 1,
        zIndex : 99
      });

      if (inst.debugOn) {
        console.debug((new Date().getTime() - start) + '  addNewDoc 07 ');
      }
      if (!isInverse) {
        if (inst.debugOn) {
          console.debug((new Date().getTime() - start) + '  addNewDoc 08 ');
        }
        if (inst.doInverse) {
          inst.openDoc(rel, newObj, fromInverse);
        } else {
          inst.openDoc(rel, newObj);
        }
        inst.drawaLine(obj, newObj, propertyName);
      } else {
        if (debugOn) {
          console.debug((new Date().getTime() - start) + '  addNewDoc 09 ');
        }
        inst.openDoc(rel, newObj, fromInverse);
      }
    } else {
      if (!isInverse) {
        if (inst.debugOn) {
          console.debug((new Date().getTime() - start) + '  addNewDoc 10 ');
        }
        inst.drawaLine(obj, newObj, propertyName);
      } else {
        if (inst.debugOn) {
          console.debug((new Date().getTime() - start) + '  addNewDoc 11 ');
        }
      }
    }
    //TODO: why is there a callback if this is not asnyc?
    if (callback) {
      callback();
    }
    if (inst.debugOn) {
      console.debug((new Date().getTime() - start) + '  addNewDoc ');
    }
    return false;
  };

  LodLive.prototype.removeDoc = function(obj, callback) {
    var inst = this;
    var isRoot = inst.context.find(".lodlive-node").length == 1;
    if (isRoot) {
        alert("Cannot Remove Only Box");
        return;
    }
    if (inst.debugOn) {
      start = new Date().getTime();
    }

    inst.context.find('.lodlive-toolbox').remove(); // why remove and not hide?
    
    var id = obj.attr('id');
    inst.queryConsole('remove', {
      uriId : obj.attr('rel')
    });
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

      inst.context.find('div[relmd5=' + id + "]").each(function() {
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

              inst.drawaLine(inst.context.find('#' + generatedRev[int]), inst.context.find('#' + generated[int2]));

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
        inst.queryConsole('show', {
          uriId : obj.attr('rel')
        });
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

  LodLive.prototype.addClick = function(obj, callback) {
    var inst = this;
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

      box.hover(function() {
        inst.msg(box.data('title'), 'show', null, null, box.is('.inverse'));
      }, function() {
        inst.msg(null, 'hide');
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

      box.hover(function() {
        inst.msg(box.attr('data-title'), 'show', null, null, box.is('.inverse'));
      }, function() {
        inst.msg(null, 'hide');
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
          case 'tools': inst.generateTools(el, obj).fadeToggle('fast'); break;
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

  LodLive.prototype.generateTools = function(container, obj) {
    var inst = this, tools = container.find('.lodlive-toolbox');
    if (!tools.length) {
      tools = $('<div class="lodlive-toolbox"></div>').hide();
      jQuery.each(inst.UI.tools, function() {
        var toolConfig = this, t;
        if (toolConfig.builtin) {
          toolConfig = _builtins[toolConfig.builtin];
        }
        if (!toolConfig) return;
        t = jQuery('<div class="innerActionBox" title="' + LodLiveUtils.lang(toolConfig.title) + '"><span class="' + toolConfig.icon + '"></span></div>');
        t.appendTo(tools).on('click', function() { toolConfig.handler.call($(this), obj, inst); });
      });
      var toolWrapper = $('<div class=\"lodlive-toolbox-wrapper\"></div>').append(tools);
      container.append(toolWrapper);
    }
    return tools;
  };

  LodLive.prototype.parseRawResourceDoc = function(destBox, URI) {
    var inst = this;
    if (inst.debugOn) {
      start = new Date().getTime();
    }

    var uris = [];
    var bnodes = [];
    var values = [];
    var def = inst.options['default'];

    if (def) {

      // attivo lo sparql interno basato su sesame
      var res = LodLiveUtils.getSparqlConf('document', def, inst.options).replace(/\{URI\}/ig, URI);
      var url = def.endpoint + '?uri=' + encodeURIComponent(URI) + '&query=' + encodeURIComponent(res);

      if (inst.showInfoConsole) {
        inst.queryConsole('log', {
          title : LodLiveUtils.lang('endpointNotConfiguredSoInternal'),
          text : res,
          uriId : URI
        });
      }

      $.ajax({
        url : url,
        contentType: 'application/json',
        accepts: inst.options.connection['http:'].accepts,
        dataType: inst.getAjaxDataType(),
        beforeSend : function() {
          inst.context.append(destBox);
          destBox.html('<img style=\"margin-left:' + (destBox.width() / 2) + 'px;margin-top:147px\" src="img/ajax-loader-gray.gif"/>');
          destBox.css({
            position : 'fixed',
            right: 20,
            top : 0
          });
          destBox.attr('data-top', destBox.position().top);
        },

        success : function(json) {
          json = json.results && json.results.bindings;
          $.each(json, function(key, value) {
             //Fixed
                var key = value[ 'property'][ 'value'];
                var obj = {};
                obj[key] = escape(value.object.value);
                if (value.object.type === 'uri') {
                    uris.push(obj);
                } else if (value.object.type == 'bnode') {
                    bnodes.push(obj);
                } else {
                    values.push(obj);
                }
          });

          destBox.html('');
          if (inst.debugOn) {
            console.debug(URI + '   ');
            console.debug(values);
          }

          inst.formatDoc(destBox, values, uris, bnodes, URI);
        },
        error : function(e, b, v) {
          destBox.html('');
          // not sure what this says, should it be a configurable message?
          values = [{
            'http://system/msg' : 'risorsa non trovata: ' + destBox.attr('rel')
          }];
          inst.formatDoc(destBox, values, uris, bnodes, URI);
        }
      });
    }
    if (inst.debugOn) {
      console.debug((new Date().getTime() - start) + '  parseRawResourceDoc ');
    }
  };

  /**
    * Default function for showing info on a selected node.  Simply opens a panel that displays it's properties.  Calling it without an object will close it.
    * @param {Object=} obj a jquery wrapped DOM element that is a node, or null.  If null is passed then it will close any open doc info panel
   **/
  LodLive.prototype.docInfo = function(obj) {
    var inst = this, URI, docInfo = inst.container.find('.lodlive-docinfo');

    if (obj == null || ((URI = obj.attr('rel')) && docInfo.is('[rel="'+ URI + '"]'))) {
      console.log('hiding');
      docInfo.fadeOut('fast').removeAttr('rel');
      return;
    }

    URI = obj.attr('rel');

    if (!docInfo.length) {
      docInfo = $('<div class="lodlive-docinfo" rel="' + URI + '"></div>');
      inst.container.append(docInfo);
    }

    var URI = obj.attr('rel');
    docInfo.attr('rel', URI);

    // predispongo il div contenente il documento

    var SPARQLquery = inst.composeQuery(URI, 'document');
    var uris = [];
    var bnodes = [];
    var values = [];
    if (SPARQLquery.indexOf('http://system/dummy') === 0) {

      inst.parseRawResourceDoc(docInfo, URI);

    } else {

      $.ajax({
        url : SPARQLquery,
        contentType: 'application/json',
        accepts: inst.options.connection['http:'].accepts,
        dataType: inst.getAjaxDataType(),
        success : function(json) {
          json = json.results && json.results.bindings;

          $.each(json, function(key, value) {
            var newVal = {};
            newVal[value.property.value] = value.object.value;
            if (value.object.type === 'uri') {
              uris.push(newVal);
            } else if (value.object.type == 'bnode') {
              bnodes.push(newVal);
            } else {
              values.push(newVal);
            }
          });

          docInfo.empty().fadeIn();
          inst.formatDoc(docInfo, values, uris, bnodes, URI);
        },
        error : function(e, b, v) {
          destBox.html('');
          values = [{
            'http://system/msg' : 'Could not find document: ' + destBox.attr('rel')
          }];
          inst.formatDoc(docInfo, values, uris, bnodes, URI);
        }
      });
    }

  };

  LodLive.prototype.processDraw = function(x1, y1, x2, y2, canvas, toId) {
    var inst = this, start, lodLiveProfile = inst.options;

    if (inst.debugOn) {
      start = new Date().getTime();
    }
    // recupero il nome della proprieta'
    var label = '';

    var lineStyle = 'standardLine';
    //FIXME:  don't use IDs
    if (inst.context.find("#" + toId).length > 0) {

      label = canvas.attr("data-propertyName-" + toId);

      var labeArray = label.split("\|");

      label = "\n";

      for (var o = 0; o < labeArray.length; o++) {

        if (lodLiveProfile.arrows[$.trim(labeArray[o])]) {
          lineStyle = inst.options.arrows[$.trim(labeArray[o])] + "Line";
        }

        var shortKey = LodLive.shortenKey(labeArray[o]);
        var lastHash = shortKey.lastIndexOf('#');
        var lastSlash = shortKey.lastIndexOf('/');

        if (label.indexOf("\n" + shortKey + "\n") == -1) {
          label += shortKey + "\n";
        }
      }
    }
    //if (lineStyle === 'standardLine') { it appears they all end up back here anyway
    if (lineStyle !== 'isSameAsLine') {

      inst.standardLine(label, x1, y1, x2, y2, canvas, toId);

    } else {
      //TODO: doesn't make sense to have these live in different files.  Should make line drawers an extensible interface
      LodLiveUtils.customLines(inst.context, lineStyle, label, x1, y1, x2, y2, canvas, toId);
    }

    if (inst.debugOn) {
      console.debug((new Date().getTime() - start) + '  processDraw ');
    }
    
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
        inst.drawaLine(obj, inst.context.find('#' + generated[a]));
      }
    }

    if (generatedRev) {
      for (a = 0; a < generatedRev.length; a++) {
        generated = inst.storeIds['gen' + generatedRev[a]];
        $('#line-' + generatedRev[a]).clearCanvas();
        if (generated) {
          for (var a2 = 0; a2 < generated.length; a2++) {
            inst.drawaLine(inst.context.find('#' + generatedRev[a]), inst.context.find('#' + generated[a2]));
          }
        }
      }
    }

  };

  LodLive.prototype.drawaLine = function(from, to, propertyName) {
    var inst = this, start;
    if (inst.debugOn) {
      start = new Date().getTime();
    }

    var pos1 = from.position();
    var pos2 = to.position();
    var aCanvas = $("#line-" + from.attr("id"));
    // console.debug(new Date().getTime()+'moving - '+(new Date())+" -
    // #line-" +
    // from.attr("id") + "-" + to.attr("id"))
    if (aCanvas.length == 1) {
      if (propertyName) {
        aCanvas.attr("data-propertyName-" + to.attr("id"), propertyName);
      }
      inst.processDraw(pos1.left + from.width() / 2, pos1.top + from.height() / 2, pos2.left + to.width() / 2, pos2.top + to.height() / 2, aCanvas, to.attr("id"));
    } else {
      aCanvas = $("<canvas data-propertyName-" + to.attr("id") + "=\"" + propertyName + "\" height=\"" + inst.context.height() + "\" width=\"" + inst.context.width() + "\" id=\"line-" + from.attr("id") + "\"></canvas>");
      inst.context.append(aCanvas);
      aCanvas.css({
        'position' : 'absolute',
        'zIndex' : '0',
        'top' : 0,
        'left' : 0
      });
      inst.processDraw(pos1.left + from.width() / 2, pos1.top + from.height() / 2, pos2.left + to.width() / 2, pos2.top + to.height() / 2, aCanvas, to.attr("id"));
    }

    if (inst.debugOn) {
      console.debug((new Date().getTime() - start) + '  drawaLine ');
    }
  };

  LodLive.prototype.formatDoc = function(destBox, values, uris, bnodes, URI) {
    var inst = this;

    if (inst.debugOn) {
      console.debug("formatDoc " + 0);
      start = new Date().getTime();
    }

    //TODO:  Some of these seem like they should be Utils functions instead of on the instance, not sure yet
    // recupero il doctype per caricare le configurazioni specifiche
    var docType = inst.getJsonValue(uris, 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'default');
    // carico le configurazioni relative allo stile
    destBox.addClass(inst.getProperty("document", "className", docType));
    // ed ai path degli oggetti di tipo immagine
    var images = inst.getProperty("images", "properties", docType);
    // ed ai path dei link esterni
    var weblinks = inst.getProperty("weblinks", "properties", docType);
    // ed eventuali configurazioni delle proprietÃ  da mostrare
    // TODO: fare in modo che sia sempre possibile mettere il dominio come fallback
    var propertiesMapper = inst.getProperty("document", "propertiesMapper", URI.replace(/(http:\/\/[^\/]+\/).+/, "$1"));

    // se la proprieta' e' stata scritta come stringa la trasformo in un
    // array
    if (!Array.isArray(images)) {
      images = [images];
    }
    if (!Array.isArray(weblinks)) {
      weblinks = [weblinks];
    }

    var result = "<div></div>";
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
      console.debug("formatDoc " + 1);
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
      console.debug("formatDoc " + 2);
    }

    // aggiungo al box le immagini correlate
    var imagesj = null;
    if (connectedImages.length > 0) {
      imagesj = $('<div class="section" style="height:80px"></div>');
      $.each(connectedImages, function(key, value) {
        for (var akey in value) {
          imagesj.append("<a class=\"relatedImage\" href=\"" + unescape(value[akey]) + "\"><img src=\"" + unescape(value[akey]) + "\"/></a> ");
        }
      });
    }

    if (inst.debugOn) {
      console.debug("formatDoc " + 3);
    }

    var webLinkResult = null;
    // aggiungo al box i link esterni correlati
    if (connectedWeblinks.length > 0) {
      webLinkResult = "<div class=\"section\"><ul style=\"padding:0;margin:0;display:block;overflow:hidden;tex-overflow:ellipses\">";
      $.each(connectedWeblinks, function(key, value) {
        for (var akey in value) {
          webLinkResult += "<li><a class=\"relatedLink\" target=\"_blank\" data-title=\"" + akey + " \n " + unescape(value[akey]) + "\" href=\"" + unescape(value[akey]) + "\">" + unescape(value[akey]) + "</a></li>";
        }
      });
      webLinkResult += "</ul></div>";
      // jContents.append(webLinkResult);
    }

    if (inst.debugOn) {
      console.debug("formatDoc " + 4);
    }
    // aggiungo al box le informazioni descrittive della risorsa
    var jContents = $('<div></div>');

    if (inst.debugOn) {
      console.debug("formatDoc " + 5);
    }

    if (types.length > 0) {
      var jSection = $("<div class=\"section\"><label data-title=\"http://www.w3.org/1999/02/22-rdf-syntax-ns#type\">type</label><div></div></div>");

      jSection.find('label').each(function() {
        var lbl = $(this);
        lbl.hover(function() {
          inst.msg(lbl.attr('data-title'), 'show');
        }, function() {
          inst.msg(null, 'hide');
        });
      });

      for (var int = 0; int < types.length; int++) {
        var shortKey = LodLive.shortenKey(types[int]);
        // is this really appended to ALL children divs or we looking for something specific?
        jSection.children('div').append("<span title=\"" + types[int] + "\">" + shortKey + " </span>");
      }

      jContents.append(jSection);
    }

    if (inst.debugOn) {
      console.debug("formatDoc " + 6);
    }

    if (imagesj) {
      jContents.append(imagesj);
    }

    if (webLinkResult) {
      //TODO: delegate hover
      var jWebLinkResult = $(webLinkResult);
      jWebLinkResult.find('a').each(function() {
        $(this).hover(function() {
          inst.msg($(this).attr('data-title'), 'show');
        }, function() {
          inst.msg(null, 'hide');
        });
      });
      jContents.append(jWebLinkResult);
    }

    if (inst.debugOn) {
      console.debug("formatDoc " + 7);
    }

    if (propertiesMapper) {
      $.each(propertiesMapper, function(filter, label) {
        //show all properties
        $.each(contents, function(key, value) {
          for (var akey in value) {
            if (filter == akey) {
              var shortKey = label;
              try {
                var jSection = $("<div class=\"section\"><label data-title=\"" + akey + "\">" + shortKey + "</label><div>" + unescape(value[akey]) + "</div></div>");
                jSection.find('label').each(function() {
                  $(this).hover(function() {
                    inst.msg($(this).attr('data-title'), 'show');
                  }, function() {
                    inst.msg(null, 'hide');
                  });
                });
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

            var jSection = $("<div class=\"section\"><label data-title=\"" + akey + "\">" + shortKey + "</label><div>" + unescape(value[akey]) + "</div></div>");
            jSection.find('label').each(function() {
              $(this).hover(function() {
                inst.msg($(this).attr('data-title'), 'show');
              }, function() {
                inst.msg(null, 'hide');
              });
            });
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

          var jBnode = $("<div class=\"section\"><label data-title=\"" + akey + "\">" + shortKey + "</label><span class=\"bnode\"></span></div><div class=\"separ sprite\"></div>");
          jBnode.find('label').each(function() {
            $(this).hover(function() {
              inst.msg($(this).attr('data-title'), 'show');
            }, function() {
              inst.msg(null, 'hide');
            });
          });
          inst.resolveBnodes(unescape(value[akey]), URI, jBnode, jContents);

        }
      });
    }

    if (contents.length == 0 && bnodes.length == 0) {
      var jSection = $("<div class=\"section\"><label data-title=\"" + LodLiveUtils.lang('resourceMissingDoc') + "\"></label><div>" + LodLiveUtils.lang('resourceMissingDoc') + "</div></div><div class=\"separ sprite\"></div>");
      jSection.find('label').each(function() {
        $(this).hover(function() {
          inst.msg($(this).attr('data-title'), 'show');
        }, function() {
          inst.msg(null, 'hide');
        });
      });
      jContents.append(jSection);
    }

    destBox.append(jResult);
    destBox.append(jContents);
    // destBox.append("<div class=\"separLast\"></div>");

    // aggiungo le funzionalita' per la visualizzazione delle immagini
    //FIXME: consolidate this
    jContents.find(".relatedImage").each(function() {
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
          $(this).attr("title", LodLiveUtils.lang('noImage') + " \n" + $(this).attr("src"));
          $(this).attr("src", "img/immagine-vuota-" + $.jStorage.get('selectedLanguage') + ".png");
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
  }

  LodLive.prototype.resolveBnodes = function(val, URI, destBox, jContents) {
    var inst = this;

    if (inst.debugOn) {
      start = new Date().getTime();
    }

    var SPARQLquery = inst.composeQuery(val, 'bnode', URI);

    $.ajax({
      url : SPARQLquery,
      contentType: 'application/json',
      accepts: inst.options.connection['http:'].accepts,
      dataType: inst.getAjaxDataType(),
      beforeSend : function() {
        destBox.find('span[class=bnode]').html('<img src="img/ajax-loader-black.gif"/>');

      },
      success : function(json) {
        destBox.find('span[class=bnode]').html('');
        json = json['results']['bindings'];
        $.each(json, function(key, value) {
          var shortKey = LodLive.shortenKey(value.property.value);
          if (value.object.type == 'uri') {

          } else if (value.object.type == 'bnode') {
            var jBnode = $("<span><label data-title=\"" + value.property.value + "\"> / " + shortKey + "</label><span class=\"bnode\"></span></span>");
            jBnode.find('label').each(function() {
              $(this).hover(function() {
                inst.msg($(this).attr('data-title'), 'show');
              }, function() {
                inst.msg(null, 'hide');
              });
            });
            destBox.find('span[class=bnode]').attr("class", "").append(jBnode);
            inst.resolveBnodes(value.object.value, URI, destBox, jContents);
          } else {
            destBox.find('span[class=bnode]').append('<div><em title="' + value.property.value + '">' + shortKey + "</em>: " + value.object.value + '</div>');
            // destBox.find('span[class=bnode]').attr("class",
            // "");
          }
          jContents.append(destBox);
          if (jContents.height() + 40 > $(window).height()) {
            jContents.slimScroll({
              height : $(window).height() - 40,
              color : '#fff'
            });
            jContents.parent().find("div.separLast").remove();
          } else {
            jContents.parent().append("<div class=\"separLast\"></div>");
          }
        });
      },
      error : function(e, b, v) {
        destBox.find('span').html('');

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

		if (inst.debugOn) {
			start = new Date().getTime();
		}
		var containerBox = destBox.parent('div');
    var anchorBox = containerBox.find('.ll-node-anchor');
		var thisUri = containerBox.attr('rel') || '';

		// recupero il doctype per caricare le configurazioni specifiche
		var docType = inst.getJsonValue(uris, 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'default');
		if (thisUri.indexOf("~~") != -1) {
			docType = 'bnode';
		}
		// carico le configurazioni relative allo stile
		var aClass = inst.getProperty("document", "className", docType);
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
		var titles = inst.getProperty("document", "titleProperties", docType);
		// ed ai path degli oggetti di tipo immagine
		var images = inst.getProperty("images", "properties", docType);
		// ed ai path dei link esterni
		var weblinks = inst.getProperty("weblinks", "properties", docType);
		// e le latitudini
		var lats = inst.getProperty("maps", "lats", docType);
		// e le longitudini
		var longs = inst.getProperty("maps", "longs", docType);
		// e punti
		var points = inst.getProperty("maps", "points", docType);

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
		var result = "<div class=\"boxTitle\"><span class=\"ellipsis_text\">";
		for (var a = 0; a < titles.length; a++) {
			var resultArray = inst.getJsonValue(values, titles[a], titles[a].indexOf('http') == 0 ? '' : titles[a]);
			if (titles[a].indexOf('http') != 0) {
				if (result.indexOf($.trim(unescape(titles[a])) + " \n") == -1) {
					result += $.trim(unescape(titles[a])) + " \n";
				}
			} else {
				for (var af = 0; af < resultArray.length; af++) {
					if (result.indexOf(unescape(resultArray[af]) + " \n") == -1) {
						result += unescape(resultArray[af]) + " \n";
					}
				}
			}

		}
    var dataEndpoint = containerBox.attr("data-endpoint") || '';
		if ((values.length == 0 && uris.length == 0) || dataEndpoint.indexOf("http://system/dummy") == 0) {
			if (containerBox.attr("data-endpoint").indexOf("http://system/dummy") != -1) {
				containerBox.attr("data-endpoint", LodLiveUtils.lang('endpointNotConfigured'));
			}
			if (uris.length == 0 && values.length == 0) {
				result = "<div class=\"boxTitle\" data-tooltip=\"" + LodLiveUtils.lang('resourceMissing') + "\"><a target=\"_blank\" href=\"" + thisUri + "\"><span class=\"spriteLegenda\"></span>" + thisUri + "</a>";
			}
		}
		result += "</span></div>";
		var jResult = $(result);
		if (jResult.text() == '' && docType == 'bnode') {
			jResult.text('[blank node]');
		} else if (jResult.text() == '') {
      var titleDef = "(Error)";
      try {
          titleDef = inst.options.default.document.titleName[thisUri];
      }catch(ex) {
          titleDef = inst.options.default.document.titleProperties[thisUri];
      }
      if(titleDef){
          jResult.text(titleDef)
      } else {
        jResult.text(LodLiveUtils.lang('noName'));
      }
		}
		destBox.append(jResult);
		var resourceTitle = jResult.text();
    jResult.data('tooltip', resourceTitle);

		destBox.hover(function() {
        var msgTitle = jResult.text();
        console.log('destbox hover title', msgTitle);
			inst.msg(msgTitle, 'show', 'fullInfo', containerBox.attr("data-endpoint"));
		}, function() {
			inst.msg(null, 'hide');
		});

		// calcolo le uri e le url dei documenti correlati
		var connectedDocs = [];
		var invertedDocs = [];
		var propertyGroup = {};
		var propertyGroupInverted = {};

		var connectedImages = [];
		var connectedLongs = [];
		var connectedLats = [];

		var sameDocControl = [];
		$.each(uris, function(key, value) {
			for (var akey in value) {

				// escludo la definizione della classe, le proprieta'
				// relative alle immagini ed ai link web
				if (lodLiveProfile.uriSubstitutor) {
					$.each(lodLiveProfile.uriSubstitutor, function(skey, svalue) {
						value[akey] = value[akey].replace(svalue.findStr, svalue.replaceStr);
					});
				}
				if ($.inArray(akey, images) > -1) {
          //FIXME: replace eval
					eval('connectedImages.push({\'' + value[akey] + '\':\'' + escape(resourceTitle) + '\'})');

				} else if ($.inArray(akey, weblinks) == -1) {

					// controllo se trovo la stessa relazione in una
					// proprieta' diversa
					if ($.inArray(value[akey], sameDocControl) > -1) {

						var aCounter = 0;
						$.each(connectedDocs, function(key2, value2) {
							for (var akey2 in value2) {
								if (value2[akey2] == value[akey]) {
									eval('connectedDocs[' + aCounter + '] = {\'' + akey2 + ' | ' + akey + '\':\'' + value[akey] + '\'}');
								}
							}
							aCounter++;
						});

					} else {
            //FIXME: replace eval
						eval('connectedDocs.push({\'' + akey + '\':\'' + value[akey] + '\'})');
						sameDocControl.push(value[akey]);
					}

				}
			}

		});

		if (inverses) {
			sameDocControl = [];
			$.each(inverses, function(key, value) {
				for (var akey in value) {
					if (docType == 'bnode' && value[akey].indexOf("~~") != -1) {
						continue;
					}
					if (lodLiveProfile.uriSubstitutor) {
						$.each(lodLiveProfile.uriSubstitutor, function(skey, svalue) {
							value[akey] = value[akey].replace(escape(svalue.findStr), escape(svalue.replaceStr));
						});
					}
					// controllo se trovo la stessa relazione in una
					// proprieta' diversa
					if ($.inArray(value[akey], sameDocControl) > -1) {
						var aCounter = 0;
						$.each(invertedDocs, function(key2, value2) {
							for (var akey2 in value2) {
								if (value2[akey2] == value[akey]) {
									var theKey = akey2;
									if (akey2 != akey) {
										theKey = akey2 + ' | ' + akey;
									}
									eval('invertedDocs[' + aCounter + '] = {\'' + theKey + '\':\'' + value[akey] + '\'}');
									return false;
								}
							}
							aCounter++;
						});
					} else {
						eval('invertedDocs.push({\'' + akey + '\':\'' + value[akey] + '\'})');
						sameDocControl.push(value[akey]);
					}

				}
			});
		}
		if (inst.doDrawMap) {
			for (var a = 0; a < points.length; a++) {
				var resultArray = inst.getJsonValue(values, points[a], points[a]);
				for (var af = 0; af < resultArray.length; af++) {
					if (resultArray[af].indexOf(" ") != -1) {
						eval('connectedLongs.push(\'' + unescape(resultArray[af].split(" ")[1]) + '\')');
						eval('connectedLats.push(\'' + unescape(resultArray[af].split(" ")[0]) + '\')');
					} else if (resultArray[af].indexOf("-") != -1) {
						eval('connectedLongs.push(\'' + unescape(resultArray[af].split("-")[1]) + '\')');
						eval('connectedLats.push(\'' + unescape(resultArray[af].split("-")[0]) + '\')');
					}
				}
			}
			for (var a = 0; a < longs.length; a++) {
				var resultArray = inst.getJsonValue(values, longs[a], longs[a]);
				for (var af = 0; af < resultArray.length; af++) {
					eval('connectedLongs.push(\'' + unescape(resultArray[af]) + '\')');
				}
			}
			for (var a = 0; a < lats.length; a++) {
				var resultArray = inst.getJsonValue(values, lats[a], lats[a]);
				for (var af = 0; af < resultArray.length; af++) {
					eval('connectedLats.push(\'' + unescape(resultArray[af]) + '\')');
				}
			}

			if (connectedLongs.length > 0 && connectedLats.length > 0) {
				var mapsMap = inst.mapsMap;
				mapsMap[containerBox.attr("id")] = {
					longs : connectedLongs[0],
					lats : connectedLats[0],
					title : thisUri + "\n" + escape(resourceTitle)
				};
				inst.updateMapPanel(inst.context.find('.lodlive-controlPanel'));
			}
		}
		if (inst.doCollectImages) {
			if (connectedImages.length > 0) {
				var imagesMap = inst.imagesMap;
				imagesMap[containerBox.attr("id")] = connectedImages;
				inst.updateImagePanel(inst.context.find('.lodlive-controlPanel'));
			}
		}
		var totRelated = connectedDocs.length + invertedDocs.length;

		// se le proprieta' da mostrare sono troppe cerco di accorpare
		// quelle uguali
		if (totRelated > 16) {
			$.each(connectedDocs, function(key, value) {
				for (var akey in value) {
					if (propertyGroup[akey]) {
						var t = propertyGroup[akey];
						t.push(value[akey]);
						propertyGroup[akey] = t;
					} else {
						propertyGroup[akey] = [value[akey]];
					}
				}
			});
			$.each(invertedDocs, function(key, value) {
				for (var akey in value) {
					if (propertyGroupInverted[akey]) {
						var t = propertyGroupInverted[akey];
						t.push(value[akey]);
						propertyGroupInverted[akey] = t;
					} else {
						propertyGroupInverted[akey] = [value[akey]];
					}
				}
			});
			totRelated = 0;
			for (var prop in propertyGroup) {
				if (propertyGroup.hasOwnProperty(prop)) {
					totRelated++;
				}
			}
			for (var prop in propertyGroupInverted) {
				if (propertyGroupInverted.hasOwnProperty(prop)) {
					totRelated++;
				}
			}
		}

		// calcolo le parti in cui dividere il cerchio per posizionare i
		// link
		// var chordsList = this.lodlive('circleChords',
		// destBox.width() / 2 + 12, ((totRelated > 1 ? totRelated - 1 :
		// totRelated) * 2) + 4, destBox.position().left + destBox.width() /
		// 2, destBox.position().top + destBox.height() / 2, totRelated +
		// 4);
    //
		var chordsList = inst.circleChords(75, 24, destBox.position().left + 65, destBox.position().top + 65);
		var chordsListGrouped = inst.circleChords(95, 36, destBox.position().left + 65, destBox.position().top + 65);
		// aggiungo al box i link ai documenti correlati
		var a = 1;
		var inserted = {};
		var counter = 0;
		var innerCounter = 1;

		var objectList = [];
		var innerObjectList = [];
		$.each(connectedDocs, function(key, value) {
			if (counter == 16) {
				counter = 0;
			}
			if (a == 1) {
			} else if (a == 15) {
				a = 1;
			}
			for (var akey in value) {
				var obj = null;
				if (propertyGroup[akey] && propertyGroup[akey].length > 1) {
					if (!inserted[akey]) {
						innerCounter = 1;
						inserted[akey] = true;
						var objBox = $("<div class=\"groupedRelatedBox\" rel=\"" + MD5(akey) + "\" data-property=\"" + akey + "\"  data-title=\"" + akey + " \n " + (propertyGroup[akey].length) + " " + LodLiveUtils.lang('connectedResources') + "\" ></div>");
						objBox.css(inst.getRelationshipCSS(akey));
            // containerBox.append(objBox);
						var akeyArray = akey.split(" ");
						if (unescape(propertyGroup[akey][0]).indexOf('~~') != -1) {
							objBox.addClass('isBnode');
						} else {
							for (var i = 0; i < akeyArray.length; i++) {
								if (lodLiveProfile.arrows[akeyArray[i]]) {
									objBox.addClass(lodLiveProfile.arrows[akeyArray[i]]);
								}
							}
						}
						objBox.css({
              'top':  (chordsList[a][1] - 8) + 'px',
              'left': (chordsList[a][0] - 8) + 'px'
            });
						objectList.push(objBox);

						a++;
						counter++;
					}

					if (innerCounter < 25) {
						obj = $("<div class=\"aGrouped relatedBox " + MD5(akey) + " " + MD5(unescape(value[akey])) + "\" rel=\"" + unescape(value[akey]) + "\"  data-title=\"" + akey + " \n " + unescape(value[akey]) + "\" ></div>");
						// containerBox.append(obj);
						obj.attr('style', 'display:none;position:absolute;top:' + (chordsListGrouped[innerCounter][1] - 8) + 'px;left:' + (chordsListGrouped[innerCounter][0] - 8) + 'px');
						obj.attr("data-circlePos", innerCounter);
						obj.attr("data-circleParts", 36);
						obj.attr("data-circleid", containerBox.attr('id'));
					}
	
					innerCounter++;
				} else {
					obj = $("<div class=\"relatedBox " + MD5(unescape(value[akey])) + "\" rel=\"" + unescape(value[akey]) + "\"   data-title=\"" + akey + ' \n ' + unescape(value[akey]) + "\" ></div>");
					// containerBox.append(obj);
					obj.attr('style', 'top:' + (chordsList[a][1] - 8) + 'px;left:' + (chordsList[a][0] - 8) + 'px');
					obj.attr("data-circlePos", a);
					obj.attr("data-circleParts", 24);
					a++;
					counter++;
				}
				if (obj) {
					obj.attr("data-circleid", containerBox.attr('id'));
					obj.attr("data-property", akey);
          obj.css(inst.getRelationshipCSS(akey));
					// se si tratta di un  Bnode applico una classe diversa
					var akeyArray = akey.split(" ");
					if (obj.attr('rel').indexOf('~~') != -1) {
						obj.addClass('isBnode');
					} else {
						for (var i = 0; i < akeyArray.length; i++) {
							if (lodLiveProfile.arrows[akeyArray[i]]) {
								obj.addClass(lodLiveProfile.arrows[akeyArray[i]]);
							}
						}
					}
					if (obj.hasClass("aGrouped")) {
						innerObjectList.push(obj);
					} else {
						objectList.push(obj);
					}
				}
			}

		});

		inserted = {};
		$.each(invertedDocs, function(key, value) {
			if (counter == 16) {
				counter = 0;
			}
			if (a == 1) {
			} else if (a == 15) {
				a = 1;
			}
			for (var akey in value) {
				var obj = null;
				if (propertyGroupInverted[akey] && propertyGroupInverted[akey].length > 1) {
					if (!inserted[akey]) {
						innerCounter = 1;
						inserted[akey] = true;

						var objBox = $("<div class=\"groupedRelatedBox inverse\" rel=\"" + MD5(akey) + "-i\"   data-property=\"" + akey + "\" data-title=\"" + akey + " \n " + (propertyGroupInverted[akey].length) + " " + LodLiveUtils.lang('connectedResources') + "\" ></div>");
            objBox.css(inst.getRelationshipCSS(akey));
						// containerBox.append(objBox);
						var akeyArray = akey.split(" ");
						if (unescape(propertyGroupInverted[akey][0]).indexOf('~~') != -1) {
							objBox.addClass('isBnode');
						} else {
							for (var i = 0; i < akeyArray.length; i++) {
								if (lodLiveProfile.arrows[akeyArray[i]]) {
									objBox.addClass(lodLiveProfile.arrows[akeyArray[i]]);
								}
							}
						}
						objBox.css({
              'top': + (chordsList[a][1] - 8) + 'px',
              'left': + (chordsList[a][0] - 8) + 'px'
            });

						objectList.push(objBox);
						a++;
						counter++;
					}

					if (innerCounter < 25) {
						var destUri = unescape(value[akey].indexOf('~~') == 0 ? thisUri + value[akey] : value[akey]);
						obj = $("<div class=\"aGrouped relatedBox inverse " + MD5(akey) + "-i " + MD5(unescape(value[akey])) + " \" rel=\"" + destUri + "\"  data-title=\"" + akey + " \n " + unescape(value[akey]) + "\" ></div>");
						// containerBox.append(obj);
						obj.attr('style', 'display:none;position:absolute;top:' + (chordsListGrouped[innerCounter][1] - 8) + 'px;left:' + (chordsListGrouped[innerCounter][0] - 8) + 'px');
						obj.attr("data-circlePos", innerCounter);
						obj.attr("data-circleParts", 36);
						obj.attr("data-circleId", containerBox.attr('id'));
					}

					innerCounter++;
				} else {
					obj = $("<div class=\"relatedBox inverse " + MD5(unescape(value[akey])) + "\" rel=\"" + unescape(value[akey]) + "\"   data-title=\"" + akey + ' \n ' + unescape(value[akey]) + "\" ></div>");
					// containerBox.append(obj);
					obj.attr('style', 'top:' + (chordsList[a][1] - 8) + 'px;left:' + (chordsList[a][0] - 8) + 'px');
					obj.attr("data-circlePos", a);
					obj.attr("data-circleParts", 24);
					a++;
					counter++;
				}
				if (obj) {
					obj.attr("data-circleId", containerBox.attr('id'));
					obj.attr("data-property", akey);
          obj.css(inst.getRelationshipCSS(akey));
					// se si tratta di un sameas applico una classe diversa
					var akeyArray = akey.split(" ");

					if (obj.attr('rel').indexOf('~~') != -1) {
						obj.addClass('isBnode');
					} else {
						for (var i = 0; i < akeyArray.length; i++) {
							if (lodLiveProfile.arrows[akeyArray[i]]) {
								obj.addClass(lodLiveProfile.arrows[akeyArray[i]]);
							}
						}
					}

					if (obj.hasClass("aGrouped")) {
						innerObjectList.push(obj);
					} else {
						objectList.push(obj);
					}
				}
			}

		});
		var page = 0;
		var totPages = objectList.length > 14 ? (objectList.length / 14 + (objectList.length % 14 > 0 ? 1 : 0)) : 1;
		for (var i = 0; i < objectList.length; i++) {
			if (i % 14 == 0) {
				page++;
				var aPage = $('<div class="page page' + page + '" style="display:none"></div>');
				if (page > 1 && totPages > 1) {
					aPage.append("<div class=\"llpages pagePrev sprite\" data-page=\"page" + (page - 1) + "\" style=\"top:" + (chordsList[0][1] - 8) + "px;left:" + (chordsList[0][0] - 8) + "px\"></div>");
				}
				if (totPages > 1 && page < totPages - 1) {
					aPage.append("<div class=\"llpages pageNext sprite\" data-page=\"page" + (page + 1) + "\" style=\"top:" + (chordsList[15][1] - 8) + "px;left:" + (chordsList[15][0] - 8) + "px\"></div>");
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
				$(this).parent().children('.' + llpages.attr("data-page")).fadeIn('fast');
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
			console.debug((new Date().getTime() - start) + '	format ');
		}
	};

  var _builtinTools = {
    'docInfo': '<div class="actionBox docInfo" rel="docInfo"><span class="fa fa-list"></span></div>',
    'tools': '<div class="actionBox tools" rel="tools"><span class="fa fa-cog"></span></div>'
  }

  LodLive.prototype.openDoc = function(anUri, destBox, fromInverse) {
    var inst = this;

    if (!anUri) { 
      $.error('LodLive: no uri for openDoc');
    }

		if (inst.debugOn) {
			start = new Date().getTime();
		}

		var uris = [];
		var values = [];
		if (inst.showInfoConsole) {
			inst.queryConsole('init', {
				uriId : anUri
			});
			inst.queryConsole('log', {
				uriId : anUri,
				resource : anUri
			});
		}

    if (inst.debugOn) console.log('composing query with anUri', anUri);
    //TODO: composeQuery looks like a static function, look into it
		var SPARQLquery = inst.composeQuery(anUri, 'documentUri');

		if (inst.doStats) {
			methods.doStats(anUri);
		}

		if (SPARQLquery.indexOf("endpoint=") != -1) {

			var endpoint = SPARQLquery.substring(SPARQLquery.indexOf("endpoint=") + 9);
			endpoint = endpoint.substring(0, endpoint.indexOf("&"));
			destBox.attr("data-endpoint", endpoint);

		} else {

			destBox.attr("data-endpoint", SPARQLquery.substring(0, SPARQLquery.indexOf("?")));

		}
    //TODO: is system/dummy just a flag that it should guess? If so, maybe just set a property on the query object called shouldGuess = true
		if (SPARQLquery.indexOf("http://system/dummy") == 0) {

			// guessing endpoint from URI
			inst.guessingEndpoint(anUri, function() {

				inst.openDoc(anUri, destBox, fromInverse);

			}, function() {

				inst.parseRawResource(destBox, anUri, fromInverse);

			});

		} else {

      //TODO: remove jQuery jsonp dependency
			$.ajax({
				url : SPARQLquery,
        contentType: 'application/json',
        accepts: inst.options.connection['http:'].accepts,
        dataType: inst.getAjaxDataType(),
				beforeSend : function() {
					destBox.children('.box').html('<img style=\"margin-top:' + (destBox.children('.box').height() / 2 - 8) + 'px\" src="img/ajax-loader.gif"/>');
				},
				success : function(json) {
          // console.log('sparql success', json);
					json = json.results && json.results.bindings;
					var conta = 0;
					$.each(json, function(key, value) {
            var newVal = {}, newUri = {};
            conta++;
						if (value.object.type === 'uri' || value.object.type === 'bnode') {
							if (value.object.value != anUri && (value.object.type !== 'bnode' || !inst.ignoreBnodes)) {
                newUri[value.property.value] = (value.object.type === 'bnode') ? escape(anUri + '~~' + value.object.value) : escape(value.object.value);
                uris.push(newUri);
							}
						} else {
              newVal[value.property.value] = escape(value.object.value);
              values.push(newVal);
						}

					});
					if (inst.showInfoConsole) {
						inst.queryConsole('log', {
							founded : conta,
							id : SPARQLquery,
							uriId : anUri
						});
					}
					if (inst.debugOn) {
						console.debug((new Date().getTime() - start) + '	openDoc eval uris & values');
					}
					destBox.children('.box').html('');
					if (inst.doInverse) {
						SPARQLquery = inst.composeQuery(anUri, 'inverse');

						var inverses = [];
						$.ajax({
							url : SPARQLquery,
              contentType: 'application/json',
              accepts: inst.options.connection['http:'].accepts,
              dataType: inst.getAjaxDataType(),
							beforeSend : function() {
								destBox.children('.box').html('<img style=\"margin-top:' + (destBox.children('.box').height() / 2 - 5) + 'px\" src="img/ajax-loader.gif"/>');
							},
							success : function(json) {
								json = json['results']['bindings'];
								var conta = 0;
								$.each(json, function(key, value) {
									conta++;
                  //TODO: replace evals
									eval('inverses.push({\'' + value['property']['value'] + '\':\'' + (value.object.type == 'bnode' ? anUri + '~~' : '') + escape(value.object.value) + '\'})');
								});

								if (inst.showInfoConsole) {

									inst.queryConsole('log', {
										founded : conta,
										id : SPARQLquery,
										uriId : anUri
									});

								}

								if (inst.debugOn) {
									console.debug((new Date().getTime() - start) + '	openDoc inverse eval uris ');
								}

								var callback = function() {
									destBox.children('.box').html('');
									inst.format(destBox.children('.box'), values, uris, inverses);
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
									var counter = 0;
									var tot = Object.keys(lodLiveProfile).length;
									inst.findInverseSameAs(anUri, counter, inverses, callback, tot);
								} else {
									callback();
								}

							},
							error : function(e, b, v) {
								destBox.children('.box').html('');
								inst.format(destBox.children('.box'), values, uris);
								if (inst.showInfoConsole) {
									inst.queryConsole('log', {
										error : 'error',
										id : SPARQLquery,
										uriId : anUri
									});
								}
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
						inst.format(destBox.children('.box'), values, uris);
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
					inst.errorBox(destBox);
				}
			});

		}
		if (inst.debugOn) {
			console.debug((new Date().getTime() - start) + '	openDoc');
		}
	};

  LodLive.prototype.parseRawResource = function(destBox, resource, fromInverse) {

    var inst = this, values = [], uris = [], lodLiveProfile = inst.options;

    if (lodLiveProfile['default']) {
      // attivo lo sparql interno basato su sesame
      var res = LodLiveUtils.getSparqlConf('documentUri', lodLiveProfile['default'], lodLiveProfile).replace(/\{URI\}/ig, resource);
      var url = lodLiveProfile['default'].endpoint + "?uri=" + encodeURIComponent(resource) + "&query=" + encodeURIComponent(res);
      if (inst.showInfoConsole) {
        inst.queryConsole('log', {
          title : LodLiveUtils.lang('endpointNotConfiguredSoInternal'),
          text : res,
          uriId : resource
        });
      }
      $.ajax({
        url : url,
        contentType: 'application/json',
        accepts: inst.options.connection['http:'].accepts,
        dataType: inst.getAjaxDataType(),
        beforeSend : function() {
          destBox.children('.box').html('<img style=\"margin-top:' + (destBox.children('.box').height() / 2 - 8) + 'px\" src="img/ajax-loader.gif"/>');
        },
        success : function(json) {
          json = json['results']['bindings'];
          var conta = 0;
          $.each(json, function(key, value) {
            conta++;
            //TODO: replace eval
            if (value.object.type == 'uri') {
              if (value.object.value != resource) {
                eval('uris.push({\'' + value['property']['value'] + '\':\'' + escape(value.object.value) + '\'})');
              }
            } else {
              eval('values.push({\'' + value['property']['value'] + '\':\'' + escape(value.object.value) + '\'})');
            }
          });

          if (inst.debugOn) {
            console.debug((new Date().getTime() - start) + '  openDoc eval uris & values');
          }

          var inverses = [];
          //FIXME:  here is a callback function, debug to see if it can simply wait for returns because I haven't noticed anything async in the chain
          var callback = function() {
            destBox.children('.box').html('');
            inst.format(destBox.children('.box'), values, uris, inverses);
            inst.addClick(destBox, fromInverse ? function() {
              try {
                $(fromInverse).click();
              } catch (e) {
              }
            } : null);

            if (inst.doAutoExpand) {
              inst.autoExpand(destBox);
            }
          };
          if (inst.doAutoSameas) {
            var counter = 0;
            var tot = Object.keys(lodLiveProfile.connection).length;
            inst.findInverseSameAs(resource, counter, inverses, callback, tot);
          } else {
            callback();
          }

        },
        error : function(e, j, k) {
          // console.debug(e);console.debug(j);
          destBox.children('.box').html('');
          var inverses = [];
          if (fromInverse) {
            eval('uris.push({\'' + fromInverse.replace(/div\[data-property="([^"]*)"\].*/, '$1') + '\':\'' + fromInverse.replace(/.*\[rel="([^"]*)"\].*/, '$1') + '\'})');
          }
          inst.format(destBox.children('.box'), values, uris, inverses);
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

      destBox.children('.box').html('');
      var inverses = [];
      if (fromInverse) {
        eval('uris.push({\'' + fromInverse.replace(/div\[data-property="([^"]*)"\].*/, '$1') + '\':\'' + fromInverse.replace(/.*\[rel="([^"]*)"\].*/, '$1') + '\'})');
      }
      inst.format(destBox.children('.box'), values, uris, inverses);
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
  };

  LodLive.prototype.errorBox = function(destBox) {
    var inst = this;

    destBox.children('.box').addClass("errorBox");
    destBox.children('.box').html('');
    var jResult = $("<div class=\"boxTitle\"><span>" + LodLiveUtils.lang('enpointNotAvailable') + "</span></div>");
    destBox.children('.box').append(jResult);
    destBox.children('.box').hover(function() {
      inst.msg(LodLiveUtils.lang('enpointNotAvailableOrSLow'), 'show', 'fullInfo', destBox.attr("data-endpoint"));
    }, function() {
      inst.msg(null, 'hide');
    });

  };

  LodLive.prototype.allClasses = function(SPARQLquery, destBox, destSelect, template) {
    var inst = this;

    if (inst.debugOn) {
      start = new Date().getTime();
    }

    //TODO: if composeQuery is a static utility function then this can be as well
    SPARQLquery = inst.composeQuery(SPARQLquery, 'allClasses');
    var classes = [];
    $.ajax({
      url : SPARQLquery,
      contentType: 'application/json',
      accepts: inst.options.connection['http:'].accepts,
      dataType: inst.getAjaxDataType(),
      beforeSend : function() {
        destBox.html('<img src="img/ajax-loader.gif"/>');
      },
      success : function(json) {
        destBox.html(LodLiveUtils.lang('choose'));
        json = json.results && json.results.bindings;
        $.each(json, function(key, value) {
          var aclass = json[key].object.value;
          if (aclass.indexOf('http://www.openlinksw.com/') == -1) {
            aclass = aclass.replace(/http:\/\//, "");
            classes.push(aclass);
          }

        });
        for (var i = 0; i < classes.length; i++) {
          destSelect.append(template.replace(/\{CONTENT\}/g, classes[i]));
        }
      },
      error : function(e, b, v) {
        destSelect.append(template.replace(/\{CONTENT\}/g, 'si Ã¨ verificato un errore'));
      }
    });

    if (inst.debugOn) {
      console.debug((new Date().getTime() - start) + '  allClasses');
    }
  };

  LodLive.prototype.findInverseSameAs = function(anUri, counter, inverse, callback, tot) {
    var inst = this, lodLiveProfile = inst.options;

    if (inst.debugOn) {
      start = new Date().getTime();
    }
    var innerCounter = 0;
    $.each(lodLiveProfile.connection, function(key, value) {
      // what is the intent of matching the counter to the argument?  Are we trying to simulate numerical index of object properties when order is not guaranteed? Why not by name?
      if (innerCounter === counter) {
        var skip = false;
        var keySplit = key.split(",");
        if (!value.useForInverseSameAs) {
          skip = true;
        } else {
          for (var a = 0; a < keySplit.length; a++) {
            // salto i sameas interni allo stesso endpoint
            if (anUri.indexOf(keySplit[a]) != -1) {
              skip = true;
            }
          }
        }
        if (skip) {
          counter++;
          if (counter < tot) {
            inst.findInverseSameAs(anUri, counter, inverse, callback, tot);
          } else {
            callback();
          }
          return false;
        }

        var SPARQLquery = value.endpoint + "?" + (value.endpointType ? lodLiveProfile.endpoints[value.endpointType] : lodLiveProfile.endpoints.all) + "&query=" + escape(LodLiveUtils.getSparqlConf('inverseSameAs', value, lodLiveProfile).replace(/\{URI\}/g, anUri));
        if (value.proxy) {
          SPARQLquery = value.proxy + '?endpoint=' + value.endpoint + "&" + (value.endpointType ? lodLiveProfile.endpoints[value.endpointType] : lodLiveProfile.endpoints.all) + "&query=" + escape(LodLiveUtils.getSparqlConf('inverseSameAs', value, lodLiveProfile).replace(/\{URI\}/g, anUri));
        }

        $.ajax({
          url : SPARQLquery,
          timeout : 3000,
          contentType: 'application/json',
          accepts: inst.options.connection['http:'].accepts,
          dataType: inst.getAjaxDataType(),
          beforeSend : function() {
            if (inst.showInfoConsole) {
              inst.queryConsole('log', {
                title : value.endpoint,
                text : LodLiveUtils.getSparqlConf('inverseSameAs', value, lodLiveProfile).replace(/\{URI\}/g, anUri),
                id : SPARQLquery,
                uriId : anUri
              });
            }
          },
          success : function(json) {
            json = json['results']['bindings'];
            var conta = 0;
            $.each(json, function(key, value) {
              conta++;
              if (value.property && value.property.value) {
                eval('inverse.splice(1,0,{\'' + value.property.value + '\':\'' + escape(value.object.value) + '\'})');
              } else {
                eval('inverse.splice(1,0,{\'' + 'http://www.w3.org/2002/07/owl#sameAs' + '\':\'' + escape(value.object.value) + '\'})');
              }
            });
            if (inst.showInfoConsole) {
              inst.queryConsole('log', {
                founded : conta,
                id : SPARQLquery,
                uriId : anUri
              });
            }
            counter++;
            //TODO:  why callbacks and not just return?
            if (counter < tot) {
              inst.findInverseSameAs(anUri, counter, inverse, callback, tot);
            } else {
              callback();
            }
          },

          error : function(e, b, v) {

            if (inst.showInfoConsole) {
              inst.queryConsole('log', {
                error : 'error',
                id : SPARQLquery,
                uriId : anUri
              });
            }
            counter++;
            if (counter < tot) {
              inst.findInverseSameAs(anUri, counter, inverse, callback, tot);
            } else {
              callback();
            }
          }
        });
        if (inst.debugOn) {
          console.debug((new Date().getTime() - start) + '  findInverseSameAs ' + value.endpoint);
        }
      }
      innerCounter++;
    });
    if (inst.debugOn) {
      console.debug((new Date().getTime() - start) + '  findInverseSameAs');
    }
  };

  /** Find the subject
    */
  LodLive.prototype.findSubject = function(SPARQLquery, selectedClass, selectedValue, destBox, destInput) {
    var inst = this, lodLiveProfile = inst.options;

    if (inst.debugOn) {
      start = new Date().getTime();
    }

    $.each(lodLiveProfile.connection, function(key, value) {

      var keySplit = key.split(",");
      for (var a = 0; a < keySplit.length; a++) {
        if (SPARQLquery.indexOf(keySplit[a]) != -1) {
          SPARQLquery = value.endpoint + "?" + (value.endpointType ? lodLiveProfile.endpoints[value.endpointType] : lodLiveProfile.endpoints.all) + "&query=" + escape(LodLiveUtils.getSparqlConf('findSubject', value, lodLiveProfile).replace(/\{CLASS\}/g, selectedClass).replace(/\{VALUE\}/g, selectedValue));
          if (value.proxy) {
            SPARQLquery = value.proxy + "?endpoint=" + value.endpoint + "&" + (value.endpointType ? lodLiveProfile.endpoints[value.endpointType] : lodLiveProfile.endpoints.all) + "&query=" + escape(LodLiveUtils.getSparqlConf('findSubject', value, lodLiveProfile).replace(/\{CLASS\}/g, selectedClass).replace(/\{VALUE\}/g, selectedValue));
          }
        }
      }

    });

    var values = [];

    $.ajax({
      url : SPARQLquery,
      contentType: 'application/json',
      accepts: inst.options.connection['http:'].accepts,
      dataType: inst.getAjaxDataType(),
      beforeSend : function() {
        destBox.html('<img src="img/ajax-loader.gif"/>');
      },
      success : function(json) {
        destBox.html('');
        json = json.results && json.results.bindings;
        $.each(json, function(key, value) {
          values.push(json[key].subject.value);
        });
        for (var i = 0; i < values.length; i++) {
          destInput.val(values[i]);
        }
      },
      error : function(e, b, v) {
        destBox.html('errore: ' + e);
      }
    });

    if (inst.debugOn) {
      console.debug((new Date().getTime() - start) + '  findSubject');
    }
  };

  //TODO: these line drawing methods don't care about the instance, they should live somewhere else
  LodLive.prototype.standardLine = function(label, x1, y1, x2, y2, canvas, toId) {

    // eseguo i calcoli e scrivo la riga di connessione tra i cerchi
    var lineangle = (Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI) + 180;
    var x2bis = x1 - Math.sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1)) + 60;
    //canvas.detectPixelRatio();
    canvas.rotateCanvas({
      rotate : lineangle,
      x : x1,
      y : y1
    }).drawLine({
      strokeStyle : "#fff",
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
      fillStyle : "#606060",
      strokeStyle : "#606060",
      x : (x2bis + x1 + ((x1 + 60) > x2 ? -60 : +60)) / 2,
      y : (y1 + y1 - ((x1 + 60) > x2 ? 18 : -18)) / 2,
      text : label ,
      align : "center",
      strokeWidth : 0.01,
      fontSize : 11,
      fontFamily : "'Open Sans',Verdana"
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
      strokeStyle : "#fff",
      strokeWidth : 1,
      x1 : fromx,
      y1 : fromy,
      x2 : botx,
      y2 : boty
    });
    canvas.drawLine({
      strokeStyle : "#fff",
      strokeWidth : 1,
      x1 : fromx,
      y1 : fromy,
      x2 : topx,
      y2 : topy
    });
  };

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

      } else if (LodLive.prototype.hasOwnProperty(method) && ele.data('lodlive-instance')) {

        ll[method].apply(ll, method.args || []); // if calling a method with arguments, the options should contain a property named 'args';
      } else {

        jQuery.error('Method ' + method + ' does not exist on jQuery.lodlive');

      }

    });
	};

})(jQuery);
