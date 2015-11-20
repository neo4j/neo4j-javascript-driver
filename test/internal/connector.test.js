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
 
var connect = require("../../build/node/internal/connector.js").connect;

describe('connector', function() {
  it('should read/write basic messages', function(done) {
    // Given
    var conn = connect("bolt://localhost")

    // When
    conn.initialize( "mydriver/0.0.0", {
      onCompleted: function( msg ) {
        expect( msg ).not.toBeNull();
        conn.close();
        done();
      }
    });
    conn.sync();

  });
  it('should retrieve stream', function(done) {
    // Given
    var conn = connect("bolt://localhost")

    // When
    var records = [];
    conn.initialize( "mydriver/0.0.0" );
    conn.run( "RETURN 1.0", {} );
    conn.pullAll( {
      onNext: function( record ) {
        records.push( record ); 
      },
      onCompleted: function( tail ) {
        expect( records[0][0] ).toBe( 1 );
        conn.close();
        done();
      }
    });
    conn.sync();

  });
});
