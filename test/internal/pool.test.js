/**
 * Copyright (c) 2002-2017 "Neo Technology,","
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

var Pool = require('../../lib/v1/internal/pool').Pool;

describe('Pool', function() {
  it('allocates if pool is empty', function() {
    // Given
    var counter = 0;
    var pool = new Pool( function (release) { return new Resource(counter++, release) } );

    // When
    var r0 = pool.acquire();
    var r1 = pool.acquire();

    // Then
    expect( r0.id ).toBe( 0 );
    expect( r1.id ).toBe( 1 );
  });

  it('pools if resources are returned', function() {
    // Given a pool that allocates
    var counter = 0;
    var pool = new Pool( function (release) { return new Resource(counter++, release) } );

    // When
    var r0 = pool.acquire();
    r0.close();
    var r1 = pool.acquire();

    // Then
    expect( r0.id ).toBe( 0 );
    expect( r1.id ).toBe( 0 );
  });

  it('frees if pool reaches max size', function() {
    // Given a pool that tracks destroyed resources
    var counter = 0,
        destroyed = [];
    var pool = new Pool(
      function (release) { return new Resource(counter++, release) },
      function (resource) { destroyed.push(resource); },
      function (resource) { return true; },
      2 // maxIdle
    );

    // When
    var r0 = pool.acquire();
    var r1 = pool.acquire();
    var r2 = pool.acquire();
    r0.close();
    r1.close();
    r2.close();

    // Then
    expect( destroyed.length ).toBe( 1 );
    expect( destroyed[0].id ).toBe( r2.id );
  });

  it('frees if validate returns false', function() {
    // Given a pool that allocates
    var counter = 0,
      destroyed = [];
    var pool = new Pool(
      function (release) { return new Resource(counter++, release) },
      function (resource) { destroyed.push(resource); },
      function (resource) { return false; },
      1000 // maxIdle
    );

    // When
    var r0 = pool.acquire();
    var r1 = pool.acquire();
    r0.close();
    r1.close();

    // Then
    expect( destroyed.length ).toBe( 2 );
    expect( destroyed[0].id ).toBe( r0.id );
    expect( destroyed[1].id ).toBe( r1.id );
  });
});

function Resource( id, release ) {
  var self = this;
  this.id = id;
  this.close = function() { release(self); };
}
