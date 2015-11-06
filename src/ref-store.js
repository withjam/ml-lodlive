'use strict'

function LodLiveRefStore() {}

/**
 * Gets the Ids of all active objects with references from `subject`
 *
 * @param {String} subject - the Id of an active subject
 * @return {Array<String>} object Ids
 */
LodLiveRefStore.prototype.getObjectRefs = function(subject) {
  return this.storeIds['gen' + subject] || [];
};

/**
 * Sets `objects` as the list of references from `subject`
 *
 * @param {String} subject - the Id of an active subject
 * @param {Array<String>} objects - the Ids of `subject`'s objects
 */
LodLiveRefStore.prototype.setObjectRefs = function(subject, objects) {
  this.storeIds['gen' + subject] = objects;
}

/**
 * Adds an active object reference from `subject`
 *
 * @param {String} subject - the Id of an active subject
 * @param {String} object - the Id of an object of `subject`
 */
LodLiveRefStore.prototype.addObjectRef = function(subject, object) {
  var objects = this.getObjectRefs(subject);

  if (objects.indexOf(object) === -1) {
    objects.push(object);
  }

  this.setObjectRefs(subject, objects);
};

/**
 * Removes an active object reference from `subject`
 *
 * @param {String} subject - the Id of an active subject
 * @param {String} object - the Id of an object of `subject`
 */
LodLiveRefStore.prototype.removeObjectRef = function(subject, object) {
  var objects = this.getObjectRefs(subject);
  var index = objects.indexOf(object);

  if (index > -1) {
    objects.splice(index, 1);
  }
};

/**
 * Removes all references to `object`
 *
 * @param {String} object - the Id of an object
 */
LodLiveRefStore.prototype.removeAsObject = function(object) {
  delete this.storeIds['rev' + object];
};

/**
 * Gets the Ids of all active subjects with references to `object`
 *
 * @param {String} object - the Id of an active object
 * @return {Array<String>} subject Ids
 */
LodLiveRefStore.prototype.getSubjectRefs = function(object) {
  return this.storeIds['rev' + object] || [];
};

/**
 * Sets `subjects` as the list of references from `object`
 *
 * @param {String} subjects - the Ids of `object`'s subjects
 * @param {Array<String>} object - the Id of an active object
 */
LodLiveRefStore.prototype.setSubjectRefs = function(object, subjects) {
  this.storeIds['rev' + object] = subjects;
}

/**
 * Adds an active subject reference to `object`
 *
 * @param {String} object - the Id of an active object
 * @param {String} subject - the Id of a subject of `object`
 */
LodLiveRefStore.prototype.addSubjectRef = function(object, subject) {
  var subjects = this.getSubjectRefs(object);

  if (subjects.indexOf(subject) === -1) {
    subjects.push(subject);
  }

  this.setSubjectRefs(object, subjects);
};

/**
 * Removes an active subject reference from `object`
 *
 * @param {String} object - the Id of an active object
 * @param {String} subject - the Id of a subject of `object`
 */
LodLiveRefStore.prototype.removeSubjectRef = function(object, subject) {
  var subjects = this.getSubjectRefs(object);
  var index = subjects.indexOf(subject);

  if (index > -1) {
    subjects.splice(index, 1);
  }
};

/**
 * Removes all references from `subject`
 *
 * @param {String} subject - the Id of an subject
 */
LodLiveRefStore.prototype.removeAsSubject = function(subject) {
  delete this.storeIds['gen' + subject];
};

var refStoreFactory = {
  create: function () {
    var store = Object.create(LodLiveRefStore.prototype);
    store.storeIds = {};
    return store;
  }
};

module.exports = refStoreFactory;

// temporary, for testing
if (!window.refStoreFactory) {
  window.refStoreFactory = refStoreFactory;
}
