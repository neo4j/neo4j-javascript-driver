/**
 * Copyright (c) 2002-2015 "Neo Technology,"
 * Network Engine for Objects in Lund AB [http://neotechnology.com]
 *
 * This file is part of Neo4j.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
 
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

  // Not on NodeJS, add shim for WebAPI TextEncoder/TextDecoder
  var textEncoding = require('../external/text-encoding/index');
  let encoder = new textEncoding.TextEncoder("utf-8");
  let decoder = new textEncoding.TextDecoder("utf-8");

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
