'use strict'

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

// sparqlProfile = profile.connections['http:'].sparql
// defaultSparqlProfile: passed in for now, but should be a static reference ...
function SparqlClient(sparqlProfile, defaultSparqlProfile, httpClient) {
  if (!(this instanceof SparqlClient)) {
    return new SparqlClient(sparqlProfile, defaultSparqlProfile, httpClient);
  }

  this.httpClient = httpClient;

  this.getQueryTemplate = function(axis) {
    return sparqlProfile && sparqlProfile[axis] ?
           sparqlProfile[axis] :
           defaultSparqlProfile[axis];
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
  // sparqlProfile = profile.connections['http:'].sparql
  // defaultSparqlProfile: passed in for now, but should be a static reference ...
  create: function(sparqlProfile, defaultSparqlProfile, httpClient) {
    return new SparqlClient(sparqlProfile, defaultSparqlProfile, httpClient);
  }
};

module.exports = sparqlClientFactory;

// temporary, for testing
if (!window.sparqlClientFactory) {
  window.sparqlClientFactory = sparqlClientFactory;
}
