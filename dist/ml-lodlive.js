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
