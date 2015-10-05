
var debug = require("../log").debug;

/**
 * Create a new WebSocketChannel.
 */
function WebSocketChannel(opts) {

  this._url = "ws:" + opts.url.split(/:(.+)?/)[1]
  this._ws = new WebSocket(this._url);

  this._ws.onmessage = function(event) {
      var reader = new FileReader();
      reader.addEventListener("loadend", function() {
          recv(reader.result);
      });
      reader.readAsArrayBuffer(event.data);
  };
  this._ws.onopen = function(event) {
      debug("~~ [CONNECT] " + event.target.url);
      handshake();
  };
  this._ws.onclose = function(event) {
      debug("~~ [CLOSE]");
  };

}

WebSocketChannel.prototype.writeByte = function( val ) {
  throw new Error("Not yet implemented.");
}
WebSocketChannel.prototype.writeInt16 = function( val ) {
  throw new Error("Not yet implemented.");
}
WebSocketChannel.prototype.writeInt32 = function( val ) {
  throw new Error("Not yet implemented.");
}
WebSocketChannel.prototype.writeFloat64 = function( val ) {
  throw new Error("Not yet implemented.");
}
WebSocketChannel.prototype.writeBytes = function( val ) {
  throw new Error("Not yet implemented.");
}
WebSocketChannel.prototype.flush = function() {
  throw new Error("Not yet implemented.");
}

WebSocketChannel.available = typeof WebSocket !== 'undefined';


module.exports.WebSocketChannel = WebSocketChannel;
