describe('sparqlClient', function () {
  before(function () {
    this.sandbox = sinon.sandbox.create()
    this.fixtures = {
      basicResults: fixture.load('test/fixtures/basic-results.json')
    };
  })

  afterEach(function () {
    this.sandbox.restore()
  })

  it('should exist', function () {
    expect(window.sparqlClientFactory).not.to.be.undefined
  })

  it('should create a client', function () {
    var sparqlClient = sparqlClientFactory.create({}, {}, {})
    expect(sparqlClient).not.to.be.undefined
  })

  it('should parse queries and make request', function () {
    var profile = { document: 'QUERY' }
    var httpStub = this.sandbox.stub()
    var sparqlClient = sparqlClientFactory.create(profile, {}, httpStub)

    sparqlClient.document('', {})
    expect(httpStub).to.have.been.calledOnce
    expect(httpStub.args[0][0].query).to.equal('QUERY')
  })

  it('should yield an error with invalid results (document)', function () {
    var profile = { document: 'QUERY' }
    var httpStub = this.sandbox.stub()
    var errorStub = this.sandbox.stub()
    var sparqlClient = sparqlClientFactory.create(profile, {}, httpStub)

    sparqlClient.document('', { error: errorStub })

    expect(httpStub).to.have.been.calledOnce
    expect(httpStub.args[0][0].query).to.equal('QUERY')

    var success = httpStub.args[0][1].success
    success({ results: { data: {} } })

    expect(errorStub).to.have.been.calledOnce
    expect(errorStub.args[0][0]).to.match(/malformed results/)
  })

  it('should parse results (document)', function () {
    var profile = { document: 'QUERY' }
    var httpStub = this.sandbox.stub()
    var successStub = this.sandbox.stub()
    var sparqlClient = sparqlClientFactory.create(profile, {}, httpStub)

    sparqlClient.document('', { success: successStub })

    expect(httpStub).to.have.been.calledOnce
    expect(httpStub.args[0][0].query).to.equal('QUERY')

    var success = httpStub.args[0][1].success
    success(this.fixtures.basicResults)

    expect(successStub).to.have.been.calledOnce
    var args = successStub.args[0][0];

    expect(args.uris.length).to.equal(1)
    expect(args.values.length).to.equal(1)
    expect(args.bnodes.length).to.equal(1)
  })

  it('should yield an error with invalid results (documentUri)', function () {
    var profile = { documentUri: 'QUERY' }
    var httpStub = this.sandbox.stub()
    var errorStub = this.sandbox.stub()
    var sparqlClient = sparqlClientFactory.create(profile, {}, httpStub)

    sparqlClient.documentUri('', { error: errorStub })

    expect(httpStub).to.have.been.calledOnce
    expect(httpStub.args[0][0].query).to.equal('QUERY')

    var success = httpStub.args[0][1].success
    success({ results: { data: {} } })

    expect(errorStub).to.have.been.calledOnce
    expect(errorStub.args[0][0]).to.match(/malformed results/)
  })

  it('should parse results (documentUri)', function () {
    var profile = { documentUri: 'QUERY' }
    var httpStub = this.sandbox.stub()
    var successStub = this.sandbox.stub()
    var sparqlClient = sparqlClientFactory.create(profile, {}, httpStub)

    sparqlClient.documentUri('', { success: successStub })

    expect(httpStub).to.have.been.calledOnce
    expect(httpStub.args[0][0].query).to.equal('QUERY')

    var success = httpStub.args[0][1].success
    success(this.fixtures.basicResults)

    expect(successStub).to.have.been.calledOnce
    var args = successStub.args[0][0];

    expect(args.uris.length).to.equal(1)
    expect(args.values.length).to.equal(1)
    expect(args.bnodes.length).to.equal(1)
  })

  it('should yield an error with invalid results (inverse)', function () {
    var profile = { inverse: 'QUERY' }
    var httpStub = this.sandbox.stub()
    var errorStub = this.sandbox.stub()
    var sparqlClient = sparqlClientFactory.create(profile, {}, httpStub)

    sparqlClient.inverse('', { error: errorStub })

    expect(httpStub).to.have.been.calledOnce
    expect(httpStub.args[0][0].query).to.equal('QUERY')

    var success = httpStub.args[0][1].success
    success({ results: { data: {} } })

    expect(errorStub).to.have.been.calledOnce
    expect(errorStub.args[0][0]).to.match(/malformed results/)
  })

  it('should parse results (inverse)', function () {
    var profile = { inverse: 'QUERY' }
    var httpStub = this.sandbox.stub()
    var successStub = this.sandbox.stub()
    var sparqlClient = sparqlClientFactory.create(profile, {}, httpStub)

    sparqlClient.inverse('', { success: successStub })

    expect(httpStub).to.have.been.calledOnce
    expect(httpStub.args[0][0].query).to.equal('QUERY')

    var success = httpStub.args[0][1].success
    success(this.fixtures.basicResults)

    expect(successStub).to.have.been.calledOnce
    var args = successStub.args[0][0];

    expect(args.uris.length).to.equal(1)
    expect(args.values.length).to.equal(1)
    expect(args.bnodes.length).to.equal(1)
  })

  it('should parse queries and make request (inverseSameAs)', function () {
    var profile = { inverseSameAs: 'QUERY' }
    var httpStub = this.sandbox.stub()
    var sparqlClient = sparqlClientFactory.create(profile, {}, httpStub)

    sparqlClient.inverseSameAs('', {})
    expect(httpStub).to.have.been.calledOnce
    expect(httpStub.args[0][0].query).to.equal('QUERY')
  })

  it('should fallback to default queries and make request', function () {
    var defaultProfile = { bnode: 'QUERY' }
    var httpStub = this.sandbox.stub()
    var sparqlClient = sparqlClientFactory.create({}, defaultProfile, httpStub)

    sparqlClient.bnode('', {})
    expect(httpStub).to.have.been.calledOnce
    expect(httpStub.args[0][0].query).to.equal('QUERY')
  })

  it('should substitute IRIs', function () {
    var profile = { inverse: 'QUERY {URI}' }
    var httpStub = this.sandbox.stub()
    var sparqlClient = sparqlClientFactory.create(profile, {}, httpStub)

    sparqlClient.inverse('test', {})
    expect(httpStub).to.have.been.calledOnce
    expect(httpStub.args[0][0].query).to.equal('QUERY test')
  })
})
