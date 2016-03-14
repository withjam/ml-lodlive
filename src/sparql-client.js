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
