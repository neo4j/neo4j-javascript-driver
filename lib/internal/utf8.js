
// This module defines a cross-platform UTF-8 encoder and decoder that works
// with the Buffer API defined in buf.js

import buf from "./buf";
let platformObj = {};

try {
  // This will throw an exception is 'buffer' is not available
  require.resolve("buffer");

  let node = require("buffer");

  platformObj = {
    "encode" : function( str ) {
      return new buf.NodeBuffer( new node.Buffer(str, "UTF-8") );
    },
    "decode" : function( buffer, length ) {
      if( buffer instanceof buf.NodeBuffer ) {
        let start = buffer.position,
            end = start + length;
        buffer.position = end;
        return buffer._buffer.toString( 'utf8', start, end );
      } else {
        throw new Error( "Don't know how to decode strings from `" + buffer + "`.");
      }
    }
  }

} catch( e ) {

  // Not on NodeJS, assume we can use Web APIs

  let encoder = new TextEncoder("utf-8");
  let decoder = new TextDecoder("utf-8");

  platformObj = {
    "encode" : function( str ) {
      return new buf.HeapBuffer( encoder.encode(str).buffer );
    },
    "decode" : function( buffer, length ) {
      if( buffer instanceof buf.HeapBuffer ) {
        return decoder.decode( buffer.readView( length ) );
      } else {
        throw new Error( "Don't know how to decode strings from `" + buffer + "`.");
      }
    }
  }
}

export default platformObj;
