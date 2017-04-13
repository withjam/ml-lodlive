FORKED ML LodLive
=========

The ML LodLive repo has been forked to include some additional minor features while waiting for PRs to be reviewed. 
Namely: 

* Fixing an issue where the nodes jump around the screen on click: [#52](https://github.com/withjam/ml-lodlive/issues/52)
* Preventing too many relationship from being rendered on a single line: [#53](https://github.com/withjam/ml-lodlive/issues/53)
* Adding a custom rendering hook to the tool buttons for each node. 

ML LodLive
=========

An RDF browser capable of consuming and generating SPARQL. Explore connections between nodes in an easy, visual tool that can be dropped into any existing HTML application.  Based on the [LodLive](https://github.com/dvcama/LodLive) library

What's Different
================

The original LodLive library was a complete application with multiple UI screens.  It allowed you to select from various SPARQL endpoints, search, and browse.  It also included a myriad of third-party dependencies.  That version of LodLive has been refactored to be more modular, easier to include in an existing application, and require minimal dependencies.  The various components of LodLive are also being isolated so that future enhancement may be possible.  

Dependencies
============

Requires: jQuery > 1.9/2.0  (you must include this in your site if it's not in use already)


Installation
============

ml-lodlive has been narrowed down to a minimal set of files for inclusion in any application.  The easiest way to get the latest version of ml-lodlive is using bower:

```
bower install --save ml-lodlive
```

Once part of your project, you have only to include the css and js files to get started.  If you are using the vanguard team's slush generator then 'wiredep' will take care of this part for you, otherwise add the following components to your index.html page.

```html
<head>
  <link ref="stylesheet" href="<bower_location>/ml-lodlive/dist/ml-lodlive.all.css">
</head>
<body>

 // include jquery before ml-lodlive

 <script src="<bower_location>/ml-lodlive/dist/ml-lodlive.min.js"></script>
</body>
```

Profile
=======

At first glance, the profile object is a bit overwhelming.  However, there are only a few configuration options you need to focus on in order to get ml-lodlive connected.  The other options included in the profile help you control the SPARQL queries that are generated - so that you can have it fit your data - and UI elements that will appear such as tool bar icons and any custom functions.

In order to connect ml-lodlive to your MarkLogic REST server instance, you need to configure: the location of the server, whether or not it will use jsonp, and any additional paramters you need to send.  You can use js/profile.marklogic.js as a starting point if you wish, or you can create your own profile object.  It is often easiest to load it as a separate file but you can choose to build it programatically as well.

First, you need to set up your profile's connection endpoint.  This is done as follows:

```js
MyProfileObject.connection['http:'].endpoint = 'http://my.marklogic.server/lodlive.xqy'; // it can be an absolute path if using jsonp

MyProfileObject.connection['http:'].endpoint = '/v1/graphs/sparql'; // to use the out-of-the-box MarkLogic SPARQL support
MyProfileObject.connection['http:'].accepts = 'application/sparql-results+json'; // for regular XHR requests be sure to add this header to receive json response

MyProfileObject.endpoints.jsonp = false | true; // depending on if you are using jsonp
MyProfileObject.endpoints.all = ''; // and additional query params you wish to include in every request
```

With just these options set in your profile object, you should be able to create a new instance of ml-lodlive and see your SPARQL data.  The configuration also contains options for coloring nodes, displaying titles, labeling relationship lines, and UI options that can all be tailored to fit your app and your data.

Initialization
==============

In order to create a new instance of ml-lodlive you need two things:  a valid profile object (configuration), and a starting iri.  Lodlive is designed to allow browsing nodes and relationships in your data, but requires a starting node for context.

ml-lodlive uses jQuery to create a plugin-style method for attaching an instance to a DOM element.  The usage is quite straightforward:

```js
jQuery('selector').lodlive({ profile: MyProfileObject, firstUri: 'http://my.first.iri', ignoreBnodes: true });
```

The firstUri can be any object iri that exists in your triples and can be built programatically.  ignoreBnodes is a onetime option that tells the instance to hide or display bnodes as linked relationships.

This is all it takes to render the initial view of LodLive from which point users can click around relationships to explore your triples data.

Configuration
=============

Configuration is accomplished by the profile object that is passed into the ml-lodlive constructor.  It contains the endpoint settings necessary for retrieving data, but offers many customization options.

SPARQL
------

ml-lodlive generates SPARQL queries for the retrieval of data that is displayed on screen.  Each of the SPARQL statements generated can be controlled via the profile.  

### findSubject

findSubject is used to display a node in the UI.  Through it, ml-lodlive can construct the title and all of the linked relationships.  ml-lodlive groups relationships by predicate and will display a grouped icon as a link from the node if there are more than 3 of the same group.

### document

document is used to generate the docInfo properties displayed when clicking the docInfo toolbar.  This is an option feature but is useful for viewing details about the node that aren't included in the node rendering.  This can be anything from additional names to descriptions, images, or external links.  Note that the docInfo viewer is also customizable if your document properties require special treatment on the UI.

### inverse

ml-lodlive can acknowledge inverse relationships if configured to do so.  This sparql query will be used to detect if any of the open nodes are inversely related to the current node.

UI
--

Certain UI elements can be configured via the profile.

### nodeIcons

nodeIcons are the top-level icons that are displayed as action items above each node.  You can use as many or as few (even 0) as you'd like.  There are a few builtin icons that can be used by name, or you can create your own.  Using a builtin looks as follows:

```js
MyProfileObject.UI.nodeIcons = [{ builtin: 'docInfo'}, { builtin: 'tools' }]; // show docInfo and tools icons


MyProfileObject.UI.nodeIcons = [{ builtin: 'tools' }, 
{
  icon: 'fa fa-circle-o', // icon property is a css class setting that should result in an icon (usually fa or glyphicon)
  title: 'My title', // this title property is displayed to the user if they hover over the icon
  handler: function(node, instance) {
   // your custom function
   // node: is the current node DOM object
   // instance: is the instance of ml-lodlive
   // you can manipulate the properties of the DOM 'node' for a visual effect, generate additional DOM, or interact with the 'instance' of ml-lodlive
  } 
}]
```

This would create two icons, one for the builtin docInfo function and one for the builtin tools function.  Tools is a special function that will display a second-level set of action icons.  This is useful for having additional icons while avoiding cluter on the node rendering.  The icons displayed via the 'tools' builtin are configured separately.

### tools

Similar to the nodeIcons, tools are a second-level of nodeIcons toggled by clicking the 'tools' nodeIcon.  Note that if you configure tools but do not include 'tools' as a nodeIcon, the tools will not be accessible.

```js
MyProfileObject.UI.tools = [ { builtin: 'close'}, { builtin: 'rootNode'}, { builtin: 'expand' }];
```

### docInfo

docInfo is a function handler invoked when the user clicks the docInfo nodeIcon.  Note that you must include the builtin 'docInfo' in your nodeIcon setup for this to be reached.

### nodeHover

nodeHover is a function handler invoked when the node is hovered via the cursor.  You may choose to do something or ignore completely.

### relationships

This allows you to color the related node icons based on a string-match to the predicate.  

```js
  MyProfileObject.UI.relationships: {
    'http://www.w3.org/1999/02/22-rdf-syntax-ns#type': {
      color: '#000'
    }
  }
```

The above example would color each related node circle #000 that was of the predicate 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type'.  You can do this for as many predicates as you wish.


Dataset
========

Included in the repository is a sample of SKOS data.  This can be loaded into MarkLogic as RDF triples and can the be exposed via a standard REST application in MarkLogic.  If accessing this REST endpoint from a different host or port it will be necessary to install the lodlive.xqy module at the root of the /modules directory for that REST server.  Additionally, update your lodlive profile so that the lodlive.xqy url is used as the base.

License
=======

Apache 2.0
