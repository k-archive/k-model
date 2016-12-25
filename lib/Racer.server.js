var Backend = require('./Backend');
var Racer = require('./Racer');

Racer.prototype.Backend = Backend;
Racer.prototype.version = require('../package').version;

Racer.prototype.createBackend = function(options) { console.log('Racer.createBackend');
  return new Backend(this, options);
};
