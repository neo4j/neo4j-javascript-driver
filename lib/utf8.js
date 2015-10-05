
// This module defines a cross-platform UTF-8 encoder and decoder that works
// with the Buffer API defined in buf.js

var buf = require("./buf");

try {
  var node = require("buffer");

  module.exports = {
    "encode" : function( str ) {
      return new buf.NodeBuffer( new node.Buffer(str, "UTF-8") );
    },
    "decode" : function( buffer, length ) {
      if( buffer instanceof buf.NodeBuffer ) {
        var start = buffer.position,
            end = start + length;
        buffer.position = end;
        return buffer._buffer.toString( 'utf8', start, end );
      } else {
        throw new Error( "Don't know how to decode strings from `" + buffer + "`.");
      }
    }
  }

} catch( e ) {

  var encoder = new TextEncoder("utf-8");
  var decoder = new TextDecoder("utf-8");

  module.exports = {
    "encode" : function( str ) {
      return new buf.HeapBuffer( encoder.encode(str).buffer );
    },
    "decode" : function( buffer, length ) {
      throw new Error( "Not yet implemented.");
    }
  }
}
