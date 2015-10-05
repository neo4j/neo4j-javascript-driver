
var available = false;
try {
  // Only define this module if 'net' is available
  require.resolve("net");
  available = true;
} catch(e) {
  module.exports.NodeChannel = { available : false };
}

if( available ) {

  function NodeChannel(url) {
    throw new Error("Sorry, NodeJS not yet implemented!");
  }

  NodeChannel.prototype.writeByte = function( val ) {
    throw new Error("Not yet implemented.");
  }
  NodeChannel.prototype.writeInt16 = function( val ) {
    throw new Error("Not yet implemented.");
  }
  NodeChannel.prototype.writeInt32 = function( val ) {
    throw new Error("Not yet implemented.");
  }
  NodeChannel.prototype.writeFloat64 = function( val ) {
    throw new Error("Not yet implemented.");
  }
  NodeChannel.prototype.writeBytes = function( val ) {
    throw new Error("Not yet implemented.");
  }
  NodeChannel.prototype.flush = function() {
    throw new Error("Not yet implemented.");
  }

  NodeChannel.available = true;

  module.exports.NodeChannel = NodeChannel;
}
