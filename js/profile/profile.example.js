'use strict';
var ExampleProfile = {};

// LodLive will match connection by the base URL of the query used, so the key must match the URL
ExampleProfile.connection = {
  // http matches all http requests, so this will be the only connection settings used
 'http:' : {
      description : {
        it : 'DBpedia is a community effort to extract structured information from Wikipedia and to make this information available on the Web. DBpedia allows you to ask sophisticated queries against Wikipedia, and to link other data sets on the Web to Wikipedia data.',
        en : 'DBpedia is a community effort to extract structured information from Wikipedia and to make this information available on the Web. DBpedia allows you to ask sophisticated queries against Wikipedia, and to link other data sets on the Web to Wikipedia data.'
      },
      sparql : {
        allClasses : 'SELECT DISTINCT ?object  WHERE {[] a ?object} ORDER BY ?object  LIMIT 50  ',
        findSubject : 'SELECT DISTINCT ?subject WHERE { {?subject a <{CLASS}>;<http://purl.org/dc/elements/1.1/title> ?object. FILTER(regex(str(?object),\'{VALUE}\',\'i\'))} UNION {?subject a <{CLASS}>;<http://www.w3.org/2000/01/rdf-schema#label> ?object. FILTER(regex(str(?object),\'{VALUE}\',\'i\'))} UNION {?subject a <{CLASS}>;<http://www.w3.org/2004/02/skos/core#prefLabel> ?object. FILTER(regex(str(?object),\'{VALUE}\',\'i\'))} } LIMIT 1',
        documentUri : 'SELECT DISTINCT * WHERE {<{URI}> ?property ?object.FILTER ((( isIRI(?object) && ?property != <http://xmlns.com/foaf/0.1/depiction> )|| ?property = <http://www.w3.org/2000/01/rdf-schema#label>  || ?property = <http://www.georss.org/georss/point> || ?property = <http://xmlns.com/foaf/0.1/surname> || ?property = <http://xmlns.com/foaf/0.1/name> || ?property = <http://purl.org/dc/elements/1.1/title>))}  ORDER BY ?property',
        document : 'SELECT DISTINCT *  WHERE  {{<{URI}> ?property ?object. FILTER(!isLiteral(?object))} UNION    {<{URI}> ?property    ?object.FILTER(isLiteral(?object)).FILTER(lang(?object) ="it")} UNION   {<{URI}> ?property    ?object.FILTER(isLiteral(?object)).FILTER(lang(?object) ="en")}}  ORDER BY ?property',
        bnode : 'SELECT DISTINCT *  WHERE {<{URI}> ?property ?object}',
        inverse : 'SELECT DISTINCT * WHERE {?object ?property <{URI}> FILTER(REGEX(STR(?object),\'//dbpedia.org\'))} LIMIT 100',
        inverseSameAs : 'SELECT DISTINCT * WHERE {?object <http://www.w3.org/2002/07/owl#sameAs> <{URI}> FILTER(REGEX(STR(?object),\'//dbpedia.org\'))}'
      },
      useForInverseSameAs : true,
      endpoint : 'http://dbpedia.org/sparql',
  }
};

// here we define the known relationships so that labels will appear
ExampleProfile.arrows = {
  'http://www.w3.org/2002/07/owl#sameAs' : 'isSameAs',
  'http://purl.org/dc/terms/isPartOf' : 'isPartOf',
  'http://purl.org/dc/elements/1.1/type' : 'isType',
  'http://www.w3.org/1999/02/22-rdf-syntax-ns#type' : 'isType'
};

// this is the default data configuration, this is important.  It informs LodLive how to construct queries and how to read the data that comes back
ExampleProfile.default = {
  sparql : {
    allClasses : 'SELECT DISTINCT ?object WHERE {[] a ?object}',
    findSubject : 'SELECT DISTINCT ?subject WHERE { {?subject a <{CLASS}>;<http://purl.org/dc/elements/1.1/title> ?object. FILTER(regex(str(?object),\'{VALUE}\',\'i\'))} UNION {?subject a <{CLASS}>;<http://www.w3.org/2000/01/rdf-schema#label> ?object. FILTER(regex(str(?object),\'{VALUE}\',\'i\'))} UNION {?subject a <{CLASS}>;<http://www.w3.org/2004/02/skos/core#prefLabel> ?object. FILTER(regex(str(?object),\'{VALUE}\',\'i\'))} }  LIMIT 1  ',
    documentUri : 'SELECT DISTINCT * WHERE {<{URI}> ?property ?object} ORDER BY ?property',
    document : 'SELECT DISTINCT * WHERE {<{URI}> ?property ?object}',
    bnode : 'SELECT DISTINCT *  WHERE {<{URI}> ?property ?object}',
    inverse : 'SELECT DISTINCT * WHERE {?object ?property <{URI}>.} LIMIT 100',
    inverseSameAs : 'SELECT DISTINCT * WHERE {{?object <http://www.w3.org/2002/07/owl#sameAs> <{URI}> } UNION { ?object <http://www.w3.org/2004/02/skos/core#exactMatch> <{URI}>}}'
  },
  endpoint : 'http://labs.regesta.com/resourceProxy/',
  document : {
    className : 'standard',
    titleName: 'none',
    titleProperties : ['http://xmlns.com/foaf/0.1/name']
  }, // http://www.w3.org/2000/01/rdf-schema#label
};

ExampleProfile.UI = {
  ignoreBnodes: true,
  nodeIcons: [
    { builtin: 'tools' },
    { builtin: 'docInfo' },
    {
      icon: 'fa fa-refresh',
      title: 'Randomize node color',
      handler: function(node, inst) {
        // http://www.paulirish.com/2009/random-hex-color-code-snippets/
        var nextColor = '#'+Math.floor(Math.random()*16777216).toString(16);
        node.find('.lodlive-node-label').css('backgroundColor', nextColor);
      }
    }
  ],
  tools: [
    { builtin: 'remove' },
    { builtin: 'rootNode'},
    { builtin: 'expand' }
  ],
  // docInfo: function() {},
  nodeHover: function() {},
  relationships: {
    'http://www.w3.org/1999/02/22-rdf-syntax-ns#type': {
      color: '#000'
    },
    'http://www.w3.org/2004/02/skos/core#broader': {
      color: '#69C'
    },
    'http://www.w3.org/2004/02/skos/core#related': {
      color: '#FFF444'
    }
  }
};

ExampleProfile.endpoints = {
  all : 'output=json&format=json&timeout=0',
  jsonp: true
};
