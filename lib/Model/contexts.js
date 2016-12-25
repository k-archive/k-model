/**
 * Contexts are useful for keeping track of the origin of subscribes.
 */

var Model = require('./Model');
var CollectionCounter = require('./CollectionCounter');

Model.INITS.push(function(model) {
  model.root._contexts = new Contexts();
  model.root.setContext('root');
});

Model.prototype.context = function(id) { console.log('Model.context');
  var model = this._child();
  model.setContext(id);
  return model;
};

Model.prototype.setContext = function(id) { console.log('Model.setContext');
  this._context = this.getOrCreateContext(id);
};

Model.prototype.getOrCreateContext = function(id) { console.log('Model.getOrCreateContext');
  var context = this.root._contexts[id] ||
    (this.root._contexts[id] = new Context(this, id));
  return context;
};

Model.prototype.unload = function(id) { console.log('Model.unload');
  var context = (id) ? this.root._contexts[id] : this._context;
  context && context.unload();
};

Model.prototype.unloadAll = function() { console.log('Model.unloadAll');
  var contexts = this.root._contexts;
  for (var key in contexts) {
    contexts[key].unload();
  }
};

function Contexts() {}

function FetchedQueries() {}
function SubscribedQueries() {}

function Context(model, id) {
  this.model = model;
  this.id = id;
  this.fetchedDocs = new CollectionCounter();
  this.subscribedDocs = new CollectionCounter();
  this.createdDocs = new CollectionCounter();
  this.fetchedQueries = new FetchedQueries();
  this.subscribedQueries = new SubscribedQueries();
}

Context.prototype.toJSON = function() { console.log('Context.toJSON');
  var fetchedDocs = this.fetchedDocs.toJSON();
  var subscribedDocs = this.subscribedDocs.toJSON();
  var createdDocs = this.createdDocs.toJSON();
  if (!fetchedDocs && !subscribedDocs && !createdDocs) return;
  return {
    fetchedDocs: fetchedDocs,
    subscribedDocs: subscribedDocs,
    createdDocs: createdDocs
  };
};

Context.prototype.fetchDoc = function(collectionName, id) { console.log('Context.fetchDoc');
  this.fetchedDocs.increment(collectionName, id);
};
Context.prototype.subscribeDoc = function(collectionName, id) { console.log('Context.subscribeDoc');
  this.subscribedDocs.increment(collectionName, id);
};
Context.prototype.unfetchDoc = function(collectionName, id) { console.log('Context.unfetchDoc');
  this.fetchedDocs.decrement(collectionName, id);
};
Context.prototype.unsubscribeDoc = function(collectionName, id) { console.log('Context.unsubscribeDoc');
  this.subscribedDocs.decrement(collectionName, id);
};
Context.prototype.createDoc = function(collectionName, id) { console.log('Context.createDoc');
  this.createdDocs.increment(collectionName, id);
};
Context.prototype.fetchQuery = function(query) { console.log('Context.fetchQuery');
  mapIncrement(this.fetchedQueries, query.hash);
};
Context.prototype.subscribeQuery = function(query) { console.log('Context.subscribeQuery');
  mapIncrement(this.subscribedQueries, query.hash);
};
Context.prototype.unfetchQuery = function(query) { console.log('Context.unfetchQuery');
  mapDecrement(this.fetchedQueries, query.hash);
};
Context.prototype.unsubscribeQuery = function(query) { console.log('Context.unsubscribeQuery');
  mapDecrement(this.subscribedQueries, query.hash);
};
function mapIncrement(map, key) {
  map[key] = (map[key] || 0) + 1;
}
function mapDecrement(map, key) {
  map[key] && map[key]--;
  if (!map[key]) delete map[key];
}

Context.prototype.unload = function() { console.log('Context.unload');
  var model = this.model;
  for (var hash in this.fetchedQueries) {
    var query = model.root._queries.get(hash);
    if (!query) continue;
    var count = this.fetchedQueries[hash];
    while (count--) query.unfetch();
  }
  for (var hash in this.subscribedQueries) {
    var query = model.root._queries.get(hash);
    if (!query) continue;
    var count = this.subscribedQueries[hash];
    while (count--) query.unsubscribe();
  }
  for (var collectionName in this.fetchedDocs.collections) {
    var collection = this.fetchedDocs.collections[collectionName];
    for (var id in collection) {
      var count = collection[id];
      while (count--) model.unfetchDoc(collectionName, id);
    }
  }
  for (var collectionName in this.subscribedDocs.collections) {
    var collection = this.subscribedDocs.collections[collectionName];
    for (var id in collection) {
      var count = collection[id];
      while (count--) model.unsubscribeDoc(collectionName, id, void 0, true);
    }
  }
  for (var collectionName in this.createdDocs.collections) {
    var collection = this.createdDocs.collections[collectionName];
    for (var id in collection) {
      model._maybeUnloadDoc(collectionName, id);
    }
  }
  this.createdDocs.reset();
};
