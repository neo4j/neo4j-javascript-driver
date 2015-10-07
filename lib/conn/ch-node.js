
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
    var self = this;
    this._pending = [];
    this._conn = net.connect(opts.host, (opts.port || 7687), function() {
      // Drain all pending messages
      var pending = self._pending;
      self._pending = null;
      for (var i = 0; i < pending.length; i++) {
        self.write( pending[i] );
      }
    });

    this._conn.on('data', function( buffer ) {
      if( self.onmessage ) {
        self.onmessage( new NodeBuffer( buffer ) );
      }
    });
  }

  NodeChannel.prototype.write = function( buffer ) {
    // If there is a pending queue, push this on that queue. This means
    // we are not yet connected, so we queue things locally.
    if( this._pending !== null ) {
      this._pending.push( buffer );
    } else if( buffer instanceof NodeBuffer ) {
      this._conn.write( buffer._buffer );
    } else {
      throw new Error( "Don't know how to write: " + buffer );
    }
  }

  NodeChannel.available = true;

  module.exports.NodeChannel = NodeChannel;
}
