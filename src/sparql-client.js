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

    return function sparqlClient(axis, iri, callbacks) {
      return httpClient({ query: getQuery(axis, iri) }, callbacks);
    };
  }
};

module.exports = sparqlClientFactory;

// temporary, for testing
if (!window.sparqlClientFactory) {
  window.sparqlClientFactory = sparqlClientFactory;
}
