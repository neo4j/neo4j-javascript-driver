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

var Pool = require('../../lib/v1/internal/pool').default;

describe('Pool', function() {
  it('allocates if pool is empty', function() {
    // Given
    var counter = 0;
    var key = "bolt://localhost:7687";
    var pool = new Pool( function (url, release) { return new Resource(url, counter++, release) } );

    // When
    var r0 = pool.acquire(key);
    var r1 = pool.acquire(key);

    // Then
    expect( r0.id ).toBe( 0 );
    expect( r1.id ).toBe( 1 );
  });

  it('pools if resources are returned', function() {
    // Given a pool that allocates
    var counter = 0;
    var key = "bolt://localhost:7687";
    var pool = new Pool( function (url, release) { return new Resource(url, counter++, release) } );

    // When
    var r0 = pool.acquire(key);
    r0.close();
    var r1 = pool.acquire(key);

    // Then
    expect( r0.id ).toBe( 0 );
    expect( r1.id ).toBe( 0 );
  });

  it('handles multiple keys', function() {
    // Given a pool that allocates
    var counter = 0;
    var key1 = "bolt://localhost:7687";
    var key2 = "bolt://localhost:7688";
    var pool = new Pool( function (url, release) { return new Resource(url, counter++, release) } );

    // When
    var r0 = pool.acquire(key1);
    var r1 = pool.acquire(key2);
    r0.close();
    var r2 = pool.acquire(key1);
    var r3 = pool.acquire(key2);

    // Then
    expect( r0.id ).toBe( 0 );
    expect( r1.id ).toBe( 1 );
    expect( r2.id ).toBe( 0 );
    expect( r3.id ).toBe( 2 );
  });

  it('frees if pool reaches max size', function() {
    // Given a pool that tracks destroyed resources
    var counter = 0,
        destroyed = [];
    var key = "bolt://localhost:7687";
    var pool = new Pool(
      function (url, release) { return new Resource(url, counter++, release) },
      function (resource) { destroyed.push(resource); },
      function (resource) { return true; },
      2 // maxIdle
    );

    // When
    var r0 = pool.acquire(key);
    var r1 = pool.acquire(key);
    var r2 = pool.acquire(key);
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
    var key = "bolt://localhost:7687";
    var pool = new Pool(
      function (url, release) { return new Resource(url, counter++, release) },
      function (resource) { destroyed.push(resource); },
      function (resource) { return false; },
      1000 // maxIdle
    );

    // When
    var r0 = pool.acquire(key);
    var r1 = pool.acquire(key);
    r0.close();
    r1.close();

    // Then
    expect( destroyed.length ).toBe( 2 );
    expect( destroyed[0].id ).toBe( r0.id );
    expect( destroyed[1].id ).toBe( r1.id );
  });


  it('purges keys', function() {
    // Given a pool that allocates
    var counter = 0;
    var key1 = "bolt://localhost:7687";
    var key2 = "bolt://localhost:7688";
    var pool = new Pool( function (url, release) { return new Resource(url, counter++, release) },
      function (res) {res.destroyed = true; return true}
    );

    // When
    var r0 = pool.acquire(key1);
    var r1 = pool.acquire(key2);
    r0.close();
    r1.close();
    expect(pool.has(key1)).toBe(true);
    expect(pool.has(key2)).toBe(true);
    pool.purge(key1);
    expect(pool.has(key1)).toBe(false);
    expect(pool.has(key2)).toBe(true);

    var r2 = pool.acquire(key1);
    var r3 = pool.acquire(key2);

    // Then
    expect( r0.id ).toBe( 0 );
    expect( r0.destroyed ).toBe( true );
    expect( r1.id ).toBe( 1 );
    expect( r2.id ).toBe( 2 );
    expect( r3.id ).toBe( 1 );
  });
});

function Resource( key, id, release) {
  var self = this;
  this.id = id;
  this.close = function() { release(key, self); };
}
