/**
 * Copyright (c) 2002-2018 "Neo Technology,"
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

import Pool from '../../src/v1/internal/pool';

describe('Pool', () => {

  it('allocates if pool is empty', () => {
    // Given
    let counter = 0;
    const key = 'bolt://localhost:7687';
    const pool = new Pool((url, release) => new Resource(url, counter++, release));

    // When
    const r0 = pool.acquire(key);
    const r1 = pool.acquire(key);

    // Then
    expect(r0.id).toBe(0);
    expect(r1.id).toBe(1);
    expect(r0).not.toBe(r1);
  });

  it('pools if resources are returned', () => {
    // Given a pool that allocates
    let counter = 0;
    const key = 'bolt://localhost:7687';
    const pool = new Pool((url, release) => new Resource(url, counter++, release));

    // When
    const r0 = pool.acquire(key);
    r0.close();
    const r1 = pool.acquire(key);

    // Then
    expect(r0.id).toBe(0);
    expect(r1.id).toBe(0);
    expect(r0).toBe(r1);
  });

  it('handles multiple keys', () => {
    // Given a pool that allocates
    let counter = 0;
    const key1 = 'bolt://localhost:7687';
    const key2 = 'bolt://localhost:7688';
    const pool = new Pool((url, release) => new Resource(url, counter++, release));

    // When
    const r0 = pool.acquire(key1);
    const r1 = pool.acquire(key2);
    r0.close();
    const r2 = pool.acquire(key1);
    const r3 = pool.acquire(key2);

    // Then
    expect(r0.id).toBe(0);
    expect(r1.id).toBe(1);
    expect(r2.id).toBe(0);
    expect(r3.id).toBe(2);

    expect(r0).toBe(r2);
    expect(r1).not.toBe(r3);
  });

  it('frees if pool reaches max size', () => {
    // Given a pool that tracks destroyed resources
    let counter = 0;
    let destroyed = [];
    const key = 'bolt://localhost:7687';
    const pool = new Pool(
      (url, release) => new Resource(url, counter++, release),
      resource => {
        destroyed.push(resource);
      },
      resource => true,
      2 // maxIdle
    );

    // When
    const r0 = pool.acquire(key);
    const r1 = pool.acquire(key);
    const r2 = pool.acquire(key);
    r0.close();
    r1.close();
    r2.close();

    // Then
    expect(destroyed.length).toBe(1);
    expect(destroyed[0].id).toBe(r2.id);
  });

  it('frees if validate returns false', () => {
    // Given a pool that allocates
    let counter = 0;
    let destroyed = [];
    const key = 'bolt://localhost:7687';
    const pool = new Pool(
      (url, release) => new Resource(url, counter++, release),
      resource => {
        destroyed.push(resource);
      },
      resource => false,
      1000 // maxIdle
    );

    // When
    const r0 = pool.acquire(key);
    const r1 = pool.acquire(key);
    r0.close();
    r1.close();

    // Then
    expect(destroyed.length).toBe(2);
    expect(destroyed[0].id).toBe(r0.id);
    expect(destroyed[1].id).toBe(r1.id);
  });


  it('purges keys', () => {
    // Given a pool that allocates
    let counter = 0;
    const key1 = 'bolt://localhost:7687';
    const key2 = 'bolt://localhost:7688';
    const pool = new Pool((url, release) => new Resource(url, counter++, release),
      res => {
        res.destroyed = true;
        return true;
      }
    );

    // When
    const r0 = pool.acquire(key1);
    const r1 = pool.acquire(key2);
    r0.close();
    r1.close();
    expect(pool.has(key1)).toBeTruthy();
    expect(pool.has(key2)).toBeTruthy();
    pool.purge(key1);
    expect(pool.has(key1)).toBeFalsy();
    expect(pool.has(key2)).toBeTruthy();

    const r2 = pool.acquire(key1);
    const r3 = pool.acquire(key2);

    // Then
    expect(r0.id).toBe(0);
    expect(r0.destroyed).toBeTruthy();
    expect(r1.id).toBe(1);
    expect(r2.id).toBe(2);
    expect(r3.id).toBe(1);
  });

  it('destroys resource when key was purged', () => {
    let counter = 0;
    const key = 'bolt://localhost:7687';
    const pool = new Pool((url, release) => new Resource(url, counter++, release),
      res => {
        res.destroyed = true;
        return true;
      }
    );

    const r0 = pool.acquire(key);
    expect(pool.has(key)).toBeTruthy();
    expect(r0.id).toEqual(0);

    pool.purge(key);
    expect(pool.has(key)).toBeFalsy();
    expect(r0.destroyed).toBeFalsy();

    r0.close();
    expect(pool.has(key)).toBeFalsy();
    expect(r0.destroyed).toBeTruthy();
  });

  it('purges all keys', () => {
    let counter = 0;

    const key1 = 'bolt://localhost:7687';
    const key2 = 'bolt://localhost:7688';
    const key3 = 'bolt://localhost:7689';

    const pool = new Pool((url, release) => new Resource(url, counter++, release),
      res => {
        res.destroyed = true;
        return true;
      }
    );

    const acquiredResources = [
      pool.acquire(key1),
      pool.acquire(key2),
      pool.acquire(key3),
      pool.acquire(key1),
      pool.acquire(key2),
      pool.acquire(key3)
    ];
    acquiredResources.forEach(resource => resource.close());

    pool.purgeAll();

    acquiredResources.forEach(resource => expect(resource.destroyed).toBeTruthy());
  });

  it('skips broken connections during acquire', () => {
    let validated = false;
    let counter = 0;
    const key = 'bolt://localhost:7687';
    const pool = new Pool((url, release) => new Resource(url, counter++, release),
      res => {
        res.destroyed = true;
        return true;
      },
      () => {
        if (validated) {
          return false;
        }
        validated = true;
        return true;
      }
    );

    const r0 = pool.acquire(key);
    r0.close();

    const r1 = pool.acquire(key);
    expect(r1).not.toBe(r0);
  });

  it('reports presence of the key', () => {
    const existingKey = 'bolt://localhost:7687';
    const absentKey = 'bolt://localhost:7688';

    const pool = new Pool((url, release) => new Resource(url, 42, release));

    pool.acquire(existingKey);
    pool.acquire(existingKey);

    expect(pool.has(existingKey)).toBeTruthy();
    expect(pool.has(absentKey)).toBeFalsy();
  });
});

class Resource {

  constructor(key, id, release) {
    this.id = id;
    this.key = key;
    this.release = release;
    this.destroyed = false;
  }

  close() {
    this.release(this.key, this);
  }
}
