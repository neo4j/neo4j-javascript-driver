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

var neo4j = require("../../lib/v1");

describe('floating point values', function() {
  it('should support float 1.0 ', testVal( 1 ) );
  it('should support float 0.0 ', testVal( 0.0 ) );
  it('should support pretty big float ', testVal( 3.4028235e+38 ) ); // Max 32-bit
  it('should support really big float ', testVal( 1.7976931348623157e+308 ) ); // Max 64-bit
  it('should support pretty small float ', testVal( 1.4e-45 ) ); // Min 32-bit
  it('should support really small float ', testVal( 4.9e-324 ) ); // Min 64-bit
});

describe('integer values', function() {
  it('should support integer 1 ', testVal( neo4j.int(1) ) );
  it('should support integer 0 ', testVal( neo4j.int(0) ) );
  it('should support integer -1 ', testVal( neo4j.int(-1) ) );
  it('should support integer larger than JS Numbers can model', testVal( neo4j.int("0x7fffffffffffffff") ) );
  it('should support integer smaller than JS Numbers can model', testVal( neo4j.int("0x8000000000000000") ) );
});

describe('boolean values', function() {
  it('should support true ',  testVal( true ) );
  it('should support false ', testVal( false ) );
});

describe('string values', function() {
  it('should support empty string ',   testVal( "" ) );
  it('should support simple string ',  testVal( "abcdefghijklmnopqrstuvwxyz" ) );
  it('should support awesome string ', testVal( "All makt åt Tengil, vår befriare." ) );
});

describe('list values', function() {
  it('should support empty lists ',   testVal( [] ) );
  it('should support float lists ',   testVal( [ 1,2,3 ] ) );
  it('should support boolean lists ', testVal( [ true, false ] ) );
  it('should support string lists ',  testVal( [ "", "hello!" ] ) );
  it('should support list lists ',    testVal( [ [], [1,2,3] ] ) );
  it('should support map lists ',     testVal( [ {}, {a:12} ] ) );
});

describe('map values', function() {
  it('should support empty maps ', testVal( {} ) );
  it('should support basic maps ', testVal( {a:1, b:{}, c:[], d:{e:1}} ) );
});

describe('node values', function() {
  it('should support returning nodes ', function(done) {
    // Given
    var driver = neo4j.driver("bolt://localhost");
    var session = driver.session();

    // When
    session.run("CREATE (n:User {name:'Lisa'}) RETURN n, id(n)").then(function(rs) {
        var node = rs[0]['n'];

        expect( node.properties ).toEqual( { name:"Lisa" } );
        expect( node.labels ).toEqual( ["User"] );
        // expect( node.identity ).toEqual( rs[0]['id(n)'] ); // TODO
        driver.close();
        done();

      });
  });
});

describe('relationship values', function() {
  it('should support returning relationships', function(done) {
    // Given
    var driver = neo4j.driver("bolt://localhost");
    var session = driver.session();

    // When
    session.run("CREATE ()-[r:User {name:'Lisa'}]->() RETURN r, id(r)").then(function(rs) {
        var rel = rs[0]['r'];

        expect( rel.properties ).toEqual( { name:"Lisa" } );
        expect( rel.type ).toEqual( "User" );
        // expect( rel.identity ).toEqual( rs[0]['id(r)'] ); // TODO
        driver.close();
        done();

      });
  });
});

describe('path values', function() {
  it('should support returning paths', function(done) {
    // Given
    var driver = neo4j.driver("bolt://localhost");
    var session = driver.session();

    // When
    session.run("CREATE p=(:User { name:'Lisa' })<-[r:KNOWS {since:1234.0}]-() RETURN p")
      .then(function(rs) {
        var path = rs[0]['p'];

        expect( path.start.properties ).toEqual( { name:"Lisa" } );
        expect( path.end.properties ).toEqual( { } );

        // Accessing path segments
        expect( path.length ).toEqual( 1 );
        for (var i = 0; i < path.length; i++) {
          var segment = path.segments[i];
          // The direction of the path segment goes from lisa to the blank node
          expect( segment.start.properties ).toEqual( { name:"Lisa" } );
          expect( segment.end.properties ).toEqual( { } );
          // Which is the inverse of the relationship itself!
          expect( segment.relationship.properties ).toEqual( { since: 1234 } );
        };
        driver.close();
        done();
      });
  });
});

function testVal( val ) {
  return function( done ) {
    var driver = neo4j.driver("bolt://localhost");
    var session = driver.session();

    session.run("RETURN {val} as v", {val: val})
      .then( function( records ) {
        expect( records[0]['v'] ).toEqual( val );
        driver.close();
        done();
      });
  }
}
