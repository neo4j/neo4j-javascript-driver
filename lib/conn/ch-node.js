
var available = false;
try {
  // Only define this module if 'net' is available
  require.resolve("net");
  available = true;
} catch(e) {
  module.exports.NodeChannel = { available : false };
}

if( available ) {

  var net = require("net");
  var NodeBuffer = require("../buf").NodeBuffer;

  function NodeChannel(opts) {
    this._conn = net.connect(opts.host, (opts.port || 7687) );
    var self = this;
    this._conn.on('data', function( buffer ) {
      if( self.onmessage ) {
        self.onmessage( new NodeBuffer( buffer ) );
      }
    });
  }

  NodeChannel.prototype.write = function( buffer ) {
    if( buffer instanceof NodeBuffer ) {
      this._conn.write( buffer._buffer );
    } else {
      throw new Error( "Don't know how to write: " + buffer );
    }
  }

  NodeChannel.available = true;

  module.exports.NodeChannel = NodeChannel;
}
