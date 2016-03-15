(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
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
    var profile = this.options = options;
    this.debugOn = options.debugOn && window.console; // don't debug if there is no console

    // allow them to override the docInfo function
    if (profile.UI.docInfo) {
      this.docInfo = profile.UI.docInfo;
    }

    // for backwards compatibility with existing profiles
    var connection;

    if (profile.connection.endpoint) {
      connection = profile.connection;
    } else {
      connection = {
        endpoint: profile.connection['http:'].endpoint,
        defaultParams: profile.endpoints.all,
        headers: { Accept: profile.connection['http:'].accepts },
        jsonp: profile.endpoints.jsonp
      };
    }

    // TODO: pass partially applied sparqlClientFactory as constructor paramter
    // (with an httpClientFactory already bound)
    var httpClientFactory = require('../../src/http-client.js');
    var sparqlClientFactory = require('../../src/sparql-client.js');

    this.sparqlClient = sparqlClientFactory.create(httpClientFactory, {
      connection: connection,
      queries: profile.queries || profile.connection['http:'].sparql
    });

    // TODO: pass factory as constructor parameter
    var rendererFactory = require('../../src/renderer.js');

    // for backwards compatibility with existing profiles
    var rendererProfile;

    if (profile.UI.arrows) {
      rendererProfile = profile.UI;
    } else {
      rendererProfile = {
        arrows: profile.arrows,
        tools: profile.UI.tools,
        nodeIcons: profile.UI.nodeIcons,
        relationships: profile.UI.relationships,
        hashFunc: profile.hashFunc
      };
    }

    this.renderer = rendererFactory.create(rendererProfile);
    // temporary, need access from both components
    this.refs = this.renderer.refs;
    this.renderer.boxTemplate = this.boxTemplate = profile.boxTemplate || DEFAULT_BOX_TEMPLATE;

    // allow override from profile
    if (profile.UI.nodeHover) {
      this.renderer.msg = profile.UI.nodeHover;
    }

    // TODO: should this be deferred till LodLive.init()?
    // (constructor shouldn't mutate the DOM)
    this.renderer.init(this, container);

    // temporary, need access from both components
    this.container = this.renderer.container;
    this.context = this.renderer.context;
  }

  LodLive.prototype.init = function(firstUri) {
    // instance data
    this.imagesMap = {};
    this.mapsMap = {};
    this.infoPanelMap = {};
    this.connection = {};

    // TODO: this option isn't respected anywhere
    this.ignoreBnodes = this.options.UI.ignoreBnodes;

    // TODO: look these up on the context object as data-lodlive-xxxx attributes
    // store settings on the instance
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

  LodLive.prototype.autoExpand = function() {
    var inst = this;

    inst.context.find('.relatedBox:not([class*=exploded])')
    .each(function() {
      var box = $(this);
      var aId = box.attr('relmd5');

      // if a subject box exists
      if (inst.context.children('#' + aId).length) {
        box.click();
      }
    });
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
      if (inst.refs.getObjectRefs(circleId).indexOf(aId) > -1) {
        return;
      }

      inst.refs.addObjectRef(circleId, aId);
      inst.refs.addSubjectRef(aId, circleId);
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

      var chordsListExpand = utils.circleChords(
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
        fromInverse = inst.context.find('div[data-property="' + propertyName + '"][rel="' + rel + '"]');
      }

      inst.openDoc(rel, newObj, fromInverse);
    }

    if (!isInverse) {
      inst.renderer.drawLine(originalCircle, newObj, null, propertyName);
    }
  };

  LodLive.prototype.removeDoc = function(obj, callback) {
    var inst = this;

    var isRoot = inst.context.find('.lodlive-node').length == 1;
    if (isRoot) {
        alert('Cannot Remove Only Box');
        return;
    }

    // TODO: why remove and not hide?
    inst.context.find('.lodlive-toolbox').remove();

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

      // re-show predicate boxes that pointed to this object
      inst.context.find('div[relmd5=' + id + ']').each(function() {
        var found = $(this);
        found.show();
        found.removeClass('exploded');
      });
    });
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
        types.push(value);
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
      inst.resolveBnodes(obj.value, URI, obj.spanNode, destBox);
    });
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

          inst.resolveBnodes(value, URI, nestedBnodeNode, destBox);
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
          returnVal.push(value[akey]);
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

    var titlePieces = [];

    titles.forEach(function(title) {
      var titleValues;

      if (title.indexOf('http') !== 0) {
        titlePieces.push($.trim(title));
      } else {
        titleValues = inst.getJsonValue(values, title, title.indexOf('http') === 0 ? '' : title);
        titleValues.forEach(function(titleValue) {
          titlePieces.push(titleValue);
        });
      }
    });

    var title = titlePieces
    // deduplicate
    .filter(function(value, index, self) {
      return self.indexOf(value) === index;
    })
    .join('\n');

    // TODO: early return?
    if (uris.length == 0 && values.length == 0) {
      title = utils.lang('resourceMissing');
    } else if (!title && docType === 'bnode') {
      title = '[blank node]';
    } else if (!title) {
      title = '(Error)';
      try {
        title = inst.options.default.document.titleName[thisUri];
      } catch(ex) {
        title = inst.options.default.document.titleProperties[thisUri];
      }
    }

    inst.renderer.addBoxTitle(title, thisUri, destBox, containerBox);

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

    var chordsList = utils.circleChords(75, 24, destBox.position().left + 65, destBox.position().top + 65);
    var chordsListGrouped = utils.circleChords(95, 36, destBox.position().left + 65, destBox.position().top + 65);

    // iterate over connectedDocs and invertedDocs, creating DOM nodes and calculating CSS positioning
    var connectedNodes = inst.renderer.createPropertyBoxes(connectedDocs, propertyGroup, containerBox, chordsList, chordsListGrouped, false);
    var invertedNodes = inst.renderer.createPropertyBoxes(invertedDocs, propertyGroupInverted, containerBox, chordsList, chordsListGrouped, true);

    // aggiungo al box i link ai documenti correlati
    var objectList = connectedNodes.objectList.concat(invertedNodes.objectList);
    var innerObjectList = connectedNodes.innerObjectList.concat(invertedNodes.innerObjectList);

    // paginate and display the related boxes
    inst.renderer.paginateRelatedBoxes(containerBox, objectList, innerObjectList, chordsList);

    // append the tools
    inst.renderer.generateNodeIcons(anchorBox);
  };

  LodLive.prototype.openDoc = function(anUri, destBox, fromInverse) {
    var inst = this;
    var lodLiveProfile = inst.options;

    if (!anUri) {
      $.error('LodLive: no uri for openDoc');
    }

    // TODO: what is methods && what is doStats? neither exist ...
    // if (inst.doStats) {
    //   methods.doStats(anUri);
    // }

    destBox.attr('data-endpoint', lodLiveProfile.connection['http:'].endpoint);

    var inverses = [];

    function callback(info) {
      inst.format(destBox.children('.box'), info.values, info.uris, inverses);

      if (fromInverse && fromInverse.length) {
        $(fromInverse).click();
      }

      if (inst.doAutoExpand) {
        inst.autoExpand(destBox);
      }
    };

    inst.sparqlClient.documentUri(anUri, {
      beforeSend : function() {
        // destBox.children('.box').html('<img style=\"margin-top:' + (destBox.children('.box').height() / 2 - 8) + 'px\" src="img/ajax-loader.gif"/>');
        return inst.renderer.loading(destBox.children('.box'))
      },
      success : function(info) {
        // reformat values for compatility

        // TODO: refactor `format()` and remove this
        info.bnodes.forEach(function(bnode) {
          var keys = Object.keys(bnode)
          var value = {};
          keys.forEach(function(key) {
            value[key] = anUri + '~~' + bnode[key];
          })
          info.uris.push(value);
        })

        delete info.bnodes;

        // TODO: filter info.uris where object value === anURI (??)

        // s/b unnecessary
        // destBox.children('.box').html('');

        if (!inst.doInverse) {
          return callback(info);
        }

        inst.sparqlClient.inverse(anUri, {
          beforeSend : function() {
            // destBox.children('.box').html('<img id="1234" style=\"margin-top:' + (destBox.children('.box').height() / 2 - 5) + 'px\" src="img/ajax-loader.gif"/>');
            return inst.renderer.loading(destBox.children('.box'));
          },
          success : function(inverseInfo) {
            // TODO: skip values?
            inverses = inverseInfo.uris.concat(inverseInfo.values);

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

            if (inst.doAutoSameas) {
              inst.findInverseSameAs(anUri, inverses, function() {
                callback(info);
              });
            } else {
              callback(info);
            }
          },
          error : function(e, b, v) {
            // s/b unnecessary
            // destBox.children('.box').html('');

            callback(info);
          }
        });
      },
      error : function(e, b, v) {
        inst.renderer.errorBox(destBox);
      }
    });
  };

  LodLive.prototype.findInverseSameAs = function(anUri, inverse, callback) {
    var inst = this;

    // TODO: why two options? (useForInverseSameAs and doAutoSameas)
    if (!inst.options.connection['http:'].useForInverseSameAs) {
      return setTimeout(function() { callback(); }, 0);
    }

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
          newObj[key] = value.object.value;
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

},{"../../src/http-client.js":3,"../../src/renderer.js":5,"../../src/sparql-client.js":6,"../../src/utils.js":7}],2:[function(require,module,exports){
'use strict'

function enableDrag(container, context, draggableSelector, dragStart) {
  var $window = $(window);
  var parent = context.parent();
  var dragState = {};
  var dragStop = null;

  // watch mouse move events on the container to move anything being dragged
  container.on('mousemove', function(event) {
    var cx = event.clientX;
    var cy = event.clientY;
    var lastx = dragState.lastx;
    var lasty = dragState.lasty;
    dragState.lastx = cx;
    dragState.lasty = cy;

    // dragging a node
    if (dragState.target) {
      if (!dragState.isDragging) {
        // just started the drag
        dragState.isDragging = true;
        dragStop = dragStart(dragState);

        // cache positions that won't change while dragging
        dragState.scrollX = parent.scrollLeft() + $window.scrollLeft() - parent.offset().left - dragState.offsetX;
        dragState.scrollY = parent.scrollTop() + $window.scrollTop() - parent.offset().top - dragState.offsetY;
      }

      requestAnimationFrame(function() {
        dragState.target && dragState.target.css({
          left: cx + dragState.scrollX,
          top: cy + dragState.scrollY
        });
      });
    } else if (dragState.panning) {
      requestAnimationFrame(function() {
        parent.scrollLeft(parent.scrollLeft() + lastx - cx);
        parent.scrollTop(parent.scrollTop() + lasty - cy);
      });
    }
  });

  container.on('mousedown', draggableSelector, function(event) {
    // mark the node as being dragged using event-delegation
    dragState.target = $(this);
    dragState.panning = false;

    // store offset of event so node moves properly
    dragState.offsetX = event.offsetX;
    dragState.offsetY = event.offsetY;

    event.stopPropagation();
    event.preventDefault();
  });

  container.on('mousedown', function(event) {
    dragState.target = null;
    dragState.panning = true;
    event.stopPropagation();
    event.preventDefault();
  });

  function cancelDrag() {
    if (dragStop) dragStop();
    dragStop = null;
    dragState.isDragging = false;
    dragState.target = null;
    dragState.panning = false;
  }

  container.on('mouseup', cancelDrag);

  $(document).on('keydown', function(event) {
    // esc key
    if (event.keyCode === 27) {
      cancelDrag();
    }
  });
}

module.exports = enableDrag;

},{}],3:[function(require,module,exports){
'use strict'

var httpClientFactory = {
  /*
   * Create a new httpClient instance
   *
   * @param {Object} connection - connection configuration
   * @prop {String} connection.endpoint - the request endpoint URL
   * @prop {Object|String} connection.defaultParams - the default URL params
   * @prop {Object} connection.headers - request headers
   * @prop {Boolean} jsonp - make a JSONP request instead of AJAX
   * @return {Function} an httpClient instance
   */
  create: function(connection) {
    if (!connection.endpoint) {
      throw new Error('missing required connection.endpoint for httpClient');
    }

    function parseParams(params) {
      if (!connection.defaultParams) {
        return $.param(params)
      } else if (typeof connection.defaultParams === 'object') {
        return $.param($.extend({}, connection.defaultParams, params))
      } else {
        return connection.defaultParams + '&' + $.param(params)
      }
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

      var fullUrl = connection.endpoint + '?' + parseParams(params);
      var afterSend;

      $.ajax({
        url: fullUrl,
        contentType: 'application/json',
        dataType: connection.jsonp ? 'jsonp': 'json',
        headers: connection.headers || {},
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
    }
  }
};

module.exports = httpClientFactory;

// temporary, for testing
if (!window.httpClientFactory) {
  window.httpClientFactory = httpClientFactory;
}

},{}],4:[function(require,module,exports){
'use strict'

function LodLiveRefStore() {}

/**
 * Gets the Ids of all active objects with references from `subject`
 *
 * @param {String} subject - the Id of an active subject
 * @return {Array<String>} object Ids
 */
LodLiveRefStore.prototype.getObjectRefs = function(subject) {
  return this.storeIds['gen' + subject] || [];
};

/**
 * Sets `objects` as the list of references from `subject`
 *
 * @param {String} subject - the Id of an active subject
 * @param {Array<String>} objects - the Ids of `subject`'s objects
 */
LodLiveRefStore.prototype.setObjectRefs = function(subject, objects) {
  this.storeIds['gen' + subject] = objects;
}

/**
 * Adds an active object reference from `subject`
 *
 * @param {String} subject - the Id of an active subject
 * @param {String} object - the Id of an object of `subject`
 */
LodLiveRefStore.prototype.addObjectRef = function(subject, object) {
  var objects = this.getObjectRefs(subject);

  if (objects.indexOf(object) === -1) {
    objects.push(object);
  }

  this.setObjectRefs(subject, objects);
};

/**
 * Removes an active object reference from `subject`
 *
 * @param {String} subject - the Id of an active subject
 * @param {String} object - the Id of an object of `subject`
 */
LodLiveRefStore.prototype.removeObjectRef = function(subject, object) {
  var objects = this.getObjectRefs(subject);
  var index = objects.indexOf(object);

  if (index > -1) {
    objects.splice(index, 1);
  }
};

/**
 * Removes all references to `object`
 *
 * @param {String} object - the Id of an object
 */
LodLiveRefStore.prototype.removeAsObject = function(object) {
  delete this.storeIds['rev' + object];
};

/**
 * Gets the Ids of all active subjects with references to `object`
 *
 * @param {String} object - the Id of an active object
 * @return {Array<String>} subject Ids
 */
LodLiveRefStore.prototype.getSubjectRefs = function(object) {
  return this.storeIds['rev' + object] || [];
};

/**
 * Sets `subjects` as the list of references from `object`
 *
 * @param {String} subjects - the Ids of `object`'s subjects
 * @param {Array<String>} object - the Id of an active object
 */
LodLiveRefStore.prototype.setSubjectRefs = function(object, subjects) {
  this.storeIds['rev' + object] = subjects;
}

/**
 * Adds an active subject reference to `object`
 *
 * @param {String} object - the Id of an active object
 * @param {String} subject - the Id of a subject of `object`
 */
LodLiveRefStore.prototype.addSubjectRef = function(object, subject) {
  var subjects = this.getSubjectRefs(object);

  if (subjects.indexOf(subject) === -1) {
    subjects.push(subject);
  }

  this.setSubjectRefs(object, subjects);
};

/**
 * Removes an active subject reference from `object`
 *
 * @param {String} object - the Id of an active object
 * @param {String} subject - the Id of a subject of `object`
 */
LodLiveRefStore.prototype.removeSubjectRef = function(object, subject) {
  var subjects = this.getSubjectRefs(object);
  var index = subjects.indexOf(subject);

  if (index > -1) {
    subjects.splice(index, 1);
  }
};

/**
 * Removes all references from `subject`
 *
 * @param {String} subject - the Id of an subject
 */
LodLiveRefStore.prototype.removeAsSubject = function(subject) {
  delete this.storeIds['gen' + subject];
};

var refStoreFactory = {
  create: function () {
    var store = Object.create(LodLiveRefStore.prototype);
    store.storeIds = {};
    return store;
  }
};

module.exports = refStoreFactory;

// temporary, for testing
if (!window.refStoreFactory) {
  window.refStoreFactory = refStoreFactory;
}

},{}],5:[function(require,module,exports){
'use strict'

var utils = require('./utils.js');
var refStoreFactory = require('./ref-store.js');

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

function LodLiveRenderer(options) {
  if (!(this instanceof LodLiveRenderer)) {
    return new LodLiveRenderer(options);
  }

  this.refs = refStoreFactory.create();

  this.hashFunc = options.hashFunc || utils.hashFunc;
  this.arrows = options.arrows;
  this.tools = options.tools;
  this.nodeIcons = options.nodeIcons;
  this.relationships = options.relationships;
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

LodLiveRenderer.prototype.reDrawLines = function(target) {
  var renderer = this;
  var id = target.attr('id');
  var nodes = renderer.getRelatedNodePairs(id);

  if (!nodes || !nodes.length) return;

  var canvases = renderer.getRelatedCanvases(id);
  var shouldContinue = true;

  function draw() {
    renderer.clearLines(canvases);
    renderer.drawLines(nodes);

    if (shouldContinue) {
      requestAnimationFrame(draw);
    }
  }

  requestAnimationFrame(draw);

  return function() {
    shouldContinue = false;
  };
};

/**
 * Renders doc-info missing message
 *
 * @returns {Object} a jQuery node
 */
LodLiveRenderer.prototype.docInfoMissing = function() {
  var renderer = this;

  var sectionNode = $('<div class="section"></div>');
  var textNode = $('<div></div>').text(utils.lang('resourceMissingDoc'));

  // TODO: no text, nothing to show
  var labelNode = $('<label></label>')
  .attr('data-title',  utils.lang('resourceMissingDoc'));

  sectionNode.append(labelNode).append(textNode);

  return sectionNode;
};

/**
 * Renders doc-info types
 *
 * @param {Array<String>} types
 * @returns {Object} a jQuery node
 */
LodLiveRenderer.prototype.docInfoTypes = function(types) {
  var renderer = this;

  if (!types.length) return null;

  // TODO: get types from profile
  var labelNode = $('<label data-title="http://www.w3.org/1999/02/22-rdf-syntax-ns#type">type</label>');

  var wrapperNode = $('<div></div>');

  types.forEach(function(type) {
    var typeNode = $('<span></span>')
    .attr('title', type)
    // space required to allow wrapping
    // TODO: create an <ul/> ?
    .text(utils.shortenKey(type) + ' ');

    wrapperNode.append(typeNode);
  });

  var sectionNode = $('<div class="section"></div>')
  .append(labelNode)
  .append(wrapperNode);

  return sectionNode;
};

/**
 * Renders doc-info images
 *
 * @param {Array<String>} images
 * @returns {Object} a jQuery node
 */
LodLiveRenderer.prototype.docInfoImages = function(images) {
  if (!images.length) return null;

  var sectionNode = $('<div class="section" style="height:80px"></div>');

  images.forEach(function(imgObj) {
    var key = Object.keys(imgObj)[0];
    var value = imgObj[key];

    var linkNode = $('<a></a>').attr('href', value);
    var imgNode = $('<img/>').attr('src', value);

    linkNode.append(imgNode);
    sectionNode.append(linkNode);

    imgNode.load(function() {
      var width = imgNode.width();
      var height = imgNode.height();

      if (width > height) {
        imgNode.height(height * 80 / width);
        imgNode.width(80);
      } else {
        imgNode.width(width * 80 / height);
        imgNode.height(80);
      }
    });

    imgNode.error(function() {
      imgNode.attr('title', utils.lang('noImage') + ' \n' + imgNode.attr('src'));
      // TODO: use a font-awesome icon instead?
      // imgNode.attr('src', 'img/immagine-vuota-' + $.jStorage.get('selectedLanguage') + '.png');
    });

    // TODO: find a replacement for this missing dependency
    // sectionNode.fancybox({
    //   'transitionIn' : 'elastic',
    //   'transitionOut' : 'elastic',
    //   'speedIn' : 400,
    //   'type' : 'image',
    //   'speedOut' : 200,
    //   'hideOnContentClick' : true,
    //   'showCloseButton' : false,
    //   'overlayShow' : false
    // });
  });

  return sectionNode;
};

/**
 * Renders doc-info links
 *
 * @param {Array<String>} images
 * @returns {Object} a jQuery node
 */
LodLiveRenderer.prototype.docInfoLinks = function(links) {
  var renderer = this;

  if (!links.length) return null;

  var sectionNode = $('<div class="section"></div>');
  // TODO: move styles to external sheet
  var wrapperNode = $('<ul style="padding:0;margin:0;display:block;overflow:hidden;tex-overflow:ellipses"></ul>');

  links.forEach(function(linkObj) {
    var key = Object.keys(linkObj)[0];
    var value = linkObj[key];

    var listItemNode = $('<li></li>');
    var linkNode = $('<a class="relatedLink" target="_blank"></a>')
    .attr('data-title', key + ' \n ' + value)
    .attr('href', value)
    .text(value);

    listItemNode.append(linkNode);
    wrapperNode.append(listItemNode);
  });

  sectionNode.append(wrapperNode);

  return sectionNode;
};

/**
 * Renders doc-info values
 *
 * @param {Array<String>} values
 * @returns {Object} a jQuery node
 */
LodLiveRenderer.prototype.docInfoValues = function(values) {
  var renderer = this;

  if (!values.length) return null;

  var wrapperNode = $('<div></div>');

  values.forEach(function(valueObj) {
    var key = Object.keys(valueObj)[0];
    var value = valueObj[key];

    // TODO: lookup replacements from properties mapper?
    var shortKey = utils.shortenKey(key);

    var sectionNode = $('<div class="section"></div>');
    var labelNode = $('<label></label>')
    .attr('data-title', key)
    .text(shortKey);

    var textNode = $('<div></div>').text(value);

    sectionNode.append(labelNode).append(textNode);

    wrapperNode.append(sectionNode);
  });

  return wrapperNode;
};

/**
 * Renders doc-info bnode placeholders
 *
 * @param {Array<String>} bnodes
 * @returns {Array<Object>} an array of jQuery nodes
 */
LodLiveRenderer.prototype.docInfoBnodes = function(bnodes) {
  var renderer = this;

  return bnodes.map(function(bnodeObj) {
    var key = Object.keys(bnodeObj)[0];
    var value = bnodeObj[key];
    var shortKey = utils.shortenKey(key);

    var bnodeNode = $('<div class="section"></div>');
    var labelNode = $('<label></label>')
    .attr('data-title', key)
    .text(shortKey);

    var spanNode = $('<span class="bnode"></span>')

    bnodeNode.append(labelNode).append(spanNode);

    return {
      value: value,
      spanNode: spanNode,
      bnodeNode: bnodeNode
    };
  });
};

/**
 * Renders doc-info bnode values
 *
 * @param {Array<String>} values
 * @param {Object} spanNode - a jQuery node (placeholder for value)
 * @returns {Object} a jQuery node
 */
LodLiveRenderer.prototype.docInfoBnodeValues = function(values, spanNode) {
  spanNode.attr('class', '')

  values.forEach(function(valueObj) {
    var key = Object.keys(valueObj)[0]
    var value = valueObj[key];
    var shortKey = utils.shortenKey(key);

    var labelNode = $('<em></em>')
    .attr('title', key)
    .text(shortKey);

    var textNode = $('<span></span>').text(': ' + value);

    var valueNode = $('<div></div>').append(labelNode).append(textNode);

    spanNode.append(valueNode);
  });
};

/**
 * Renders doc-info bnode nested placeholders
 *
 * @param {String} key
 * @param {Object} spanNode - a jQuery node (placeholder for value)
 * @returns {Object} a jQuery node
 */
LodLiveRenderer.prototype.docInfoNestedBnodes = function(key, spanNode) {
  var renderer = this;

  var wrapperNode = $('<span></span>');
  var labelNode = $('<label></label')
  .attr('data-title', key)
  .text(utils.shortenKey(key))

  var bnodeNode = $('<span class="bnode"></span>')

  wrapperNode.append(labelNode).append(bnodeNode);

  spanNode.attr('class', '').append(wrapperNode);

  return bnodeNode;
};

/**
 * Add title to box
 */
LodLiveRenderer.prototype.addBoxTitle = function(title, thisUri, destBox, containerBox) {
  var renderer = this;

  var jResult = $('<div></div>')
  .addClass('boxTitle');

  // TODO: this is a hack; find some other way to catch this condition
  if (title === utils.lang('resourceMissing')) {
    jResult.append('<a target="_blank" href="' + thisUri + '">' + thisUri + '</a>')
    // TODO: fa-external-link?
    .append('<span class="spriteLegenda"></span>');
  } else {
    if (!title) {
      title = utils.lang('noName');
    }

    var result = $('<span class="ellipsis_text"></span>');
    result.text(title);
    jResult.append(result);
  }

  jResult.attr('data-tooltip', title);
  destBox.append(jResult);
};

/**
 * iterates over predicates/object relationships, creating DOM nodes and calculating CSS positioning
 */
LodLiveRenderer.prototype.createPropertyBoxes = function createPropertyBoxes(inputArray, inputGroup, containerBox, chordsList, chordsListGrouped, isInverse) {
  var renderer = this;
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

        var objBox = renderer.createPropertyGroup(key, inputGroup[key], chordsList, counter, isInverse);
        objectList.push(objBox);
        counter++;
      }

      // TODO: magic number; why 25?
      if (innerCounter < 25) {
        obj = renderer.createGroupedRelatedBox(key, value[key], containerBox, chordsListGrouped, innerCounter, isInverse);
        innerObjectList.push(obj);
      }

      innerCounter++;
    } else {
      obj = renderer.createRelatedBox(key, value[key], containerBox, chordsList, counter, isInverse);
      objectList.push(obj);
      counter++;
    }
  });

  return {
    objectList: objectList,
    innerObjectList: innerObjectList
  }
};

LodLiveRenderer.prototype.getRelationshipCSS = function(uri) {
  return this.relationships && this.relationships[uri] || {};
};

/**
 * create a node to represent a group of related properties (star-circle)
 */
LodLiveRenderer.prototype.createPropertyGroup = function createPropertyGroup(predicates, groupValue, chordsList, counter, isInverse) {
  var renderer = this;
  var box = $('<div></div>')
  .addClass('groupedRelatedBox')
  .attr('rel', renderer.hashFunc(predicates).toString())
  .attr('data-property', predicates)
  .attr('data-title', predicates + ' \n ' + (groupValue.length) + ' ' + utils.lang('connectedResources'))
  .css(renderer.getRelationshipCSS(predicates))
  .css({
    'top':  (chordsList[counter][1] - 8) + 'px',
    'left': (chordsList[counter][0] - 8) + 'px'
  });

  if (isInverse) {
    box.addClass('inverse');
    box.attr('rel', renderer.hashFunc(predicates).toString() + '-i');
  }

  if (groupValue[0].indexOf('~~') > -1) {
    box.addClass('isBnode');
  } else {
    predicates.split(' ').forEach(function(predicate) {
      if (renderer.arrows[predicate]) {
        box.addClass(renderer.arrows[predicate]);
      }
    });
  }

  return box;
};

/**
 * create a node to represent a property in a group of related properties
 */
LodLiveRenderer.prototype.createGroupedRelatedBox = function createGroupedRelatedBox(predicates, object, containerBox, chordsListGrouped, innerCounter, isInverse) {
  var box = this._createRelatedBox(predicates, object, containerBox, isInverse)
  // this class is probably unnecessary now...
  .addClass('aGrouped')
  .attr('data-circlePos', innerCounter)
  .attr('data-circleParts', 36)
  .css({
    display: 'none',
    position: 'absolute',
    top: (chordsListGrouped[innerCounter][1] - 8) + 'px',
    left: (chordsListGrouped[innerCounter][0] - 8) + 'px'
  });

  if (isInverse) {
    box.addClass(this.hashFunc(predicates).toString() + '-i');
  } else {
    box.addClass(this.hashFunc(predicates).toString());
  }

  return box;
};

/**
 * create a node to represent a related property
 */
LodLiveRenderer.prototype.createRelatedBox = function createRelatedBox(predicates, object, containerBox, chordsList, counter, isInverse) {
  return this._createRelatedBox(predicates, object, containerBox, isInverse)
  .attr('data-circlePos', counter)
  .attr('data-circleParts', 24)
  .css({
    top: (chordsList[counter][1] - 8) + 'px',
    left: (chordsList[counter][0] - 8) + 'px'
  });
};

LodLiveRenderer.prototype._createRelatedBox = function _createRelatedBox(predicates, object, containerBox, isInverse) {
  var renderer = this;
  var box = $('<div></div>')
  .addClass('relatedBox ' + renderer.hashFunc(object).toString())
  .attr('rel', object)
  .attr('relmd5', renderer.hashFunc(object).toString())
  .attr('data-title', predicates + ' \n ' + object)
  .attr('data-circleid', containerBox.attr('id'))
  .attr('data-property', predicates)
  .css(renderer.getRelationshipCSS(predicates));

  if (isInverse) {
    box.addClass('inverse');
  }

  if (object.indexOf('~~') > -1) {
    box.addClass('isBnode');
  } else {
    predicates.split(' ').forEach(function(predicate) {
      if (renderer.arrows[predicate]) {
        box.addClass(renderer.arrows[predicate]);
      }
    });
  }

  return box;
};

/**
 * Paginates related boxes in `objectList` and `innerObjectList`
 */
LodLiveRenderer.prototype.paginateRelatedBoxes = function(containerBox, objectList, innerObjectList, chordsList) {
  var page = 0;
  var prevChords = chordsList[0];
  var nextChords = chordsList[15];
  var totPages = objectList.length > 14 ? (objectList.length / 14 + (objectList.length % 14 > 0 ? 1 : 0)) : 1;

  objectList.forEach(function(objectListItem, i) {
    var aPage, prevPage, nextPage;

    if (i % 14 === 0) {
      page++;

      aPage = $('<div></div>')
      .addClass('page page' + page)
      .attr('style', 'display:none');

      if (page > 1 && totPages > 1) {
        prevPage = $('<div></div>')
        .addClass('llpages pagePrev')
        // TODO: can the icon be rotated?
        .addClass('fa fa-arrow-left')
        .attr('data-page', 'page' + (page - 1))
        .attr('style', 'top:' + (prevChords[1] - 8) + 'px;left:' + (prevChords[0] - 8) + 'px');

        aPage.append(prevPage);
      }

      if (totPages > 1 && page < totPages - 1) {
        nextPage = $('<div></div>')
        .addClass('llpages pageNext')
        // TODO: can the icon be rotated?
        .addClass('fa fa-arrow-right')
        .attr('data-page', 'page' + (page + 1))
        .attr('style', 'top:' + (nextChords[1] - 8) + 'px;left:' + (nextChords[0] - 8) + 'px');

        aPage.append(nextPage);
      }

      containerBox.append(aPage);
    }

    containerBox.children('.page' + page).append(objectListItem);
  });

  var innerPage = $('<div class="innerPage"></div>');

  innerObjectList.forEach(function(innerObject) {
    innerPage.append(innerObject);
  });

  if (innerObjectList.length > 0) {
    containerBox.append(innerPage);
  }

  containerBox.children('.page1').fadeIn('fast');
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
};

/**
 * Configure hover interactions
 */
LodLiveRenderer.prototype.initHover = function initHover() {
  var renderer = this;

  // docInfo labels
  this.container.on('mouseenter mouseleave', '.lodlive-docinfo label, .lodlive-docinfo a', function(event) {
    if (event.type === 'mouseleave') {
      return renderer.msg(null, 'hide');
    }

    renderer.msg($(event.target).data('title'), 'show');
  });

  // nodes
  this.container.on('mouseenter mouseleave', '.box', function(event) {
    if (event.type === 'mouseleave') {
      return renderer.msg(null, 'hide');
    }

    var target = $(event.target);
    var title = target.is('.errorBox') ?
                utils.lang('endpointNotAvailableOrSLow') :
                target.children('.boxTitle').data('tooltip');

    renderer.msg(title, 'show', 'fullInfo', target.parent('div').data('endpoint'));
  });

  // related nodes
  this.container.on('mouseenter mouseleave', '.relatedBox, .groupedRelatedBox', function(event) {
    if (event.type === 'mouseleave') {
      return renderer.msg(null, 'hide');
    }

    var target = $(event.target);
    renderer.msg(target.data('title'), 'show', null, null, target.is('.inverse'));
  });
};

/**
 * Configure click interactions
 *
 * @param {LodLive} inst - instance of lodlive
 */
LodLiveRenderer.prototype.initClicks = function initClicks(inst) {
  var renderer = this;

  // tools
  this.container.on('click', '.actionBox', function(event) {
    // TODO: why is this not always actionBox, but sometimes a descendant?
    var target = $(event.target).closest('.actionBox');
    var node = target.closest('.lodlive-node');
    var handler = target.data('action-handler');

    if (handler) {
      return handler.call(target, node, inst, event);
    }

    switch(target.attr('rel')) {
      case 'docInfo':
        inst.docInfo(node);
        break;
      case 'tools':
        renderer.generateTools(target, node, inst).fadeToggle('fast');
        break;
      // TODO: default error?
    }
  });

  // related nodes
  this.container.on('click', '.relatedBox', function(event) {
    var target = $(event.target);
    var node = target.closest('.lodlive-node');

    target.addClass('exploded');
    inst.addNewDoc(node, target);
    // event.stopPropagation();
  });

  // related node groups
  this.container.on('click', '.groupedRelatedBox', function(event) {
    var target = $(event.target);
    var node = target.closest('.lodlive-node');

    if (target.data('show')) {
      target.data('show', false);
      inst.docInfo();
      target.removeClass('lastClick');
      node.find('.' + target.attr('rel')).fadeOut('fast');
      target.fadeTo('fast', 1);
      node.children('.innerPage').hide();
    } else {
      target.data('show', true);
      node.children('.innerPage').show();
      inst.docInfo();
      node.find('.lastClick').removeClass('lastClick').click();
      target.addClass('lastClick');
      node.find('.' + target.attr('rel') + ':not([class*=exploded])').fadeIn('fast');
      target.fadeTo('fast', 0.3);
    }
  });

  // pagination
  this.container.on('click', '.llpages', function(event) {
    var target = $(event.target);
    var pageSelector = '.' + target.data('page');

    target.siblings('.lastClick').removeClass('lastClick').click();

    target.parent().fadeOut('fast', null, function() {
      $(this).parent().children(pageSelector).fadeIn('fast');
    });
  });
};

LodLiveRenderer.prototype.init = function(inst, container) {
  var renderer = this;

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

  var draggable = require('./draggable.js');

  draggable(this.container, this.context, '.lodlive-node', function(dragState) {
    return renderer.reDrawLines(dragState.target);
  });

  this.initHover();
  this.initClicks(inst);
};

var rendererFactory = {
  create: function(options) {
    return new LodLiveRenderer(options);
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

},{"./draggable.js":2,"./ref-store.js":4,"./utils.js":7}],6:[function(require,module,exports){
'use strict'

var defaultQueries = {
  documentUri: 'SELECT DISTINCT * WHERE {<{URI}> ?property ?object} ORDER BY ?property',
  document: 'SELECT DISTINCT * WHERE {<{URI}> ?property ?object}',
  bnode: 'SELECT DISTINCT *  WHERE {<{URI}> ?property ?object}',
  inverse: 'SELECT DISTINCT * WHERE {?object ?property <{URI}>.} LIMIT 100',
  inverseSameAs: 'SELECT DISTINCT * WHERE {{?object <http://www.w3.org/2002/07/owl#sameAs> <{URI}> } UNION { ?object <http://www.w3.org/2004/02/skos/core#exactMatch> <{URI}>}}'
};

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

function SparqlClient(httpClientFactory, options) {
  if (!(this instanceof SparqlClient)) {
    return new SparqlClient(httpClientFactory, options);
  }

  this.httpClient = httpClientFactory.create(options.connection);

  this.getQueryTemplate = function(axis) {
    return options.queries && options.queries[axis] ?
           options.queries[axis] :
           defaultQueries[axis];
  };
}

SparqlClient.prototype.getQuery = function getQuery(axis, iri) {
  return this.getQueryTemplate(axis)
  .replace(/\{URI\}/ig, iri.replace(/^.*~~/, ''));
};

SparqlClient.prototype.document = function document(iri, callbacks) {
  var axis = 'document';
  var query = this.getQuery(axis, iri);

  return this.httpClient({ query: query }, {
    beforeSend: callbacks.beforeSend,
    error: callbacks.error,
    success : function(json) {
      if ( !(json && json.results && json.results.bindings) ) {
        console.error(json);
        return callbacks.error(new Error('malformed results'));
      }

      callbacks.success( parseResults(json.results.bindings) );
    }
  });
};

SparqlClient.prototype.bnode = function bnode(iri, callbacks) {
  var axis = 'bnode';
  var query = this.getQuery(axis, iri);

  return this.httpClient({ query: query }, {
    beforeSend: callbacks.beforeSend,
    error: callbacks.error,
    success : function(json) {
      if ( !(json && json.results && json.results.bindings) ) {
        console.error(json);
        return callbacks.error(new Error('malformed results'));
      }

      callbacks.success( parseResults(json.results.bindings) );
    }
  });
};

SparqlClient.prototype.documentUri = function documentUri(iri, callbacks) {
  var axis = 'documentUri';
  var query = this.getQuery(axis, iri);

  return this.httpClient({ query: query }, {
    beforeSend: callbacks.beforeSend,
    error: callbacks.error,
    success : function(json) {
      if ( !(json && json.results && json.results.bindings) ) {
        console.error(json);
        return callbacks.error(new Error('malformed results'));
      }

      callbacks.success( parseResults(json.results.bindings) );
    }
  });
};

SparqlClient.prototype.inverse = function inverse(iri, callbacks) {
  var axis = 'inverse';
  var query = this.getQuery(axis, iri);

  return this.httpClient({ query: query }, {
    beforeSend: callbacks.beforeSend,
    error: callbacks.error,
    success : function(json) {
      if ( !(json && json.results && json.results.bindings) ) {
        console.error(json);
        return callbacks.error(new Error('malformed results'));
      }

      callbacks.success( parseResults(json.results.bindings) );
    }
  });
};

SparqlClient.prototype.inverseSameAs = function inverseSameAs(iri, callbacks) {
  var axis = 'inverseSameAs';
  var query = this.getQuery(axis, iri);

  return this.httpClient({ query: query }, callbacks);
};


var sparqlClientFactory = {
  create: function(httpClientFactory, options) {
    return new SparqlClient(httpClientFactory, options);
  }
};

module.exports = sparqlClientFactory;

// temporary, for testing
if (!window.sparqlClientFactory) {
  window.sparqlClientFactory = sparqlClientFactory;
}

},{}],7:[function(require,module,exports){
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

},{}]},{},[1]);

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
