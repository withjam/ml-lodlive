describe('httpClient', function () {
  before(function () {
    this.sandbox = sinon.sandbox.create()
  })

  afterEach(function () {
    this.sandbox.restore()
  })

  it('should exist', function () {
    expect(window.httpClientFactory).not.to.be.undefined
  })

  it('should throw an error if missing endpoint', function () {
    var fn = function () { httpClientFactory.create({}) }
    expect(fn).to.throw('missing required connection.endpoint for httpClient')
  })

  it('should create a client', function () {
    var httpClient = httpClientFactory.create({ endpoint: 'here' })
    expect(httpClient).not.to.be.undefined

    httpClient({}, {})
  })

  it('should use connection configuration', function () {
    var self = this
    var ajax = this.sandbox.stub($, 'ajax')
    var connection = {
      endpoint: 'endpoint',
      defaultParams: 'param=value',
      headers: { Accept: 'accepts' }
    }
    var httpClient = httpClientFactory.create(connection)

    httpClient({ query: 'QUERY' }, {})

    expect(ajax).to.have.been.calledOnce

    var args = ajax.args[0][0]
    expect(args.url).to.equal('endpoint?param=value&query=QUERY')
    expect(args.contentType).to.equal('application/json')
    expect(args.headers.Accept).to.equal('accepts')
    expect(args.dataType).to.equal('json')

    args.beforeSend()
    args.success()
    args.error()
  })

  it('should invoke callbacks', function () {
    var self = this
    var ajax = this.sandbox.stub($, 'ajax')
    var afterSend = this.sandbox.stub()
    var callbacks = {
      beforeSend: self.sandbox.stub().returns(afterSend),
      success: self.sandbox.stub(),
      error: self.sandbox.stub()
    }
    var connection = {
      endpoint: 'endpoint',
      defaultParams: { param: 'value' },
      jsonp: true
    }

    var httpClient = httpClientFactory.create(connection)

    httpClient({ query: 'QUERY' }, callbacks)

    expect(ajax).to.have.been.calledOnce

    var args = ajax.args[0][0]

    expect(args.url).to.equal('endpoint?param=value&query=QUERY')

    args.beforeSend()
    expect(callbacks.beforeSend).to.have.been.calledOnce

    args.success()
    expect(afterSend).to.have.been.calledOnce
    expect(callbacks.success).to.have.been.calledOnce

    args.error()
    expect(afterSend).to.have.been.calledTwice
    expect(callbacks.error).to.have.been.calledOnce
  })
})
