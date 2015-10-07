
var debug = require("../log").debug;
var HeapBuffer = require("../buf").HeapBuffer;

/**
 * Create a new WebSocketChannel.
 */
function WebSocketChannel(opts) {

  this._url = "ws:" + opts.host + ":" + (opts.port || 7688);
  this._ws = new WebSocket(this._url);
  this._ws.binaryType = "arraybuffer";

  this._ws.onmessage = function(event) {
    if( this.onmessage ) {
      this.onmessage( new HeapBuffer( event.data ) );
    } 
  };

}

WebSocketChannel.prototype.write = function( buffer ) {
  if( buffer instanceof HeapBuffer ) {
    this._ws.send( buffer._buffer );
  } else {
    throw new Exception( "Don't know how to send buffer: " + buffer );
  }
}

WebSocketChannel.available = typeof WebSocket !== 'undefined';


module.exports.WebSocketChannel = WebSocketChannel;
