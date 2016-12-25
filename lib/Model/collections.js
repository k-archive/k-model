var Model = require('./Model');
var LocalDoc = require('./LocalDoc');
var util = require('../util');

function CollectionMap() {}
function ModelData() {}
function DocMap() {}
function CollectionData() {}

Model.INITS.push(function(model) {
  model.root.collections = new CollectionMap();
  model.root.data = new ModelData();
});

Model.prototype.getCollection = function(collectionName) { console.log('Model.getCollection');
  return this.root.collections[collectionName];
};
Model.prototype.getDoc = function(collectionName, id) { console.log('Model.getDoc');
  var collection = this.root.collections[collectionName];
  return collection && collection.docs[id];
};
Model.prototype.get = function(subpath) { console.log('Model.get');
  var segments = this._splitPath(subpath);
  return this._get(segments);
};
Model.prototype._get = function(segments) { console.log('Model._get');
  return util.lookup(segments, this.root.data);
};
Model.prototype.getCopy = function(subpath) { console.log('Model.getCopy');
  var segments = this._splitPath(subpath);
  return this._getCopy(segments);
};
Model.prototype._getCopy = function(segments) { console.log('Model._getCopy');
  var value = this._get(segments);
  return util.copy(value);
};
Model.prototype.getDeepCopy = function(subpath) { console.log('Model.getDeepCopy');
  var segments = this._splitPath(subpath);
  return this._getDeepCopy(segments);
};
Model.prototype._getDeepCopy = function(segments) { console.log('Model._getDeepCopy');
  var value = this._get(segments);
  return util.deepCopy(value);
};
Model.prototype.getOrCreateCollection = function(name) { console.log('Model.getOrCreateCollection');
  var collection = this.root.collections[name];
  if (collection) return collection;
  var Doc = this._getDocConstructor(name);
  collection = new Collection(this.root, name, Doc);
  this.root.collections[name] = collection;
  return collection;
};
Model.prototype._getDocConstructor = function() { console.log('Model._getDocConstructor');
  // Only create local documents. This is overriden in ./connection.js, so that
  // the RemoteDoc behavior can be selectively included
  return LocalDoc;
};

/**
 * Returns an existing document with id in a collection. If the document does
 * not exist, then creates the document with id in a collection and returns the
 * new document.
 * @param {String} collectionName
 * @param {String} id
 * @param {Object} [data] data to create if doc with id does not exist in collection
 */
Model.prototype.getOrCreateDoc = function(collectionName, id, data) { console.log('Model.getOrCreateDoc');
  var collection = this.getOrCreateCollection(collectionName);
  return collection.docs[id] || collection.add(id, data);
};

/**
 * @param {String} subpath
 */
Model.prototype.destroy = function(subpath) { console.log('Model.destroy');
  var segments = this._splitPath(subpath);
  // Silently remove all types of listeners within subpath
  var silentModel = this.silent();
  silentModel.removeAllListeners(null, subpath);
  silentModel._removeAllRefs(segments);
  silentModel._stopAll(segments);
  silentModel._removeAllFilters(segments);
  // Silently remove all model data within subpath
  if (segments.length === 0) {
    this.root.collections = new CollectionMap();
    // Delete each property of data instead of creating a new object so that
    // it is possible to continue using a reference to the original data object
    var data = this.root.data;
    for (var key in data) {
      delete data[key];
    }
  } else if (segments.length === 1) {
    var collection = this.getCollection(segments[0]);
    collection && collection.destroy();
  } else {
    silentModel._del(segments);
  }
};

function Collection(model, name, Doc) {
  this.model = model;
  this.name = name;
  this.Doc = Doc;
  this.docs = new DocMap();
  this.data = model.data[name] = new CollectionData();
  // "noKeys()" was slow, changed to "count"
  this.count = 0;
}

/**
 * Adds a document with `id` and `data` to `this` Collection.
 * @param {String} id
 * @param {Object} data
 * @return {LocalDoc|RemoteDoc} doc
 */
Collection.prototype.add = function(id, data) { console.log('Collection.add');
  var doc = new this.Doc(this.model, this.name, id, data, this);
  this.docs[id] = doc;
  this.count++;
  return doc;
};
Collection.prototype.destroy = function() { console.log('Collection.destroy');
  delete this.model.collections[this.name];
  delete this.model.data[this.name];
};

/**
 * Removes the document with `id` from `this` Collection. If there are no more
 * documents in the Collection after the given document is removed, then this
 * also destroys the Collection.
 * @param {String} id
 */
Collection.prototype.remove = function(id) { console.log('Collection.remove');
  delete this.docs[id];
  delete this.data[id];
  this.count--;
  if (!this.count) this.destroy();
};

/**
 * Returns an object that maps doc ids to fully resolved documents.
 * @return {Object}
 */
Collection.prototype.get = function() { console.log('Collection.get');
  return this.data;
};

