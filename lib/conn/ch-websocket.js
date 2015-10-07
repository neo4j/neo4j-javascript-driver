
var debug = require("../log").debug;
var HeapBuffer = require("../buf").HeapBuffer;

/**
 * Create a new WebSocketChannel.
 */
function WebSocketChannel(opts) {

  this._url = "ws:" + opts.host + ":" + (opts.port || 7688);
  this._ws = new WebSocket(this._url);
  this._ws.binaryType = "arraybuffer";
  this._pending = [];

  var self = this;
  this._ws.onopen = function() {
    // Drain all pending messages
    var pending = self._pending;
    self._pending = null;
    for (var i = 0; i < pending.length; i++) {
      self.write( pending[i] );
    }
  }

  this._ws.onmessage = function(event) {
    if( self.onmessage ) {
      self.onmessage( new HeapBuffer( event.data ) );
    } 
  };

}

WebSocketChannel.prototype.write = function( buffer ) {
  // If there is a pending queue, push this on that queue. This means
  // we are not yet connected, so we queue things locally.
  if( this._pending !== null ) {
    this._pending.push( buffer );
  } else if( buffer instanceof HeapBuffer ) {
    this._ws.send( buffer._buffer );
  } else {
    throw new Exception( "Don't know how to send buffer: " + buffer );
  }
}

WebSocketChannel.available = typeof WebSocket !== 'undefined';


module.exports.WebSocketChannel = WebSocketChannel;
