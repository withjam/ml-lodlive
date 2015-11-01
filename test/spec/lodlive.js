describe('lodlive', function () {
  before(function () {
    this.sandbox = sinon.sandbox.create();
    this.fixtures = {
      willSmith: fixture.load('test/fixtures/will-smith.json')
    };

    var requests = this.requests = [];
    this.xhr = sinon.useFakeXMLHttpRequest();
    this.xhr.onCreate = function (xhr) {
      requests.push(xhr);
    };
  });

  after(function () {
    this.xhr.restore();
  });

  beforeEach(function () {
    var fixture = '<div id="graph" style="width: 100%; height: 100%; border: solid 1px black; overflow: hidden"></div>';
    document.body.insertAdjacentHTML('afterbegin', fixture);
  });

  afterEach(function () {
    this.requests.length = 0;
    this.sandbox.restore();
    document.body.removeChild(document.getElementById('graph'));
  });

  it('should init', function () {
    var centerBox = this.sandbox.spy(LodLive.prototype, 'centerBox');
    var openDoc = this.sandbox.spy(LodLive.prototype, 'openDoc');

    var firstUri = 'http://dbpedia.org/resource/Will_Smith';

    // disable jsonp to force XHR
    ExampleProfile.endpoints.jsonp = false;
    jQuery('#graph').lodlive({ profile: ExampleProfile, firstUri: firstUri });

    expect(centerBox.calledOnce).to.be.true;
    expect(openDoc.calledOnce).to.be.true;

    expect(this.requests.length).to.equal(1);
    expect(this.requests[0].url).to.match(/^http:\/\/dbpedia.org\/sparql/);

    expect($('#graph .lodlive-graph-container').length).to.equal(1);
    expect($('#graph .lodlive-graph-context').length).to.equal(1);
    expect($('#graph .lodlive-node').length).to.equal(1);

    var node = $('#graph .lodlive-node').first();
    expect(node.attr('rel')).to.equal(firstUri);
    expect(node.data('endpoint')).to.equal('http://dbpedia.org/sparql');
  });

  it('should render sparql results', function () {
    var centerBox = this.sandbox.spy(LodLive.prototype, 'centerBox');
    var openDoc = this.sandbox.spy(LodLive.prototype, 'openDoc');
    var format = this.sandbox.spy(LodLive.prototype, 'format');
    var addNewDoc = this.sandbox.spy(LodLive.prototype, 'addNewDoc');
    var formatDoc = this.sandbox.spy(LodLive.prototype, 'formatDoc');

    var firstUri = 'http://dbpedia.org/resource/Will_Smith';

    // disable jsonp to force XHR
    ExampleProfile.endpoints.jsonp = false;
    // ExampleProfile.debugOn = true;
    jQuery('#graph').lodlive({ profile: ExampleProfile, firstUri: firstUri });

    expect(centerBox.calledOnce).to.be.true;
    expect(openDoc.calledOnce).to.be.true;

    expect(this.requests.length).to.equal(1);

    this.requests[0].respond(200, {
        "Content-Type": "application/json"
      },
      JSON.stringify(this.fixtures.willSmith)
    );

    expect(format.calledOnce).to.be.true;

    expect($('#graph .box').length).to.equal(1);
    expect($('#graph .lodlive-node .groupedRelatedBox').length).to.equal(6);
    expect($('#graph .lodlive-node .relatedBox').length).to.equal(8);

    $('#graph .lodlive-node .relatedBox').first().trigger('click');

    expect(addNewDoc.calledOnce).to.be.true;
    expect(openDoc.calledTwice).to.be.true;

    expect(this.requests.length).to.equal(2);

    expect($('#graph .box').length).to.equal(2);

    expect($('.lodlive-docinfo').length).to.equal(0);

    $('#graph .docInfo').first().trigger('click');

    expect(this.requests.length).to.equal(3);

    this.requests[2].respond(200, {
        "Content-Type": "application/json"
      },
      JSON.stringify(this.fixtures.willSmith)
    );

    expect(formatDoc.calledOnce).to.be.true;

    expect($('.lodlive-docinfo').length).to.equal(1);
    expect($('.lodlive-docinfo .section').length).to.equal(15);
  });
});
