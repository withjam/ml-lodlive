'use strict'

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

module.exports = sparqlClientFactory;

// temporary, for testing
if (!window.sparqlClientFactory) {
  window.sparqlClientFactory = sparqlClientFactory;
}
