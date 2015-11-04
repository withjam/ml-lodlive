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

  var utils = require('../../src/utils.js');

  var DEFAULT_BOX_TEMPLATE = '<div class="boxWrapper lodlive-node defaultBoxTemplate"><div class="ll-node-anchor"></div><div class="lodlive-node-label box sprite"></div></div>';

  /** LodLiveProfile constructor - Not sure this is even necessary, a basic object should suffice - I don't think it adds any features or logic
    * @Class LodLiveProfile
    */
  function LodLiveProfile() {

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
    this.hashFunc = this.options.hashFunc || utils.hashFunc;

    // TODO: move to renderer
    this.boxTemplate =  this.options.boxTemplate || DEFAULT_BOX_TEMPLATE;

    var httpClientFactory = require('../../src/http-client.js');

    var httpClient = httpClientFactory.create(
      this.options.connection['http:'].endpoint,
      this.options.endpoints.all,
      this.options.connection['http:'].accepts,
      this.getAjaxDataType()
    );

    var sparqlClientFactory = require('../../src/sparql-client.js');

    this.sparqlClient = sparqlClientFactory.create(
      this.options.connection['http:'].sparql,
      this.options.default.sparql,
      httpClient
    );

    var refStoreFactory = require('../../src/ref-store.js');

    this.refs = refStoreFactory.create();

    var rendererFactory = require('../../src/renderer.js');

    this.renderer = rendererFactory.create(
      this.options.arrows,
      this.options.UI.tools,
      this.options.UI.nodeIcons,
      this.refs
    );

    this.renderer.init(container);
    this.container = this.renderer.container;
    this.context = this.renderer.context;

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
    */

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

  LodLive.prototype.autoExpand = function(obj) {
    var inst = this, start, box;
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
          // TODO: where do we find moreInfoOnThis? (lol)
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

    // TODO: rename for clarity ?
    // var subjectId = circleId; var objectId = aId;

    if (!isInverse) {
      // TODO: add explaination for early return
      if (inst.refs.getObjectRefs(circleId).indexOf(aId) > -1) {
        return;
      }

      inst.refs.addObjectRef(circleId, aId);
      inst.refs.addSubjectRef(aId, circleId);
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
        inst.renderer.drawLine(obj, newObj, null, propertyName);
      } else {
        if (inst.debugOn) {
          console.debug((new Date().getTime() - start) + '  addNewDoc 09 ');
        }
        inst.openDoc(rel, newObj, fromInverse);
      }
    } else {
      if (!isInverse) {
        if (inst.debugOn) {
          console.debug((new Date().getTime() - start) + '  addNewDoc 10 ');
        }
        inst.renderer.drawLine(obj, newObj, null, propertyName);
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

    inst.renderer.clearLines(id);

    // get subjects where id is the object
    var subjectIds = inst.refs.getSubjectRefs(id);

    // get objects where id is the subject
    var objectIds = inst.refs.getObjectRefs(id)

    // remove references to id
    subjectIds.forEach(function(subjectId) {
      inst.refs.removeObjectRef(subjectId, id);
    });
    objectIds.forEach(function(objectId) {
      inst.refs.removeSubjectRef(objectId, id);
    });

    // get all pairs, excluding self
    var pairs = inst.renderer.getRelatedNodePairs(id, true);
    inst.renderer.drawLines(pairs);

    // remove references from id
    inst.refs.removeAsSubject(id);
    inst.refs.removeAsObject(id);

    // Image rendering has been disabled; keeping for posterity ...
    // var cp = inst.context.find('.lodLiveControlPanel');
    // if (inst.doCollectImages) {
    //   var imagesMap = inst.imagesMap;
    //   if (imagesMap[id]) {
    //     delete imagesMap[id];
    //     inst.updateImagePanel(cp);
    //     cp.find('a[class*=img-' + id + ']').remove();
    //   }
    // }

    // Map rendering has been disabled; keeping for posterity ...
    // if (inst.doDrawMap) {
    //   var mapsMap = inst.mapsMap;
    //   if (mapsMap[id]) {
    //     delete mapsMap[id];
    //     inst.updateMapPanel(cp);
    //   }
    // }

    inst.docInfo();

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

  LodLive.prototype.formatDoc = function(destBox, values, uris, bnodes, URI) {
    var inst = this;

    //TODO:  Some of these seem like they should be Utils functions instead of on the instance, not sure yet
    // recupero il doctype per caricare le configurazioni specifiche
    var docType = inst.getJsonValue(uris, 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'default');
    // carico le configurazioni relative allo stile
    destBox.addClass(inst.getProperty('document', 'className', docType));

    if (!values.length && !bnodes.length) {
      return destBox.append(inst.renderer.docInfoMissing());
    }

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

    var connectedImages = [];
    var connectedWeblinks = [];

    // TODO: get type IRIs from profile
    var types = [];

    uris.forEach(function(uriObj) {
      // TODO: confirm one key?
      var key = Object.keys(uriObj)[0];
      var value = uriObj[key];
      var newVal = {};

      // TODO: iterate type IRIs
      if (key !== 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type') {
        newVal[key] = value;
        if (images.indexOf(key) > -1) {
          connectedImages.push(newVal);
        } else if (weblinks.indexOf(key) > -1) {
          connectedWeblinks.push(newVal);
        }
      } else {
        types.push(unescape(value));
      }
    });


    // TODO: iterate values, looking up replacements in profile property mapper?

    destBox.append(inst.renderer.docInfoTypes(types));
    destBox.append(inst.renderer.docInfoImages(connectedImages));
    destBox.append(inst.renderer.docInfoLinks(connectedWeblinks));
    destBox.append(inst.renderer.docInfoValues(values));


    var renderedBnodes = inst.renderer.docInfoBnodes(bnodes);

    renderedBnodes.forEach(function(obj) {
      destBox.append(obj.bnodeNode);
      inst.resolveBnodes(unescape(obj.value), URI, obj.spanNode, destBox);
    });
  };

  LodLive.prototype.getAjaxDataType = function() {
    // TODO: consider accepting URL as parameter and detect if it requires JSONP or not
    return this.options.endpoints.jsonp ? 'jsonp' : 'json';
  };

  LodLive.prototype.resolveBnodes = function(val, URI, spanNode, destBox) {
    var inst = this;

    // TODO: figure out how to fall back to URI
    inst.sparqlClient.bnode(val, {
      beforeSend : function() {
        // destBox.find('span[class=bnode]').html('<img src="img/ajax-loader-black.gif"/>');
        return inst.renderer.loading(spanNode);
      },
      success : function(info ) {
        // s/b unnecessary
        // destBox.find('span[class=bnode]').html('');

        if (info.values.length) {
          inst.renderer.docInfoBnodeValues(info.values, spanNode);
        }

        info.bnodes.forEach(function(bnodeObj) {
          var key = Object.keys(bnodeObj)[0]
          var value = bnodeObj[value];

          var nestedBnodeNode = inst.renderer.docInfoNestedBnodes(key, spanNode);

          inst.resolveBnodes(unescape(value), URI, nestedBnodeNode, destBox);
        });

        // // TODO: slimScroll is no long included, and seems to be unnecessary
        // if (destBox.height() + 40 > $(window).height()) {
        //   destBox.slimScroll({
        //     height : $(window).height() - 40,
        //     color : '#fff'
        //   });
        // }
      },
      error : function(e, b, v) {
        // s/b unnecessary
        // destBox.find('span[class=bnode]').html('');
      }
    });
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
      result = '<div class="boxTitle" data-tooltip="' + utils.lang('resourceMissing') + '"><a target="_blank" href="' + thisUri + '"><span class="spriteLegenda"></span>' + thisUri + '</a>';
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
        jResult.text(utils.lang('noName'));
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
          if (docType == 'bnode' && value[akey].indexOf('~~') != -1) {
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
          if (resultArray[af].indexOf(' ') != -1) {
            eval('connectedLongs.push(\'' + unescape(resultArray[af].split(' ')[1]) + '\')');
            eval('connectedLats.push(\'' + unescape(resultArray[af].split(' ')[0]) + '\')');
          } else if (resultArray[af].indexOf('-') != -1) {
            eval('connectedLongs.push(\'' + unescape(resultArray[af].split('-')[1]) + '\')');
            eval('connectedLats.push(\'' + unescape(resultArray[af].split('-')[0]) + '\')');
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
        mapsMap[containerBox.attr('id')] = {
          longs : connectedLongs[0],
          lats : connectedLats[0],
          title : thisUri + '\n' + escape(resourceTitle)
        };
        inst.updateMapPanel(inst.context.find('.lodlive-controlPanel'));
      }
    }
    if (inst.doCollectImages) {
      if (connectedImages.length > 0) {
        var imagesMap = inst.imagesMap;
        imagesMap[containerBox.attr('id')] = connectedImages;
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
            var objBox = $('<div class="groupedRelatedBox" rel="' + inst.hashFunc(akey) + '" data-property="' + akey + '"  data-title="' + akey + ' \n ' + (propertyGroup[akey].length) + ' ' + utils.lang('connectedResources') + '" ></div>');
            objBox.css(inst.getRelationshipCSS(akey));
            // containerBox.append(objBox);
            var akeyArray = akey.split(' ');
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
            obj = $('<div class="aGrouped relatedBox ' + inst.hashFunc(akey) + ' ' + inst.hashFunc(unescape(value[akey])) + '" rel="' + unescape(value[akey]) + '"  data-title="' + akey + ' \n ' + unescape(value[akey]) + '" ></div>');
            // containerBox.append(obj);
            obj.attr('style', 'display:none;position:absolute;top:' + (chordsListGrouped[innerCounter][1] - 8) + 'px;left:' + (chordsListGrouped[innerCounter][0] - 8) + 'px');
            obj.attr('data-circlePos', innerCounter);
            obj.attr('data-circleParts', 36);
            obj.attr('data-circleid', containerBox.attr('id'));
          }

          innerCounter++;
        } else {
          obj = $('<div class="relatedBox ' + inst.hashFunc(unescape(value[akey])) + '" rel="' + unescape(value[akey]) + '"   data-title="' + akey + ' \n ' + unescape(value[akey]) + '" ></div>');
          // containerBox.append(obj);
          obj.attr('style', 'top:' + (chordsList[a][1] - 8) + 'px;left:' + (chordsList[a][0] - 8) + 'px');
          obj.attr('data-circlePos', a);
          obj.attr('data-circleParts', 24);
          a++;
          counter++;
        }
        if (obj) {
          obj.attr('data-circleid', containerBox.attr('id'));
          obj.attr('data-property', akey);
          obj.css(inst.getRelationshipCSS(akey));
          // se si tratta di un  Bnode applico una classe diversa
          var akeyArray = akey.split(' ');
          if (obj.attr('rel').indexOf('~~') != -1) {
            obj.addClass('isBnode');
          } else {
            for (var i = 0; i < akeyArray.length; i++) {
              if (lodLiveProfile.arrows[akeyArray[i]]) {
                obj.addClass(lodLiveProfile.arrows[akeyArray[i]]);
              }
            }
          }
          if (obj.hasClass('aGrouped')) {
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

            var objBox = $('<div class="groupedRelatedBox inverse" rel="' + inst.hashFunc(akey) + '-i"   data-property="' + akey + '" data-title="' + akey + ' \n ' + (propertyGroupInverted[akey].length) + ' ' + utils.lang('connectedResources') + '" ></div>');
            objBox.css(inst.getRelationshipCSS(akey));
            // containerBox.append(objBox);
            var akeyArray = akey.split(' ');
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
            obj = $('<div class="aGrouped relatedBox inverse ' + inst.hashFunc(akey) + '-i ' + inst.hashFunc(unescape(value[akey])) + ' " rel="' + destUri + '"  data-title="' + akey + ' \n ' + unescape(value[akey]) + '" ></div>');
            // containerBox.append(obj);
            obj.attr('style', 'display:none;position:absolute;top:' + (chordsListGrouped[innerCounter][1] - 8) + 'px;left:' + (chordsListGrouped[innerCounter][0] - 8) + 'px');
            obj.attr('data-circlePos', innerCounter);
            obj.attr('data-circleParts', 36);
            obj.attr('data-circleId', containerBox.attr('id'));
          }

          innerCounter++;
        } else {
          obj = $('<div class="relatedBox inverse ' + inst.hashFunc(unescape(value[akey])) + '" rel="' + unescape(value[akey]) + '"   data-title="' + akey + ' \n ' + unescape(value[akey]) + '" ></div>');
          // containerBox.append(obj);
          obj.attr('style', 'top:' + (chordsList[a][1] - 8) + 'px;left:' + (chordsList[a][0] - 8) + 'px');
          obj.attr('data-circlePos', a);
          obj.attr('data-circleParts', 24);
          a++;
          counter++;
        }
        if (obj) {
          obj.attr('data-circleId', containerBox.attr('id'));
          obj.attr('data-property', akey);
          obj.css(inst.getRelationshipCSS(akey));
          // se si tratta di un sameas applico una classe diversa
          var akeyArray = akey.split(' ');

          if (obj.attr('rel').indexOf('~~') != -1) {
            obj.addClass('isBnode');
          } else {
            for (var i = 0; i < akeyArray.length; i++) {
              if (lodLiveProfile.arrows[akeyArray[i]]) {
                obj.addClass(lodLiveProfile.arrows[akeyArray[i]]);
              }
            }
          }

          if (obj.hasClass('aGrouped')) {
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
    });

    // append the tools
    inst.renderer.generateNodeIcons(anchorBox);
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
          return inst.renderer.loading(destBox.children('.box'))
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
                return inst.renderer.loading(destBox.children('.box'));
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
                  inst.findInverseSameAs(anUri, inverses, callback);
                } else {
                  callback();
                }

              },
              error : function(e, b, v) {
                // s/b unnecessary
                // destBox.children('.box').html('');

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
