/**
 * Copyright (c) 2002-2016 "Neo Technology,"
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
var DummyChannel = require('../../lib/v1/internal/ch-dummy.js');
var connect = require("../../lib/v1/internal/connector.js").connect;

describe('connector', function() {

  it('should read/write basic messages', function(done) {
    // Given
    var conn = connect("bolt://localhost")

    // When
    conn.initialize( "mydriver/0.0.0", {scheme: "basic", principal: "neo4j", credentials: "neo4j"},  {
      onCompleted: function( msg ) {
        expect( msg ).not.toBeNull();
        conn.close();
        done();
      },
      onError: function(err) {
        console.log(err);
      }
    });
    conn.sync();

  });
  it('should retrieve stream', function(done) {
    // Given
    var conn = connect("bolt://localhost")

    // When
    var records = [];
    conn.initialize( "mydriver/0.0.0", {scheme: "basic", principal: "neo4j", credentials: "neo4j"} );
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

  it('should use DummyChannel to read what gets written', function(done) {
    // Given
    var observer = DummyChannel.observer;
    var conn = connect("bolt://localhost", {channel:DummyChannel.channel});

    // When
    var records = [];
    conn.initialize( "mydriver/0.0.0", {scheme: "basic", principal: "neo4j", credentials: "neo4j"} );
    conn.run( "RETURN 1", {} );
    conn.sync();
    expect( observer.instance.toHex() ).toBe( '60 60 b0 17 00 00 00 01 00 00 00 00 00 00 00 00 00 00 00 00 00 41 b2 01 8e 6d 79 64 72 69 76 65 72 2f 30 2e 30 2e 30 a3 86 73 63 68 65 6d 65 85 62 61 73 69 63 89 70 72 69 6e 63 69 70 61 6c 85 6e 65 6f 34 6a 8b 63 72 65 64 65 6e 74 69 61 6c 73 85 6e 65 6f 34 6a 00 00 00 0c b2 10 88 52 45 54 55 52 4e 20 31 a0 00 00 ' );
    done();
  });

  it('should provide error message when connecting to http-port', function(done) {
    // Given
    var conn = connect("bolt://localhost:7474");

    // When
    conn.initialize( "mydriver/0.0.0", {scheme: "basic", principal: "neo4j", credentials: "neo4j"},  {
      onCompleted: function( msg ) {
      },
      onError: function(err) {
        //only node gets the pretty error message
        if( require('../../lib/v1/internal/ch-node.js').available ) {
          expect(err.message).toBe("Server responded HTTP. Make sure you are not trying to connect to the http endpoint " +
            "(HTTP defaults to port 7474 whereas BOLT defaults to port 7687)");
        }
        done();
      }
    });
    conn.sync();

  });

});
