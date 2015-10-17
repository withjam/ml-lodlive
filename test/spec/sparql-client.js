describe('sparqlClient', function () {
  before(function () {
    this.sandbox = sinon.sandbox.create()
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

    sparqlClient('document', '')
    expect(httpStub.calledOnce).to.be.true
    expect(httpStub.args[0][0].query).to.equal('QUERY')
  })

  it('should fallback to default queries and make request', function () {
    var defaultProfile = { document: 'QUERY' }
    var httpStub = this.sandbox.stub()
    var sparqlClient = sparqlClientFactory.create({}, defaultProfile, httpStub)

    sparqlClient('document', '')
    expect(httpStub.calledOnce).to.be.true
    expect(httpStub.args[0][0].query).to.equal('QUERY')
  })

  it('should substitute IRIs', function () {
    var profile = { document: 'QUERY {URI}' }
    var httpStub = this.sandbox.stub()
    var sparqlClient = sparqlClientFactory.create(profile, {}, httpStub)

    sparqlClient('document', 'test')
    expect(httpStub.calledOnce).to.be.true
    expect(httpStub.args[0][0].query).to.equal('QUERY test')
  })
})
