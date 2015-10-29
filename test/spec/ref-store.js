describe('ref-store', function () {
  it('should exist', function () {
    expect(window.refStoreFactory).not.to.be.undefined
  })

  it('should create an instance', function () {
    var refs = refStoreFactory.create()
    expect(refStoreFactory).not.to.be.undefined
  })

  it('should set subject refs', function () {
    var refs = refStoreFactory.create()
    var x = [1, 2]

    refs.setSubjectRefs('a', x)
    expect(refs.getSubjectRefs('a')).to.equal(x)
  })

  it('should add subject refs', function () {
    var refs = refStoreFactory.create()

    refs.addSubjectRef('a', 'b')
    expect(refs.getSubjectRefs('a')[0]).to.equal('b')

    refs.addSubjectRef('a', 'z')
    expect(refs.getSubjectRefs('a')[1]).to.equal('z')
  })

  it('should not add add duplicate subject ref', function () {
    var refs = refStoreFactory.create()

    refs.addSubjectRef('a', 'b')
    refs.addSubjectRef('a', 'b')
    expect(refs.getSubjectRefs('a').length).to.equal(1)
    expect(refs.getSubjectRefs('a')[0]).to.equal('b')
  })

  it('should remove subject refs', function () {
    var refs = refStoreFactory.create()
    var x = [1, 2]

    refs.setSubjectRefs('a', x)
    refs.removeSubjectRef('a', 2)
    expect(refs.getSubjectRefs('a').length).to.equal(1)
  })

  it('should not remove non-existent subject ref', function () {
    var refs = refStoreFactory.create()
    var x = [1, 2]

    refs.setSubjectRefs('a', x)
    refs.removeSubjectRef('a', 3)
    expect(refs.getSubjectRefs('a').length).to.equal(2)
  })

  it('should remove id as object', function () {
    var refs = refStoreFactory.create()
    var x = [1, 2]

    refs.setSubjectRefs('a', x)
    refs.removeAsObject('a')
    expect(refs.getSubjectRefs('a').length).to.equal(0)
  })

  it('should set object refs', function () {
    var refs = refStoreFactory.create()
    var x = [0, 'd']

    refs.setObjectRefs('x', x)
    expect(refs.getObjectRefs('x')).to.equal(x)
  })

  it('should add object refs', function () {
    var refs = refStoreFactory.create()

    refs.addObjectRef('d', 'q')
    expect(refs.getObjectRefs('d')[0]).to.equal('q')

    refs.addObjectRef('d', 'm')
    expect(refs.getObjectRefs('d')[1]).to.equal('m')
  })

  it('should not duplicate object refs', function () {
    var refs = refStoreFactory.create()

    refs.addObjectRef('d', 'q')
    refs.addObjectRef('d', 'q')
    expect(refs.getObjectRefs('d').length).to.equal(1)
    expect(refs.getObjectRefs('d')[0]).to.equal('q')
  })

  it('should remove object refs', function () {
    var refs = refStoreFactory.create()
    var x = [0, 'd']

    refs.setObjectRefs('x',x)
    refs.removeObjectRef('x','d')
    expect(refs.getObjectRefs('x').length).to.equal(1)
  })

  it('should not remove non-existent object refs', function () {
    var refs = refStoreFactory.create()
    var x = [0, 'd']

    refs.setObjectRefs('x',x)
    refs.removeObjectRef('x','z')
    expect(refs.getObjectRefs('x').length).to.equal(2)
  })

  it('should remove id as subject', function () {
    var refs = refStoreFactory.create()
    var x = [0, 'd']

    refs.setObjectRefs('x',x)
    refs.removeAsSubject('x')
    expect(refs.getObjectRefs('x').length).to.equal(0)
  })
})
