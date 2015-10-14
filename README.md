ML LodLive
=========

An RDF browser capable of consuming and generating SPARQL. Explore connections between nodes in an easy, visual tool that can be dropped into any existing HTML application.

Dependencies
============

Requires: jQuery > 1.9/2.0  (you must include this in your site if it's not in use already)

Includes: jQuery.canvas (for drawing connecting lines)


Installation
============

*TODO*


Dataset
========

Included in the repository is a sample of SKOS data.  This can be loaded into MarkLogic as RDF triples and can the be exposed via a standard REST application in MarkLogic.  If accessing this REST endpoint from a different host or port it will be necessary to install the lodlive.xqy module at the root of the /modules directory for that REST server.  Additionally, update your lodlive profile so that the lodlive.xqy url is used as the base.

License
=======

Apache 2.0

Credits
===============

Based on the [LodLive](https://github.com/dvcama/LodLive) library

[![Bitdeli Badge](https://d2weczhvl823v0.cloudfront.net/withjam/ml-lodlive/trend.png)](https://bitdeli.com/free "Bitdeli Badge")

