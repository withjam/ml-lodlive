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

  it('should create a client', function () {
    var httpClient = httpClientFactory.create()
    expect(httpClient).not.to.be.undefined
  })

  it('should not require callbacks', function () {
    var self = this
    var ajax = this.sandbox.stub($, 'ajax')
    var httpClient = httpClientFactory.create('endpoint', 'param=value', 'accepts', 'json')

    httpClient({ query: 'QUERY' }, {})

    expect(ajax.calledOnce).to.be.true

    var args = ajax.args[0][0]
    expect(args.url).to.equal('endpoint?param=value&query=QUERY')
    expect(args.contentType).to.equal('application/json')
    expect(args.accepts).to.equal('accepts')
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

    var httpClient = httpClientFactory.create('endpoint', 'param=value', 'accepts', 'json')

    httpClient({ query: 'QUERY' }, callbacks)

    expect(ajax.calledOnce).to.be.true

    var args = ajax.args[0][0]

    args.beforeSend()
    expect(callbacks.beforeSend.calledOnce).to.be.true

    args.success()
    expect(afterSend.calledOnce).to.be.true
    expect(callbacks.success.calledOnce).to.be.true

    args.error()
    expect(afterSend.calledTwice).to.be.true
    expect(callbacks.error.calledOnce).to.be.true
  })
})
