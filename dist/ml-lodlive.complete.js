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

  var DEFAULT_BOX_TEMPLATE = '<div class="boxWrapper lodlive-node defaultBoxTemplate" id="first"><div class="lodlive-node-label box sprite"></div></div>';

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

    // attivo le funzioni per il drag
    this.renewDrag(this.context.children('.boxWrapper'));

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

  LodLive.prototype.renewDrag = function(aDivList) {
    var inst = this, generated;
    if (inst.debugOn) {
      start = new Date().getTime();
    }

    aDivList.each(function() {
      var div = $(this), divid = div.attr('id');

      if (!div.is('.ui-draggable')) {

        //FIXME: need to eliminate or replace draggable which forces dependency on jquery.ui (huge file)
        div.draggable({
          stack : '.boxWrapper',
          containment : 'parent',
          start : function() {

            inst.context.find('.lodlive-toolbox').remove();

            $('#line-' + divid).clearCanvas();

            var generatedRev = inst.storeIds['rev' + divid];

            if (generatedRev) {

              for (var a = 0; a < generatedRev.length; a++) {

                generated = inst.storeIds['gen' + generatedRev[a]];
                $('#line-' + generatedRev[a]).clearCanvas();
              }
            }
          },
          drag : function(event, ui) {
          },
          stop : function(event, ui) {
            inst.drawAllLines($(this));
          }
        });
      }
    });
    if (inst.debugOn) {
      console.debug((new Date().getTime() - start) + '  renewDrag ');
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

      inst.renewDrag(inst.context.children('.boxWrapper'));
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
        inst.renewDrag(inst.context.children('.boxWrapper'));
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

      inst.context.find('.' + id).each(function() {
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
            window.setTimeout(onTo, 75);
          }
        };
        window.setTimeout(onTo, 75);
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
      hander: function(obj, inst) {
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
            //TODO: fix this
            //FIXME: eval is not needed here. Too fatigued to fix it properly yet - saving for later
            //TODO: definitely fix this
            if (value.object.type === 'uri') {
              eval('uris.push({\'' + value['property']['value'] + '\':\'' + escape(value.object.value) + '\'})');
            } else if (value.object.type == 'bnode') {
              eval('bnodes.push({\'' + value['property']['value'] + '\':\'' + escape(value.object.value) + '\'})');
            } else {
              eval('values.push({\'' + value['property']['value'] + '\':\'' + escape(value.object.value) + '\'})');
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
			jResult.text(LodLiveUtils.lang('noName'));
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
					aPage.append("<div class=\"pager pagePrev sprite\" data-page=\"page" + (page - 1) + "\" style=\"top:" + (chordsList[0][1] - 8) + "px;left:" + (chordsList[0][0] - 8) + "px\"></div>");
				}
				if (totPages > 1 && page < totPages - 1) {
					aPage.append("<div class=\"pager pageNext sprite\" data-page=\"page" + (page + 1) + "\" style=\"top:" + (chordsList[15][1] - 8) + "px;left:" + (chordsList[15][0] - 8) + "px\"></div>");
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
		containerBox.children('.page').children('.pager').click(function() {
			var pager = $(this);
			containerBox.find('.lastClick').removeClass('lastClick').click();
			pager.parent().fadeOut('fast', null, function() {
				$(this).parent().children('.' + pager.attr("data-page")).fadeIn('fast');
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
        obj.appendTo(containerBox);
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

'use strict';

(function () {
    
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
    canvas.drawText({// inserisco l'etichetta
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

  if (!window.LodLiveUtils) {
    window.LodLiveUtils = LodLiveUtils;
  }

})();

// a causa di un baco di opera e firefox implmento una funzione apposita per
// settare la posizione dei background
$.fn.setBackgroundPosition = function(pos) {
	var backPos = $.trim(this.css('background-position'));
	var hasString = backPos.indexOf('left') == -1 ? false : true;
	//added fix for chrome 25
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

var MD5 = function(str) {
	if (!str) {
		return "";
	}
	str = str.replace(/http:\/\/.+~~/g, '');
	str = str.replace(/nodeID:\/\/.+~~/g, '');
	str = str.replace(/_:\/\/.+~~/g, '');
	function RotateLeft(lValue, iShiftBits) {
		return (lValue << iShiftBits) | (lValue >>> (32 - iShiftBits));
	}

	function AddUnsigned(lX, lY) {
		var lX4, lY4, lX8, lY8, lResult;
		lX8 = (lX & 0x80000000);
		lY8 = (lY & 0x80000000);
		lX4 = (lX & 0x40000000);
		lY4 = (lY & 0x40000000);
		lResult = (lX & 0x3FFFFFFF) + (lY & 0x3FFFFFFF);
		if (lX4 & lY4) {
			return (lResult ^ 0x80000000 ^ lX8 ^ lY8);
		}
		if (lX4 | lY4) {
			if (lResult & 0x40000000) {
				return (lResult ^ 0xC0000000 ^ lX8 ^ lY8);
			} else {
				return (lResult ^ 0x40000000 ^ lX8 ^ lY8);
			}
		} else {
			return (lResult ^ lX8 ^ lY8);
		}
	}

	function F(x, y, z) {
		return (x & y) | ((~x) & z);
	}

	function G(x, y, z) {
		return (x & z) | (y & (~z));
	}

	function H(x, y, z) {
		return (x ^ y ^ z);
	}

	function I(x, y, z) {
		return (y ^ (x | (~z)));
	}

	function FF(a, b, c, d, x, s, ac) {
		a = AddUnsigned(a, AddUnsigned(AddUnsigned(F(b, c, d), x), ac));
		return AddUnsigned(RotateLeft(a, s), b);
	}

	;

	function GG(a, b, c, d, x, s, ac) {
		a = AddUnsigned(a, AddUnsigned(AddUnsigned(G(b, c, d), x), ac));
		return AddUnsigned(RotateLeft(a, s), b);
	}

	;

	function HH(a, b, c, d, x, s, ac) {
		a = AddUnsigned(a, AddUnsigned(AddUnsigned(H(b, c, d), x), ac));
		return AddUnsigned(RotateLeft(a, s), b);
	}

	;

	function II(a, b, c, d, x, s, ac) {
		a = AddUnsigned(a, AddUnsigned(AddUnsigned(I(b, c, d), x), ac));
		return AddUnsigned(RotateLeft(a, s), b);
	}

	;

	function ConvertToWordArray(string) {
		var lWordCount;
		var lMessageLength = string.length;
		var lNumberOfWords_temp1 = lMessageLength + 8;
		var lNumberOfWords_temp2 = (lNumberOfWords_temp1 - (lNumberOfWords_temp1 % 64)) / 64;
		var lNumberOfWords = (lNumberOfWords_temp2 + 1) * 16;
		var lWordArray = Array(lNumberOfWords - 1);
		var lBytePosition = 0;
		var lByteCount = 0;
		while (lByteCount < lMessageLength) {
			lWordCount = (lByteCount - (lByteCount % 4)) / 4;
			lBytePosition = (lByteCount % 4) * 8;
			lWordArray[lWordCount] = (lWordArray[lWordCount] | (string.charCodeAt(lByteCount) << lBytePosition));
			lByteCount++;
		}
		lWordCount = (lByteCount - (lByteCount % 4)) / 4;
		lBytePosition = (lByteCount % 4) * 8;
		lWordArray[lWordCount] = lWordArray[lWordCount] | (0x80 << lBytePosition);
		lWordArray[lNumberOfWords - 2] = lMessageLength << 3;
		lWordArray[lNumberOfWords - 1] = lMessageLength >>> 29;
		return lWordArray;
	}

	;

	function WordToHex(lValue) {
		var WordToHexValue = "", WordToHexValue_temp = "", lByte, lCount;
		for ( lCount = 0; lCount <= 3; lCount++) {
			lByte = (lValue >>> (lCount * 8)) & 255;
			WordToHexValue_temp = "0" + lByte.toString(16);
			WordToHexValue = WordToHexValue + WordToHexValue_temp.substr(WordToHexValue_temp.length - 2, 2);
		}
		return WordToHexValue;
	}

	;

	function Utf8Encode(string) {
		string = string.replace(/\r\n/g, "\n");
		var utftext = "";

		for (var n = 0; n < string.length; n++) {

			var c = string.charCodeAt(n);

			if (c < 128) {
				utftext += String.fromCharCode(c);
			} else if ((c > 127) && (c < 2048)) {
				utftext += String.fromCharCode((c >> 6) | 192);
				utftext += String.fromCharCode((c & 63) | 128);
			} else {
				utftext += String.fromCharCode((c >> 12) | 224);
				utftext += String.fromCharCode(((c >> 6) & 63) | 128);
				utftext += String.fromCharCode((c & 63) | 128);
			}

		}

		return utftext;
	}

	;

	var x = Array();
	var k, AA, BB, CC, DD, a, b, c, d;
	var S11 = 7, S12 = 12, S13 = 17, S14 = 22;
	var S21 = 5, S22 = 9, S23 = 14, S24 = 20;
	var S31 = 4, S32 = 11, S33 = 16, S34 = 23;
	var S41 = 6, S42 = 10, S43 = 15, S44 = 21;

	str = Utf8Encode(str);

	x = ConvertToWordArray(str);

	a = 0x67452301;
	b = 0xEFCDAB89;
	c = 0x98BADCFE;
	d = 0x10325476;

	for ( k = 0; k < x.length; k += 16) {
		AA = a;
		BB = b;
		CC = c;
		DD = d;
		a = FF(a, b, c, d, x[k + 0], S11, 0xD76AA478);
		d = FF(d, a, b, c, x[k + 1], S12, 0xE8C7B756);
		c = FF(c, d, a, b, x[k + 2], S13, 0x242070DB);
		b = FF(b, c, d, a, x[k + 3], S14, 0xC1BDCEEE);
		a = FF(a, b, c, d, x[k + 4], S11, 0xF57C0FAF);
		d = FF(d, a, b, c, x[k + 5], S12, 0x4787C62A);
		c = FF(c, d, a, b, x[k + 6], S13, 0xA8304613);
		b = FF(b, c, d, a, x[k + 7], S14, 0xFD469501);
		a = FF(a, b, c, d, x[k + 8], S11, 0x698098D8);
		d = FF(d, a, b, c, x[k + 9], S12, 0x8B44F7AF);
		c = FF(c, d, a, b, x[k + 10], S13, 0xFFFF5BB1);
		b = FF(b, c, d, a, x[k + 11], S14, 0x895CD7BE);
		a = FF(a, b, c, d, x[k + 12], S11, 0x6B901122);
		d = FF(d, a, b, c, x[k + 13], S12, 0xFD987193);
		c = FF(c, d, a, b, x[k + 14], S13, 0xA679438E);
		b = FF(b, c, d, a, x[k + 15], S14, 0x49B40821);
		a = GG(a, b, c, d, x[k + 1], S21, 0xF61E2562);
		d = GG(d, a, b, c, x[k + 6], S22, 0xC040B340);
		c = GG(c, d, a, b, x[k + 11], S23, 0x265E5A51);
		b = GG(b, c, d, a, x[k + 0], S24, 0xE9B6C7AA);
		a = GG(a, b, c, d, x[k + 5], S21, 0xD62F105D);
		d = GG(d, a, b, c, x[k + 10], S22, 0x2441453);
		c = GG(c, d, a, b, x[k + 15], S23, 0xD8A1E681);
		b = GG(b, c, d, a, x[k + 4], S24, 0xE7D3FBC8);
		a = GG(a, b, c, d, x[k + 9], S21, 0x21E1CDE6);
		d = GG(d, a, b, c, x[k + 14], S22, 0xC33707D6);
		c = GG(c, d, a, b, x[k + 3], S23, 0xF4D50D87);
		b = GG(b, c, d, a, x[k + 8], S24, 0x455A14ED);
		a = GG(a, b, c, d, x[k + 13], S21, 0xA9E3E905);
		d = GG(d, a, b, c, x[k + 2], S22, 0xFCEFA3F8);
		c = GG(c, d, a, b, x[k + 7], S23, 0x676F02D9);
		b = GG(b, c, d, a, x[k + 12], S24, 0x8D2A4C8A);
		a = HH(a, b, c, d, x[k + 5], S31, 0xFFFA3942);
		d = HH(d, a, b, c, x[k + 8], S32, 0x8771F681);
		c = HH(c, d, a, b, x[k + 11], S33, 0x6D9D6122);
		b = HH(b, c, d, a, x[k + 14], S34, 0xFDE5380C);
		a = HH(a, b, c, d, x[k + 1], S31, 0xA4BEEA44);
		d = HH(d, a, b, c, x[k + 4], S32, 0x4BDECFA9);
		c = HH(c, d, a, b, x[k + 7], S33, 0xF6BB4B60);
		b = HH(b, c, d, a, x[k + 10], S34, 0xBEBFBC70);
		a = HH(a, b, c, d, x[k + 13], S31, 0x289B7EC6);
		d = HH(d, a, b, c, x[k + 0], S32, 0xEAA127FA);
		c = HH(c, d, a, b, x[k + 3], S33, 0xD4EF3085);
		b = HH(b, c, d, a, x[k + 6], S34, 0x4881D05);
		a = HH(a, b, c, d, x[k + 9], S31, 0xD9D4D039);
		d = HH(d, a, b, c, x[k + 12], S32, 0xE6DB99E5);
		c = HH(c, d, a, b, x[k + 15], S33, 0x1FA27CF8);
		b = HH(b, c, d, a, x[k + 2], S34, 0xC4AC5665);
		a = II(a, b, c, d, x[k + 0], S41, 0xF4292244);
		d = II(d, a, b, c, x[k + 7], S42, 0x432AFF97);
		c = II(c, d, a, b, x[k + 14], S43, 0xAB9423A7);
		b = II(b, c, d, a, x[k + 5], S44, 0xFC93A039);
		a = II(a, b, c, d, x[k + 12], S41, 0x655B59C3);
		d = II(d, a, b, c, x[k + 3], S42, 0x8F0CCC92);
		c = II(c, d, a, b, x[k + 10], S43, 0xFFEFF47D);
		b = II(b, c, d, a, x[k + 1], S44, 0x85845DD1);
		a = II(a, b, c, d, x[k + 8], S41, 0x6FA87E4F);
		d = II(d, a, b, c, x[k + 15], S42, 0xFE2CE6E0);
		c = II(c, d, a, b, x[k + 6], S43, 0xA3014314);
		b = II(b, c, d, a, x[k + 13], S44, 0x4E0811A1);
		a = II(a, b, c, d, x[k + 4], S41, 0xF7537E82);
		d = II(d, a, b, c, x[k + 11], S42, 0xBD3AF235);
		c = II(c, d, a, b, x[k + 2], S43, 0x2AD7D2BB);
		b = II(b, c, d, a, x[k + 9], S44, 0xEB86D391);
		a = AddUnsigned(a, AA);
		b = AddUnsigned(b, BB);
		c = AddUnsigned(c, CC);
		d = AddUnsigned(d, DD);
	}

	var temp = WordToHex(a) + WordToHex(b) + WordToHex(c) + WordToHex(d);

	return temp.toLowerCase();

};

function lang(obj) {
	return $.jStorage.get('language')[$.jStorage.get('selectedLanguage')][obj];
}

function breakLines(msg) {
	msg = msg.replace(/\//g, '/<span style="font-size:1px"> </span>');
	msg = msg.replace(/&/g, '&<span style="font-size:1px"> </span>');
	msg = msg.replace(/%/g, '%<span style="font-size:1px"> </span>');
	return msg;
}

/*
 jCanvas v13.11.21
 Copyright 2013 Caleb Evans
 Released under the MIT license
*/
(function(d,Ka,sa,da,ta,A,E,f,D){function L(c){Y(this,c);return this}function J(c){c?Y(L.prototype,c):J.prefs=L.prototype=Y({},ia);return this}function K(c){return c&&c.getContext?c.getContext("2d"):f}function ja(c){c=Y({},c);c.masks=c.masks.slice(0);return c}function ea(c,b){var a;c.save();a=ja(b.transforms);b.savedTransforms.push(a)}function U(c,b,a){$(a.fillStyle)?b.fillStyle=a.fillStyle.call(c,a):b.fillStyle=a.fillStyle;$(a.strokeStyle)?b.strokeStyle=a.strokeStyle.call(c,a):b.strokeStyle=a.strokeStyle;
b.lineWidth=a.strokeWidth;a.rounded?b.lineCap=b.lineJoin="round":(b.lineCap=a.strokeCap,b.lineJoin=a.strokeJoin,b.miterLimit=a.miterLimit);b.shadowOffsetX=a.shadowX;b.shadowOffsetY=a.shadowY;b.shadowBlur=a.shadowBlur;b.shadowColor=a.shadowColor;b.globalAlpha=a.opacity;b.globalCompositeOperation=a.compositing;a.imageSmoothing&&(b.webkitImageSmoothingEnabled=b.mozImageSmoothingEnabled=a.imageSmoothing)}function ua(c,b,a){a.mask&&(a.autosave&&ea(c,b),c.clip(),b.transforms.masks.push(a._args))}function X(c,
b,a){a.closed&&b.closePath();a.shadowStroke&&0!==a.strokeWidth?(b.stroke(),b.fill(),b.shadowColor="transparent",b.shadowBlur=0,b.stroke()):(b.fill(),"transparent"!==a.fillStyle&&(b.shadowColor="transparent"),0!==a.strokeWidth&&b.stroke());a.closed||b.closePath();a._transformed&&b.restore();a.mask&&(c=P(c),ua(b,c,a))}function va(c,b,a){b._toRad=b.inDegrees?M/180:1;c.translate(b.x,b.y);c.rotate(b.rotate*b._toRad);c.translate(-b.x,-b.y);a&&(a.rotate+=b.rotate*b._toRad)}function wa(c,b,a){1!==b.scale&&
(b.scaleX=b.scaleY=b.scale);c.translate(b.x,b.y);c.scale(b.scaleX,b.scaleY);c.translate(-b.x,-b.y);a&&(a.scaleX*=b.scaleX,a.scaleY*=b.scaleY)}function xa(c,b,a){b.translate&&(b.translateX=b.translateY=b.translate);c.translate(b.translateX,b.translateY);a&&(a.translateX+=b.translateX,a.translateY+=b.translateY)}function Q(c,b,a,e,h){a._toRad=a.inDegrees?M/180:1;a.arrowAngle*=a._toRad;a._transformed=A;b.save();h===D&&(h=e);a.fromCenter||a._centered||(a.x+=e/2,a.y+=h/2,a._centered=A);a.rotate&&va(b,
a,{});1===a.scale&&1===a.scaleX&&1===a.scaleY||wa(b,a,{});(a.translate||a.translateX||a.translateY)&&xa(b,a,{})}function P(c){var b;fa._canvas===c&&fa._data?b=fa._data:(b=d.data(c,"jCanvas"),b||(b={canvas:c,layers:[],layer:{names:{},groups:{}},intersecting:[],lastIntersected:f,cursor:d(c).css("cursor"),drag:{},event:{type:f,x:f,y:f},events:{},transforms:ja(ma),savedTransforms:[],animating:E,animated:f,pos:0,pixelRatio:1,scaled:!1},d.data(c,"jCanvas",b)),fa._canvas=c,fa._data=b);return b}function ya(c,
b,a){for(var e in J.events)J.events.hasOwnProperty(e)&&(a[e]||a.cursors&&a.cursors[e])&&za(c,b,a,e)}function za(c,b,a,e){e=Aa(e);J.events[e](c,b);a._event=A}function Ba(c,b,a){var e,h,g;if(a.draggable||a.cursor||a.cursors){e=["mousedown","mousemove","mouseup"];for(g=0;g<e.length;g+=1)h=e[g],za(c,b,a,h);b.events.mouseoutdrag||(c.bind("mouseout.jCanvas",function(){var a=b.drag.layer;a&&(b.drag={},a.dragcancel&&a.dragcancel.call(c[0],a),c.drawLayers())}),b.events.mouseoutdrag=A);a._event=A}}function ka(c,
b,a,e){c=b.layer.names;e?e.name!==D&&"string"===aa(a.name)&&a.name!==e.name&&delete c[a.name]:e=a;"string"===aa(e.name)&&(c[e.name]=a)}function na(c,b,a,e){c=b.layer.groups;var h,g,d,H;a.group!==f&&(a.groups=[a.group],a.dragGroupWithLayer&&(a.dragGroups=[a.group]));e&&e.group!==D&&(e.group===f?e.groups=f:(e.groups=[e.group],e.dragGroupWithLayer&&(e.dragGroups=[e.group])));if(!e)e=a;else if(e.groups!==D&&a.groups!==f)for(g=0;g<a.groups.length;g+=1)if(h=a.groups[g],b=c[h]){for(H=0;H<b.length;H+=1)if(b[H]===
a){d=H;b.splice(H,1);break}0===b.length&&delete c[h]}if(e.groups!==D&&e.groups!==f)for(g=0;g<e.groups.length;g+=1)h=e.groups[g],b=c[h],b||(b=c[h]=[],b.name=h),d===D&&(d=b.length),b.splice(d,0,a)}function ca(c,b,a,e){e||(e=b.cursors?b.cursors[a]:b.cursor);e&&c.css({cursor:e});b[a]&&b[a].call(c[0],b)}function O(c,b,a,e){var h=b;b._args=a;b.canvas=c;if(b.draggable||b.dragGroups)b.layer=A,b.draggable=A;b._method=e?e:b.method?d.fn[b.method]:b.type?d.fn[la[b.type]]:function(){};b.layer&&!b._layer&&(a=d(c),
e=a.getLayers(),c=P(c),h=new L(b),h.layer=A,h._layer=A,ka(a,c,h),na(a,c,h),ya(a,c,h),Ba(a,c,h),b._event=h._event,h.index===f&&(h.index=e.length),e.splice(h.index,0,h));return h}function Ca(c){var b,a;for(a=0;a<ga.length;a+=1)b=ga[a],c[b]=c["_"+b]}function Da(c,b){var a,e;for(e=0;e<ga.length;e+=1)a=ga[e],c["_"+a]=c[a],oa[a]=A,b&&delete c[a]}function La(c,b,a){for(var e in a)a.hasOwnProperty(e)&&$(a[e])&&(a[e]=a[e].call(c,b,e));return a}function Ea(c){var b,a,e=[],h=1;c.match(/^#?\w+$/gi)&&("transparent"===
c&&(c="rgba(0,0,0,0)"),a=Ka.head,b=a.style.color,a.style.color=c,c=d.css(a,"color"),a.style.color=b);c.match(/^rgb/gi)&&(e=c.match(/\d+/gi),c.match(/%/gi)&&(h=2.55),e[0]*=h,e[1]*=h,e[2]*=h,e[3]=e[3]!==D?ta(e[3]):1);return e}function Ma(c){var b=3,a;"array"!==aa(c.start)&&(c.start=Ea(c.start),c.end=Ea(c.end));c.now=[];if(1!==c.start[3]||1!==c.end[3])b=4;for(a=0;a<b;a+=1)c.now[a]=c.start[a]+(c.end[a]-c.start[a])*c.pos,3>a&&(c.now[a]=Na(c.now[a]));1!==c.start[3]||1!==c.end[3]?c.now="rgba("+c.now.join(",")+
")":(c.now.slice(0,3),c.now="rgb("+c.now.join(",")+")");c.elem.nodeName?c.elem.style[c.prop]=c.now:c.elem[c.prop]=c.now}function Aa(c){void 0!==window.ontouchstart&&pa[c]&&(c=pa[c]);return c}function Oa(c){J.events[c]=function(b,a){var e,h;h=a.event;e="mouseover"===c||"mouseout"===c?"mousemove":c;a.events[e]||(b.bind(e+".jCanvas",function(a){h.x=a.offsetX;h.y=a.offsetY;h.type=e;h.event=a;b.drawLayers({resetFire:A});a.preventDefault()}),a.events[e]=A)}}function V(c,b,a){var e,h,g,d;(a=a._args)&&a._event&&
(c=P(c),e=c.event,e.x!==f&&e.y!==f&&(g=e.x*c.pixelRatio,d=e.y*c.pixelRatio,h=b.isPointInPath(g,d)||b.isPointInStroke&&b.isPointInStroke(g,d)),b=c.transforms,a.eventX=a.mouseX=e.x,a.eventY=a.mouseY=e.y,a.event=e.event,e=c.transforms.rotate,g=a.eventX,d=a.eventY,0!==e?(a._eventX=g*R(-e)-d*T(-e),a._eventY=d*R(-e)+g*T(-e)):(a._eventX=g,a._eventY=d),a._eventX/=b.scaleX,a._eventY/=b.scaleY,h&&c.intersecting.push(a),a.intersects=h)}function Fa(c){for(;0>c;)c+=2*M;return c}function Ga(c,b,a,e,h,g,d){var f,
z,y;a.arrowRadius&&!a.closed&&(y=Pa(d-h,g-e),y-=M,f=a.strokeWidth*R(y),z=a.strokeWidth*T(y),c=g+a.arrowRadius*R(y+a.arrowAngle/2),e=d+a.arrowRadius*T(y+a.arrowAngle/2),h=g+a.arrowRadius*R(y-a.arrowAngle/2),a=d+a.arrowRadius*T(y-a.arrowAngle/2),b.moveTo(c-f,e-z),b.lineTo(g-f,d-z),b.lineTo(h-f,a-z),b.moveTo(g-f,d-z),b.lineTo(g+f,d+z))}function ha(c,b,a,e,h,g,d,f,z,y,F){a.startArrow&&Ga(c,b,a,e,h,g,d);a.endArrow&&Ga(c,b,a,f,z,y,F)}function Ha(c,b){isNaN(Number(b.fontSize))||(b.fontSize+="px");c.font=
b.fontStyle+" "+b.fontSize+" "+b.fontFamily}function Ia(c,b,a,e){var h,g;if(Z.text===a.text&&Z.fontStyle===a.fontStyle&&Z.fontSize===a.fontSize&&Z.fontFamily===a.fontFamily&&Z.maxWidth===a.maxWidth&&Z.lineHeight===a.lineHeight)a.width=Z.width,a.height=Z.height;else{a.width=b.measureText(e[0]).width;for(g=1;g<e.length;g+=1)h=b.measureText(e[g]).width,h>a.width&&(a.width=h);b=c.style.fontSize;c.style.fontSize=a.fontSize;a.height=ta(d.css(c,"fontSize"))*e.length*a.lineHeight;c.style.fontSize=b}}function Ja(c,
b){var a=b.maxWidth,e=b.text.split("\n"),h=[],g,d,f,z,y;for(f=0;f<e.length;f+=1){z=e[f];y=z.split(" ");g=[];d="";if(1===y.length||c.measureText(z).width<a)g=[z];else{for(z=0;z<y.length;z+=1)c.measureText(d+y[z]).width>a&&(""!==d&&g.push(d),d=""),d+=y[z],z!==y.length-1&&(d+=" ");g.push(d)}h=h.concat(g.join("\n").replace(/( (\n))|( $)/gi,"$2").split("\n"))}return h}var ia,Y=d.extend,ba=d.inArray,aa=d.type,$=d.isFunction,Na=da.round,M=da.PI,T=da.sin,R=da.cos,Pa=da.atan2,Qa=d.event.fix,pa,qa,la,fa={},
Z={},ra={},ma={rotate:0,scaleX:1,scaleY:1,translateX:0,translateY:0,masks:[]},ga,oa;d.fn.jCanvas=J;J.events={};ia={align:"center",arrowAngle:90,arrowRadius:0,autosave:A,baseline:"middle",bringToFront:E,ccw:E,closed:E,compositing:"source-over",concavity:0,cornerRadius:0,count:1,cropFromCenter:A,cursor:f,cursors:f,disableEvents:E,draggable:E,dragGroups:f,group:f,groups:f,data:{},each:f,end:360,fillStyle:"transparent",fireDragGroupEvents:E,fontStyle:"normal",fontSize:"12pt",fontFamily:"sans-serif",fromCenter:A,
fn:f,height:f,imageSmoothing:A,inDegrees:A,index:f,lineHeight:1,layer:E,load:f,mask:E,maxWidth:f,miterLimit:10,name:f,opacity:1,r1:f,r2:f,radius:0,repeat:"repeat",respectAlign:E,rotate:0,rounded:E,scale:1,scaleX:1,scaleY:1,shadowBlur:0,shadowColor:"transparent",shadowStroke:!1,shadowX:0,shadowY:0,sHeight:f,sides:0,source:"",spread:0,start:0,strokeCap:"butt",strokeJoin:"miter",strokeStyle:"transparent",strokeWidth:1,sWidth:f,sx:f,sy:f,text:"",translate:0,translateX:0,translateY:0,type:f,visible:A,
width:f,x:0,y:0};J();J.extend=function(c){J.defaults=Y(ia,c.props);J();c.name&&(d.fn[c.name]=function a(e){var h,g,d,f;for(g=0;g<this.length;g+=1)if(h=this[g],d=K(h))f=new L(e),O(h,f,e,a),U(h,d,f),c.fn.call(h,d,f);return this});return d.fn[c.name]};d.fn.getLayers=function(c){var b=this[0],a,e,h=[];if(b&&b.getContext)if(a=P(b),a=a.layers,$(c))for(e=0;e<a.length;e+=1)c.call(b,a[e])&&h.push(a[e]);else h=a;return h};d.fn.getLayer=function(c){var b=P(this[0]),a=b.layers,e=aa(c),h;if(c&&c.layer)h=c;else if("number"===
e)0>c&&(c=a.length+c),h=a[c];else if("regexp"===e)for(b=0;b<a.length;b+=1){if("string"===aa(a[b].name)&&a[b].name.match(c)){h=a[b];break}}else h=b.layer.names[c];return h};d.fn.getLayerGroup=function(c){var b=aa(c),a,e;if("array"===b)return c;if("regexp"===b)for(a in b=P(this[0]),b=b.groups,b){if(a.match(c)){e=b[a];break}}else b=P(this[0]),e=b.layer.groups[c];return e};d.fn.getLayerIndex=function(c){var b=this.getLayers();c=this.getLayer(c);return ba(c,b)};d.fn.setLayer=function(c,b){var a,e,h,g;
for(e=0;e<this.length;e+=1)if(a=d(this[e]),h=P(this[e]),g=d(this[e]).getLayer(c))ka(a,h,g,b),na(a,h,g,b),b.index!==D&&a.moveLayer(g,b.index),Y(g,b),ya(a,h,g),Ba(a,h,g);return this};d.fn.setLayerGroup=function(c,b){var a,e,h,g;for(e=0;e<this.length;e+=1)if(a=d(this[e]),h=a.getLayerGroup(c))for(g=0;g<h.length;g+=1)a.setLayer(h[g],b);return this};d.fn.setLayers=function(c,b){var a,e,h,g;for(e=0;e<this.length;e+=1)for(a=d(this[e]),h=a.getLayers(b),g=0;g<h.length;g+=1)a.setLayer(h[g],c);return this};d.fn.moveLayer=
function(c,b){var a,e,h;for(e=0;e<this.length;e+=1)if(a=d(this[e]),h=a.getLayers(),a=a.getLayer(c))a.index=ba(a,h),h.splice(a.index,1),h.splice(b,0,a),0>b&&(b=h.length+b),a.index=b;return this};d.fn.removeLayer=function(c){var b,a,e,h,g;for(a=0;a<this.length;a+=1)if(b=d(this[a]),e=P(this[a]),h=b.getLayers(),g=b.getLayer(c))g.index=ba(g,h),h.splice(g.index,1),ka(b,e,g,{name:f}),na(b,e,g,{groups:f});return this};d.fn.removeLayerGroup=function(c){var b,a,e,h,g,N,H;if(c!==D)for(a=0;a<this.length;a+=1)if(b=
d(this[a]),e=P(this[a]),h=b.getLayers(),g=b.getLayerGroup(c)){for(H=0;H<g.length;H+=1)N=g[H],N.index=ba(N,h),h.splice(N.index,1),ka(b,e,N,{name:f});delete e.layer.groups[g.name]}return this};d.fn.removeLayers=function(){var c,b;for(c=0;c<this.length;c+=1)d(this[c]),b=P(this[c]),b.layers.length=0,b.layer.names={},b.layer.groups={};return this};d.fn.addLayerToGroup=function(c,b){var a,e,h,g=[];for(e=0;e<this.length;e+=1)a=d(this[e]),h=a.getLayer(c),h.groups&&-1===ba(b,h.groups)&&(g=h.groups.slice(0),
g.push(b),a.setLayer(h,{groups:g}));return this};d.fn.removeLayerFromGroup=function(c,b){var a,e,h,g=[],f;for(e=0;e<this.length;e+=1)a=d(this[e]),h=a.getLayer(c),f=ba(b,h.groups),-1!==f&&(g=h.groups.slice(0),g.splice(f,1),a.setLayer(h,{groups:g}));return this};d.fn.drawLayer=function(c){var b,a,e;for(b=0;b<this.length;b+=1)a=d(this[b]),K(this[b]),(e=a.getLayer(c))&&e.visible&&e._method&&(e._next=f,e._method.call(a,e));return this};d.fn.drawLayers=function(c){var b,a,e=Y({},c),h,g,N,H,z,y,F;e.index||
(e.index=0);for(c=0;c<this.length;c+=1)if(b=d(this[c]),a=K(this[c])){H=P(this[c]);e.clear!==E&&b.clearCanvas();a=H.layers;for(N=e.index;N<a.length&&(h=a[N],h.index=N,e.resetFire&&(h._fired=E),h._event=!h.disableEvents,y=b,z=h,g=N+1,z&&z.visible&&z._method&&(z._next=g?g:f,z._method.call(y,z)),h._masks=H.transforms.masks.slice(0),h._method!==d.fn.drawImage||!h.visible);N+=1);h=H;g=z=y=void 0;y={};for(z=h.intersecting.length-1;0<=z;z-=1)if(y=h.intersecting[z],y._masks){for(g=y._masks.length-1;0<=g;g-=
1)if(!y._masks[g].intersects){y.intersects=E;break}if(y.intersects)break}h=y;z=H.event;y=z.type;h[y]||qa[y]&&(y=qa[y]);F=H.drag;g=H.lastIntersected;g!==f&&h!==g&&g._hovered&&!g._fired&&(H.lastIntersected=f,g._fired=A,g._hovered=E,ca(b,g,"mouseout",H.cursor));h._event&&h.intersects&&(H.lastIntersected=h,!(h.mouseover||h.mouseout||h.cursor||h.cursors)||h._hovered||h._fired||(h._fired=A,h._hovered=A,ca(b,h,"mouseover")),h._fired||(h._fired=A,z.type=f,ca(b,h,y)),!h.draggable||"mousedown"!==y&&"touchstart"!==
y||(F.layer=h));if(F.layer){h=H;var t=g=z=void 0,B=F=void 0,l=void 0,u=t=void 0;F=h.drag;g=F.layer;B=g.dragGroups||[];z=h.layers;if("mousemove"===y||"touchmove"===y){if(!F.dragging){F.dragging=A;g.bringToFront&&(z.splice(g.index,1),g.index=z.push(g));for(u=0;u<B.length;u+=1)if(t=B[u],l=h.layer.groups[t],g.groups&&l)for(t=0;t<l.length;t+=1)l[t]!==g&&(l[t]._startX=l[t].x,l[t]._startY=l[t].y,l[t]._endX=g._eventX,l[t]._endY=g._eventY,l[t].bringToFront&&(l[t].index=ba(l[t],z),z.splice(l[t].index,1),z.splice(-1,
0,l[t]),l[t].index=z.length-2),l[t].dragstart&&g.fireDragGroupEvents&&l[t].dragstart.call(b[0],l[t]));F._startX=g._startX=g.x;F._startY=g._startY=g.y;F._endX=g._endX=g._eventX;F._endY=g._endY=g._eventY;ca(b,g,"dragstart")}g.x=g._eventX-(F._endX-F._startX);g.y=g._eventY-(F._endY-F._startY);for(u=0;u<B.length;u+=1)if(t=B[u],l=h.layer.groups[t],g.groups&&l)for(t=0;t<l.length;t+=1)l[t]!==g&&(l[t].x=g._eventX-(l[t]._endX-l[t]._startX),l[t].y=g._eventY-(l[t]._endY-l[t]._startY),l[t].drag&&g.fireDragGroupEvents&&
l[t].drag.call(b[0],l[t]));ca(b,g,"drag")}else if("mouseup"===y||"touchend"===y){F.dragging&&(ca(b,g,"dragstop"),F.dragging=E);for(u=0;u<B.length;u+=1)if(t=B[u],l=h.layer.groups[t],g.groups&&l)for(t=0;t<l.length;t+=1)l[t]!==g&&l[t].dragstop&&g.fireDragGroupEvents&&l[t].dragstop.call(b[0],l[t]);h.drag={}}}N===a.length&&(H.intersecting.length=0,H.transforms=ja(ma),H.savedTransforms.length=0)}return this};d.fn.addLayer=function(c){var b,a;for(b=0;b<this.length;b+=1)if(a=K(this[b]))a=new L(c),a.layer=
A,O(this[b],a,c);return this};ga=["width","height","opacity","lineHeight"];oa={};d.fn.animateLayer=function(){function c(a,b,c){return function(){Ca(c);b.animating&&b.animated!==c||a.drawLayers();g[4]&&g[4].call(a[0],c);c._animating=E;b.animating=E;b.animated=f}}function b(a,b,c){return function(e,h){c._pos!==h.pos&&(c._pos=h.pos,Ca(c),c._animating||b.animating||(c._animating=A,b.animating=A,b.animated=c),b.animating&&b.animated!==c||a.drawLayers(),g[5]&&g[5].call(a[0],e,h,c))}}var a,e,h,g=[].slice.call(arguments,
0),N,H;"object"===aa(g[2])?(g.splice(2,0,g[2].duration||f),g.splice(3,0,g[3].easing||f),g.splice(4,0,g[4].done||g[4].complete||f),g.splice(5,0,g[5].step||f)):(g[2]===D?(g.splice(2,0,f),g.splice(3,0,f),g.splice(4,0,f)):$(g[2])&&(g.splice(2,0,f),g.splice(3,0,f)),g[3]===D?(g[3]=f,g.splice(4,0,f)):$(g[3])&&g.splice(3,0,f));for(e=0;e<this.length;e+=1)if(a=d(this[e]),h=K(this[e]))h=P(this[e]),(N=a.getLayer(g[0]))&&N._method!==d.fn.draw&&(H=Y({},g[1]),H=La(this[e],N,H),Da(H,A),Da(N),N.style=oa,d(N).animate(H,
{duration:g[2],easing:d.easing[g[3]]?g[3]:f,complete:c(a,h,N),step:b(a,h,N)}));return this};d.fn.animateLayerGroup=function(c){var b,a,e=[].slice.call(arguments,0),h,g;for(a=0;a<this.length;a+=1)if(b=d(this[a]),h=b.getLayerGroup(c))for(g=0;g<h.length;g+=1)b.animateLayer.apply(b,[h[g]].concat(e.slice(1)));return this};d.fn.delayLayer=function(c,b){var a,e;b=b||0;for(a=0;a<this.length;a+=1)e=d(this[a]).getLayer(c),d(e).delay(b);return this};d.fn.delayLayerGroup=function(c,b){var a,e,h,g;b=b||0;for(e=
0;e<this.length;e+=1)if(a=d(this[e]),a=a.getLayerGroup(c))for(g=0;g<a.length;g+=1)(h=a[g])&&d(h).delay(b);return this};d.fn.stopLayer=function(c,b){var a,e;for(e=0;e<this.length;e+=1)a=d(this[e]),(a=a.getLayer(c))&&d(a).stop(b);return this};d.fn.stopLayerGroup=function(c,b){var a,e,h,g;for(e=0;e<this.length;e+=1)if(a=d(this[e]),a=a.getLayerGroup(c))for(g=0;g<a.length;g+=1)(h=a[g])&&d(h).stop(b);return this};(function(c){var b;for(b=0;b<c.length;b+=1)d.fx.step[c[b]]=Ma})("color backgroundColor borderColor borderTopColor borderRightColor borderBottomColor borderLeftColor fillStyle outlineColor strokeStyle shadowColor".split(" "));
pa={mousedown:"touchstart",mouseup:"touchend",mousemove:"touchmove"};qa={touchstart:"mousedown",touchend:"mouseup",touchmove:"mousemove"};(function(c){var b;for(b=0;b<c.length;b+=1)Oa(c[b])})("click dblclick mousedown mouseup mousemove mouseover mouseout touchstart touchmove touchend".split(" "));d.event.fix=function(c){var b,a;c=Qa.call(d.event,c);if(b=c.originalEvent)if(a=b.changedTouches,c.pageX!==D&&c.offsetX===D){if(b=d(c.currentTarget).offset())c.offsetX=c.pageX-b.left,c.offsetY=c.pageY-b.top}else a&&
(b=d(c.currentTarget).offset())&&(c.offsetX=a[0].pageX-b.left,c.offsetY=a[0].pageY-b.top);return c};la={arc:"drawArc",bezier:"drawBezier",ellipse:"drawEllipse","function":"draw",image:"drawImage",line:"drawLine",polygon:"drawPolygon",slice:"drawSlice",quadratic:"drawQuadratic",rectangle:"drawRect",text:"drawText",vector:"drawVector"};d.fn.draw=function b(a){var e,h,g=new L(a);if(la[g.type])this[la[g.type]](g);else for(e=0;e<this.length;e+=1)if(d(this[e]),h=K(this[e]))g=new L(a),O(this[e],g,a,b),g.visible&&
g.fn&&g.fn.call(this[e],h,g);return this};d.fn.clearCanvas=function a(e){var h,g,d=new L(e);for(h=0;h<this.length;h+=1)if(g=K(this[h]))d.width===f||d.height===f?(g.save(),g.setTransform(1,0,0,1,0,0),g.clearRect(0,0,this[h].width,this[h].height),g.restore()):(O(this[h],d,e,a),Q(this[h],g,d,d.width,d.height),g.clearRect(d.x-d.width/2,d.y-d.height/2,d.width,d.height),d._transformed&&g.restore());return this};d.fn.saveCanvas=function e(h){var g,d,f,z,y;for(g=0;g<this.length;g+=1)if(d=K(this[g]))for(z=
P(this[g]),f=new L(h),O(this[g],f,h,e),y=0;y<f.count;y+=1)ea(d,z);return this};d.fn.restoreCanvas=function h(g){var d,f,z,y,F;for(d=0;d<this.length;d+=1)if(f=K(this[d]))for(y=P(this[d]),z=new L(g),O(this[d],z,g,h),F=0;F<z.count;F+=1){var t=f,B=y;0===B.savedTransforms.length?B.transforms=ja(ma):(t.restore(),B.transforms=B.savedTransforms.pop())}return this};d.fn.restoreCanvasOnRedraw=function(h){h=Y({},h);h.layer=A;this.restoreCanvas(h);return this};d.fn.rotateCanvas=function g(d){var f,z,y,F;for(f=
0;f<this.length;f+=1)if(z=K(this[f]))F=P(this[f]),y=new L(d),O(this[f],y,d,g),y.autosave&&ea(z,F),va(z,y,F.transforms);return this};d.fn.scaleCanvas=function N(d){var f,y,F,t;for(f=0;f<this.length;f+=1)if(y=K(this[f]))t=P(this[f]),F=new L(d),O(this[f],F,d,N),F.autosave&&ea(y,t),wa(y,F,t.transforms);return this};d.fn.translateCanvas=function H(d){var f,F,t,B;for(f=0;f<this.length;f+=1)if(F=K(this[f]))B=P(this[f]),t=new L(d),O(this[f],t,d,H),t.autosave&&ea(F,B),xa(F,t,B.transforms);return this};d.fn.drawRect=
function z(d){var f,t,B,l,u,C,q,v;for(f=0;f<this.length;f+=1)if(t=K(this[f]))B=new L(d),O(this[f],B,d,z),B.visible&&(U(this[f],t,B),Q(this[f],t,B,B.width,B.height),t.beginPath(),l=B.x-B.width/2,u=B.y-B.height/2,(v=B.cornerRadius)?(B.closed=A,C=B.x+B.width/2,q=B.y+B.height/2,0>C-l-2*v&&(v=(C-l)/2),0>q-u-2*v&&(v=(q-u)/2),t.moveTo(l+v,u),t.lineTo(C-v,u),t.arc(C-v,u+v,v,3*M/2,2*M,E),t.lineTo(C,q-v),t.arc(C-v,q-v,v,0,M/2,E),t.lineTo(l+v,q),t.arc(l+v,q-v,v,M/2,M,E),t.lineTo(l,u+v),t.arc(l+v,u+v,v,M,3*M/
2,E)):t.rect(l,u,B.width,B.height),V(this[f],t,B),X(this[f],t,B));return this};d.fn.drawArc=function y(d){var f,B,l,u,C,q,v,p,k,n,m;for(f=0;f<this.length;f+=1)if(B=K(this[f]))l=new L(d),O(this[f],l,d,y),l.visible&&(U(this[f],B,l),Q(this[f],B,l,2*l.radius),l.inDegrees||360!==l.end||(l.end=2*M),l.start*=l._toRad,l.end*=l._toRad,l.start-=M/2,l.end-=M/2,B.beginPath(),B.arc(l.x,l.y,l.radius,l.start,l.end,l.ccw),k=M/180*1,l.ccw&&(k*=-1),u=l.x+l.radius*R(l.start+k),C=l.y+l.radius*T(l.start+k),q=l.x+l.radius*
R(l.start),v=l.y+l.radius*T(l.start),p=l.x+l.radius*R(l.end+k),k=l.y+l.radius*T(l.end+k),n=l.x+l.radius*R(l.end),m=l.y+l.radius*T(l.end),ha(this[f],B,l,u,C,q,v,n,m,p,k),V(this[f],B,l),X(this[f],B,l));return this};d.fn.drawEllipse=function F(d){var f,l,u,C,q;for(f=0;f<this.length;f+=1)if(l=K(this[f]))u=new L(d),O(this[f],u,d,F),u.visible&&(U(this[f],l,u),Q(this[f],l,u,u.width,u.height),C=4/3*u.width,q=u.height,l.beginPath(),l.moveTo(u.x,u.y-q/2),l.bezierCurveTo(u.x-C/2,u.y-q/2,u.x-C/2,u.y+q/2,u.x,
u.y+q/2),l.bezierCurveTo(u.x+C/2,u.y+q/2,u.x+C/2,u.y-q/2,u.x,u.y-q/2),V(this[f],l,u),u.closed=A,X(this[f],l,u));return this};d.fn.drawPolygon=function t(d){var f,u,C,q,v,p,k,n,m,x;for(f=0;f<this.length;f+=1)if(u=K(this[f]))if(C=new L(d),O(this[f],C,d,t),C.visible){U(this[f],u,C);Q(this[f],u,C,2*C.radius);v=2*M/C.sides;p=v/2;q=p+M/2;k=C.radius*R(p);u.beginPath();for(x=0;x<C.sides;x+=1)n=C.x+C.radius*R(q),m=C.y+C.radius*T(q),u.lineTo(n,m),C.concavity&&(n=C.x+(k+-k*C.concavity)*R(q+p),m=C.y+(k+-k*C.concavity)*
T(q+p),u.lineTo(n,m)),q+=v;V(this[f],u,C);C.closed=A;X(this[f],u,C)}return this};d.fn.drawSlice=function B(f){var u,C,q,v,p;for(u=0;u<this.length;u+=1)if(d(this[u]),C=K(this[u]))q=new L(f),O(this[u],q,f,B),q.visible&&(U(this[u],C,q),Q(this[u],C,q,2*q.radius),q.start*=q._toRad,q.end*=q._toRad,q.start-=M/2,q.end-=M/2,q.start=Fa(q.start),q.end=Fa(q.end),q.end<q.start&&(q.end+=2*M),v=(q.start+q.end)/2,p=q.radius*q.spread*R(v),v=q.radius*q.spread*T(v),q.x+=p,q.y+=v,C.beginPath(),C.arc(q.x,q.y,q.radius,
q.start,q.end,q.ccw),C.lineTo(q.x,q.y),V(this[u],C,q),q.closed=A,X(this[u],C,q));return this};d.fn.drawLine=function l(d){var f,q,v,p,k,n;for(f=0;f<this.length;f+=1)if(q=K(this[f]))if(v=new L(d),O(this[f],v,d,l),v.visible){U(this[f],q,v);Q(this[f],q,v,0);p=1;for(q.beginPath();A;)if(k=v["x"+p],n=v["y"+p],k!==D&&n!==D)q.lineTo(k+v.x,n+v.y),p+=1;else break;p-=1;ha(this[f],q,v,v.x2+v.x,v.y2+v.y,v.x1+v.x,v.y1+v.y,v["x"+(p-1)]+v.x,v["y"+(p-1)]+v.y,v["x"+p]+v.x,v["y"+p]+v.y);V(this[f],q,v);X(this[f],q,v)}return this};
d.fn.drawQuadratic=function u(f){var d,v,p,k,n,m,x,w;for(d=0;d<this.length;d+=1)if(v=K(this[d]))if(p=new L(f),O(this[d],p,f,u),p.visible){U(this[d],v,p);Q(this[d],v,p,0);k=2;v.beginPath();for(v.moveTo(p.x1+p.x,p.y1+p.y);A;)if(n=p["x"+k],m=p["y"+k],x=p["cx"+(k-1)],w=p["cy"+(k-1)],n!==D&&m!==D&&x!==D&&w!==D)v.quadraticCurveTo(x+p.x,w+p.y,n+p.x,m+p.y),k+=1;else break;k-=1;ha(this[d],v,p,p.cx1+p.x,p.cy1+p.y,p.x1+p.x,p.y1+p.y,p["cx"+(k-1)]+p.x,p["cy"+(k-1)]+p.y,p["x"+k]+p.x,p["y"+k]+p.y);V(this[d],v,p);
X(this[d],v,p)}return this};d.fn.drawBezier=function C(d){var f,p,k,n,m,x,w,s,I,S,W;for(f=0;f<this.length;f+=1)if(p=K(this[f]))if(k=new L(d),O(this[f],k,d,C),k.visible){U(this[f],p,k);Q(this[f],p,k,0);n=2;m=1;p.beginPath();for(p.moveTo(k.x1+k.x,k.y1+k.y);A;)if(x=k["x"+n],w=k["y"+n],s=k["cx"+m],I=k["cy"+m],S=k["cx"+(m+1)],W=k["cy"+(m+1)],x!==D&&w!==D&&s!==D&&I!==D&&S!==D&&W!==D)p.bezierCurveTo(s+k.x,I+k.y,S+k.x,W+k.y,x+k.x,w+k.y),n+=1,m+=2;else break;n-=1;m-=2;ha(this[f],p,k,k.cx1+k.x,k.cy1+k.y,k.x1+
k.x,k.y1+k.y,k["cx"+(m+1)]+k.x,k["cy"+(m+1)]+k.y,k["x"+n]+k.x,k["y"+n]+k.y);V(this[f],p,k);X(this[f],p,k)}return this};d.fn.drawVector=function q(f){var d,k,n,m,x,w,s,I,S,W,G,E;for(d=0;d<this.length;d+=1)if(k=K(this[d]))if(n=new L(f),O(this[d],n,f,q),n.visible){U(this[d],k,n);Q(this[d],k,n,0);m=1;k.beginPath();S=G=s=n.x;W=E=I=n.y;for(k.moveTo(n.x,n.y);A;)if(x=n["a"+m],w=n["l"+m],x!==D&&w!==D)x*=n._toRad,x-=M/2,S=G,W=E,G+=w*R(x),E+=w*T(x),1===m&&(s=G,I=E),k.lineTo(G,E),m+=1;else break;ha(this[d],k,
n,s,I,n.x,n.y,S,W,G,E);V(this[d],k,n);X(this[d],k,n)}return this};d.fn.drawText=function v(p){var k,n,m,x,w,s,I;for(k=0;k<this.length;k+=1)if(d(this[k]),n=K(this[k]))if(m=new L(p),O(this[k],m,p,v),m.visible){U(this[k],n,m);n.textBaseline=m.baseline;n.textAlign=m.align;Ha(n,m);x=m.maxWidth!==f?Ja(n,m):m.text.toString().split("\n");Ia(this[k],n,m,x);p&&m.layer&&(p.width=m.width,p.height=m.height);Q(this[k],n,m,m.width,m.height);s=m.x;"left"===m.align?m.respectAlign?m.x+=m.width/2:s-=m.width/2:"right"===
m.align&&(m.respectAlign?m.x-=m.width/2:s+=m.width/2);for(w=0;w<x.length;w+=1)n.shadowColor=m.shadowColor,I=m.y+w*m.height/x.length-(x.length-1)*m.height/x.length/2,n.fillText(x[w],s,I),"transparent"!==m.fillStyle&&(n.shadowColor="transparent"),n.strokeText(x[w],s,I);m._event&&(n.beginPath(),n.rect(m.x-m.width/2,m.y-m.height/2,m.width,m.height),V(this[k],n,m),n.closePath());m._transformed&&n.restore()}Z=m;return this};d.fn.measureText=function(d){var f,k;f=this.getLayer(d);if(!f||f&&!f._layer)f=new L(d);
if(d=K(this[0]))Ha(d,f),k=Ja(d,f),Ia(this[0],d,f,k);return f};d.fn.drawImage=function p(k){function n(k,p,n,s,r,w){return function(){U(m[p],n,r);r.width===f&&r.sWidth===f&&(r.width=r.sWidth=G.width);r.height===f&&r.sHeight===f&&(r.height=r.sHeight=G.height);w&&(w.width=r.width,w.height=r.height);r.sWidth!==f&&r.sHeight!==f&&r.sx!==f&&r.sy!==f?(r.width===f&&(r.width=r.sWidth),r.height===f&&(r.height=r.sHeight),r.cropFromCenter||(r.sx+=r.sWidth/2,r.sy+=r.sHeight/2),0>r.sy-r.sHeight/2&&(r.sy=r.sHeight/
2),r.sy+r.sHeight/2>G.height&&(r.sy=G.height-r.sHeight/2),0>r.sx-r.sWidth/2&&(r.sx=r.sWidth/2),r.sx+r.sWidth/2>G.width&&(r.sx=G.width-r.sWidth/2),Q(m[p],n,r,r.width,r.height),n.drawImage(G,r.sx-r.sWidth/2,r.sy-r.sHeight/2,r.sWidth,r.sHeight,r.x-r.width/2,r.y-r.height/2,r.width,r.height)):(Q(m[p],n,r,r.width,r.height),n.drawImage(G,r.x-r.width/2,r.y-r.height/2,r.width,r.height));n.beginPath();n.rect(r.x-r.width/2,r.y-r.height/2,r.width,r.height);V(m[p],n,r);n.closePath();r._transformed&&n.restore();
ua(n,s,r);r.load&&r.load.call(k,w);r.layer&&(r._args._masks=s.transforms.masks.slice(0),r._next&&d(k).drawLayers({clear:E,resetFire:A,index:r._next}))}}var m=this,x,w,s,I,S,W,G,M,J;for(w=0;w<m.length;w+=1)if(x=m[w],s=K(m[w]))I=P(m[w]),S=new L(k),W=O(m[w],S,k,p),S.visible&&(J=S.source,M=J.getContext,J.src||M?G=J:J&&(ra[J]!==D?G=ra[J]:(G=new sa,G.src=J,ra[J]=G)),G&&(G.complete||M?n(x,w,s,I,S,W)():(d(G).bind("load",n(x,w,s,I,S,W)),G.src=G.src)));return m};d.fn.createPattern=function(p){function k(){s=
m.createPattern(w,x.repeat);x.load&&x.load.call(n[0],s)}var n=this,m,x,w,s,I;(m=K(n[0]))?(x=new L(p),I=x.source,$(I)?(w=d("<canvas />")[0],w.width=x.width,w.height=x.height,p=K(w),I.call(w,p),k()):(p=I.getContext,I.src||p?w=I:(w=new sa,w.src=I),w.complete||p?k():(d(w).bind("load",k),w.src=w.src))):s=f;return s};d.fn.createGradient=function(d){var k,n=[],m,x,w,s,I,A,E;d=new L(d);if(k=K(this[0])){d.x1=d.x1||0;d.y1=d.y1||0;d.x2=d.x2||0;d.y2=d.y2||0;k=d.r1!==f||d.r2!==f?k.createRadialGradient(d.x1,d.y1,
d.r1,d.x2,d.y2,d.r2):k.createLinearGradient(d.x1,d.y1,d.x2,d.y2);for(s=1;d["c"+s]!==D;s+=1)d["s"+s]!==D?n.push(d["s"+s]):n.push(f);m=n.length;n[0]===f&&(n[0]=0);n[m-1]===f&&(n[m-1]=1);for(s=0;s<m;s+=1){if(n[s]!==f){A=1;E=0;x=n[s];for(I=s+1;I<m;I+=1)if(n[I]!==f){w=n[I];break}else A+=1;x>w&&(n[I]=n[s])}else n[s]===f&&(E+=1,n[s]=x+(w-x)/A*E);k.addColorStop(n[s],d["c"+(s+1)])}}else k=f;return k};d.fn.setPixels=function k(d){var m,x,w,s,A,E,D,G,J;for(x=0;x<this.length;x+=1)if(m=this[x],w=K(m)){s=new L(d);
O(m,s,d,k);Q(this[x],w,s,s.width,s.height);if(s.width===f||s.height===f)s.width=m.width,s.height=m.height,s.x=s.width/2,s.y=s.height/2;if(0!==s.width&&0!==s.height){E=w.getImageData(s.x-s.width/2,s.y-s.height/2,s.width,s.height);D=E.data;J=D.length;if(s.each)for(G=0;G<J;G+=4)A={r:D[G],g:D[G+1],b:D[G+2],a:D[G+3]},s.each.call(m,A,s),D[G]=A.r,D[G+1]=A.g,D[G+2]=A.b,D[G+3]=A.a;w.putImageData(E,s.x-s.width/2,s.y-s.height/2);w.restore()}}return this};d.fn.getCanvasImage=function(d,n){var m=this[0];n===D&&
(n=1);return m&&m.toDataURL?m.toDataURL("image/"+d,n):f};d.fn.detectPixelRatio=function(f){var n,m,x,w,s,D,E;for(m=0;m<this.length;m+=1)n=this[m],d(this[m]),x=K(n),E=P(this[m]),E.scaled||(w=window.devicePixelRatio||1,s=x.webkitBackingStorePixelRatio||x.mozBackingStorePixelRatio||x.msBackingStorePixelRatio||x.oBackingStorePixelRatio||x.backingStorePixelRatio||1,w/=s,1!==w&&(s=n.width,D=n.height,n.width=s*w,n.height=D*w,n.style.width=s+"px",n.style.height=D+"px",x.scale(w,w)),E.pixelRatio=w,E.scaled=
A,f&&f.call(n,w));return this};d.support.canvas=d("<canvas />")[0].getContext;J.defaults=ia;J.transformShape=Q;J.detectEvents=V;J.closePath=X;J.getTouchEventName=Aa;d.jCanvas=J})(jQuery,document,Image,Math,parseFloat,!0,!1,null);
