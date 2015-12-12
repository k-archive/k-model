var ShareConnection = require('k-sync/lib/client').Connection;
var Channel = require('../Channel');
var Model = require('./Model');
var LocalDoc = require('./LocalDoc');
var RemoteDoc = require('./RemoteDoc');

Model.prototype.createConnection = function(bundle) {
  // Model::_createSocket should be defined by the socket plugin
  this.root.socket = this._createSocket(bundle);

  // The Share connection will bind to the socket by defining the onopen,
  // onmessage, etc. methods
  var model = this;
  var shareConnection = this.root.shareConnection = new ShareConnection(this.root.socket);
  var states = ['connecting', 'connected', 'disconnected', 'stopped'];
  states.forEach(function(state) {
    shareConnection.on(state, function(reason) {
      model._setDiff(['$connection', 'state'], state);
      model._setDiff(['$connection', 'reason'], reason);
    });
  });
  this._set(['$connection', 'state'], 'connected');

  this._finishCreateConnection();
};

Model.prototype._finishCreateConnection = function() {
  var model = this;
  this.shareConnection.on('error', function(err, data) {
    model._emitError(err, data);
  });
  // Share docs can be created by queries, so we need to register them
  // with Racer as soon as they are created to capture their events
  this.shareConnection.on('doc', function(shareDoc) {
    model.getOrCreateDoc(shareDoc.collection, shareDoc.id);
  });

  this.root.channel = new Channel(this.root.socket);
};

Model.prototype.connect = function() {
  this.root.socket.open();
};
Model.prototype.disconnect = function() {
  this.root.socket.close();
};
Model.prototype.reconnect = function() {
  this.disconnect();
  this.connect();
};
// Clean delayed disconnect
Model.prototype.close = function(cb) {
  cb = this.wrapCallback(cb);
  var model = this;
  this.whenNothingPending(function() {
    model.root.socket.close();
    cb();
  });
};

Model.prototype._isLocal = function(name) {
  // Whether the collection is local or remote is determined by its name.
  // Collections starting with an underscore ('_') are for user-defined local
  // collections, those starting with a dollar sign ('$'') are for
  // framework-defined local collections, and all others are remote.
  var firstCharcter = name.charAt(0);
  return firstCharcter === '_' || firstCharcter === '$';
};

Model.prototype._getDocConstructor = function(name) {
  return (this._isLocal(name)) ? LocalDoc : RemoteDoc;
};

Model.prototype.hasPending = function() {
  return this.shareConnection.hasPending();
};
Model.prototype.hasWritePending = function() {
  return this.shareConnection.hasWritePending();
};
Model.prototype.whenNothingPending = function(cb) {
  return this.shareConnection.whenNothingPending(cb);
};
