/**
 * Copyright (c) 2002-2019 "Neo4j,"
 * Neo4j Sweden AB [http://neo4j.com]
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

import Pool from '../../src/v1/internal/pool'
import PoolConfig from '../../src/v1/internal/pool-config'
import ServerAddress from '../../src/v1/internal/server-address'

describe('Pool', () => {
  it('allocates if pool is empty', done => {
    // Given
    let counter = 0
    const address = ServerAddress.fromUrl('bolt://localhost:7687')
    const pool = new Pool((server, release) =>
      Promise.resolve(new Resource(server, counter++, release))
    )

    // When
    const p0 = pool.acquire(address)
    const p1 = pool.acquire(address)

    // Then
    Promise.all([p0, p1]).then(values => {
      const r0 = values[0]
      const r1 = values[1]

      expect(r0.id).toBe(0)
      expect(r1.id).toBe(1)
      expect(r0).not.toBe(r1)

      done()
    })
  })

  it('pools if resources are returned', done => {
    // Given a pool that allocates
    let counter = 0
    const address = ServerAddress.fromUrl('bolt://localhost:7687')
    const pool = new Pool((server, release) =>
      Promise.resolve(new Resource(server, counter++, release))
    )

    // When
    const p0 = pool.acquire(address).then(r0 => {
      r0.close()
      return r0
    })
    const p1 = p0.then(r0 => pool.acquire(address))

    // Then
    Promise.all([p0, p1]).then(values => {
      const r0 = values[0]
      const r1 = values[1]

      expect(r0.id).toBe(0)
      expect(r1.id).toBe(0)
      expect(r0).toBe(r1)

      done()
    })
  })

  it('handles multiple keys', done => {
    // Given a pool that allocates
    let counter = 0
    const address1 = ServerAddress.fromUrl('bolt://localhost:7687')
    const address2 = ServerAddress.fromUrl('bolt://localhost:7688')
    const pool = new Pool((server, release) =>
      Promise.resolve(new Resource(server, counter++, release))
    )

    // When
    const p0 = pool.acquire(address1)
    const p1 = pool.acquire(address2)
    const p01 = Promise.all([p0, p1]).then(values => values[0].close())
    const p2 = p01.then(() => pool.acquire(address1))
    const p3 = p01.then(() => pool.acquire(address2))

    // Then
    Promise.all([p0, p1, p2, p3]).then(values => {
      const r0 = values[0]
      const r1 = values[1]
      const r2 = values[2]
      const r3 = values[3]

      expect(r0.id).toBe(0)
      expect(r1.id).toBe(1)
      expect(r2.id).toBe(0)
      expect(r3.id).toBe(2)

      expect(r0).toBe(r2)
      expect(r1).not.toBe(r3)

      done()
    })
  })

  it('frees if validate returns false', done => {
    // Given a pool that allocates
    let counter = 0
    let destroyed = []
    const address = ServerAddress.fromUrl('bolt://localhost:7687')
    const pool = new Pool(
      (server, release) =>
        Promise.resolve(new Resource(server, counter++, release)),
      resource => {
        destroyed.push(resource)
      },
      resource => false,
      new PoolConfig(1000, 60000)
    )

    // When
    const p0 = pool.acquire(address)
    const p1 = pool.acquire(address)

    // Then
    Promise.all([p0, p1]).then(values => {
      const r0 = values[0]
      const r1 = values[1]

      r0.close()
      r1.close()

      expect(destroyed.length).toBe(2)
      expect(destroyed[0].id).toBe(r0.id)
      expect(destroyed[1].id).toBe(r1.id)

      done()
    })
  })

  it('purges keys', done => {
    // Given a pool that allocates
    let counter = 0
    const address1 = ServerAddress.fromUrl('bolt://localhost:7687')
    const address2 = ServerAddress.fromUrl('bolt://localhost:7688')
    const pool = new Pool(
      (server, release) =>
        Promise.resolve(new Resource(server, counter++, release)),
      res => {
        res.destroyed = true
        return true
      }
    )

    // When
    const p0 = pool.acquire(address1)
    const p1 = pool.acquire(address2)
    const p01 = Promise.all([p0, p1]).then(values => {
      values.forEach(v => v.close())

      expect(pool.has(address1)).toBeTruthy()
      expect(pool.has(address2)).toBeTruthy()

      pool.purge(address1)

      expect(pool.has(address1)).toBeFalsy()
      expect(pool.has(address2)).toBeTruthy()
    })

    const p2 = p01.then(() => pool.acquire(address1))
    const p3 = p01.then(() => pool.acquire(address2))

    // Then
    Promise.all([p0, p1, p2, p3]).then(values => {
      const r0 = values[0]
      const r1 = values[1]
      const r2 = values[2]
      const r3 = values[3]

      expect(r0.id).toBe(0)
      expect(r0.destroyed).toBeTruthy()
      expect(r1.id).toBe(1)
      expect(r2.id).toBe(2)
      expect(r3.id).toBe(1)

      done()
    })
  })

  it('clears out resource counters even after purge', done => {
    // Given a pool that allocates
    let counter = 0
    const address1 = ServerAddress.fromUrl('bolt://localhost:7687')
    const address2 = ServerAddress.fromUrl('bolt://localhost:7688')
    const pool = new Pool(
      (server, release) =>
        Promise.resolve(new Resource(server, counter++, release)),
      res => {
        res.destroyed = true
        return true
      }
    )

    // When
    const p00 = pool.acquire(address1)
    const p01 = pool.acquire(address1)
    const p10 = pool.acquire(address2)
    const p11 = pool.acquire(address2)
    const p12 = pool.acquire(address2)
    Promise.all([p00, p01, p10, p11, p12]).then(values => {
      expect(pool.activeResourceCount(address1)).toEqual(2)
      expect(pool.activeResourceCount(address2)).toEqual(3)

      expect(pool.has(address1)).toBeTruthy()
      expect(pool.has(address2)).toBeTruthy()

      values[0].close()

      expect(pool.activeResourceCount(address1)).toEqual(1)

      pool.purge(address1)

      expect(pool.activeResourceCount(address1)).toEqual(1)

      values[1].close()

      expect(pool.activeResourceCount(address1)).toEqual(0)
      expect(pool.activeResourceCount(address2)).toEqual(3)

      expect(values[0].destroyed).toBeTruthy()
      expect(values[1].destroyed).toBeTruthy()

      expect(pool.has(address1)).toBeFalsy()
      expect(pool.has(address2)).toBeTruthy()

      done()
    })
  })

  it('destroys resource when key was purged', done => {
    let counter = 0
    const address = ServerAddress.fromUrl('bolt://localhost:7687')
    const pool = new Pool(
      (server, release) =>
        Promise.resolve(new Resource(server, counter++, release)),
      res => {
        res.destroyed = true
        return true
      }
    )

    const p0 = pool.acquire(address)
    p0.then(r0 => {
      expect(pool.has(address)).toBeTruthy()
      expect(r0.id).toEqual(0)

      pool.purge(address)
      expect(pool.has(address)).toBeFalsy()
      expect(r0.destroyed).toBeFalsy()

      r0.close()
      expect(pool.has(address)).toBeFalsy()
      expect(r0.destroyed).toBeTruthy()

      done()
    })
  })

  it('purges all keys', done => {
    let counter = 0

    const address1 = ServerAddress.fromUrl('bolt://localhost:7687')
    const address2 = ServerAddress.fromUrl('bolt://localhost:7688')
    const address3 = ServerAddress.fromUrl('bolt://localhost:7689')

    const pool = new Pool(
      (server, release) =>
        Promise.resolve(new Resource(server, counter++, release)),
      res => {
        res.destroyed = true
        return true
      }
    )

    const acquiredResources = [
      pool.acquire(address1),
      pool.acquire(address2),
      pool.acquire(address3),
      pool.acquire(address1),
      pool.acquire(address2),
      pool.acquire(address3)
    ]

    Promise.all(acquiredResources).then(values => {
      values.forEach(resource => resource.close())

      pool.purgeAll()

      values.forEach(resource => expect(resource.destroyed).toBeTruthy())

      done()
    })
  })

  it('purges keys other than the ones to keep', done => {
    let counter = 0

    const address1 = ServerAddress.fromUrl('bolt://localhost:7687')
    const address2 = ServerAddress.fromUrl('bolt://localhost:7688')
    const address3 = ServerAddress.fromUrl('bolt://localhost:7689')

    const pool = new Pool(
      (server, release) =>
        Promise.resolve(new Resource(server, counter++, release)),
      res => {
        res.destroyed = true
        return true
      }
    )

    const acquiredResources = [
      pool.acquire(address1),
      pool.acquire(address2),
      pool.acquire(address3),
      pool.acquire(address1),
      pool.acquire(address2),
      pool.acquire(address3)
    ]

    Promise.all(acquiredResources).then(values => {
      expect(pool.has(address1)).toBeTruthy()
      expect(pool.has(address2)).toBeTruthy()
      expect(pool.has(address3)).toBeTruthy()

      pool.keepAll([address1, address3])

      expect(pool.has(address1)).toBeTruthy()
      expect(pool.has(address3)).toBeTruthy()
      expect(pool.has(address2)).toBeFalsy()

      done()
    })
  })

  it('purges all keys if addresses to keep is empty', done => {
    let counter = 0

    const address1 = ServerAddress.fromUrl('bolt://localhost:7687')
    const address2 = ServerAddress.fromUrl('bolt://localhost:7688')
    const address3 = ServerAddress.fromUrl('bolt://localhost:7689')

    const pool = new Pool(
      (server, release) =>
        Promise.resolve(new Resource(server, counter++, release)),
      res => {
        res.destroyed = true
        return true
      }
    )

    const acquiredResources = [
      pool.acquire(address1),
      pool.acquire(address2),
      pool.acquire(address3),
      pool.acquire(address1),
      pool.acquire(address2),
      pool.acquire(address3)
    ]

    Promise.all(acquiredResources).then(values => {
      expect(pool.has(address1)).toBeTruthy()
      expect(pool.has(address2)).toBeTruthy()
      expect(pool.has(address3)).toBeTruthy()

      pool.keepAll([])

      expect(pool.has(address1)).toBeFalsy()
      expect(pool.has(address3)).toBeFalsy()
      expect(pool.has(address2)).toBeFalsy()

      done()
    })
  })

  it('skips broken connections during acquire', done => {
    let validated = false
    let counter = 0
    const address = ServerAddress.fromUrl('bolt://localhost:7687')
    const pool = new Pool(
      (server, release) =>
        Promise.resolve(new Resource(server, counter++, release)),
      res => {
        res.destroyed = true
        return true
      },
      () => {
        if (validated) {
          return false
        }
        validated = true
        return true
      }
    )

    const p0 = pool.acquire(address)
    const p1 = p0.then(r0 => {
      r0.close()

      return pool.acquire(address)
    })

    Promise.all([p0, p1]).then(values => {
      const r0 = values[0]
      const r1 = values[1]

      expect(r1).not.toBe(r0)

      done()
    })
  })

  it('reports presence of the key', done => {
    const existingAddress = ServerAddress.fromUrl('bolt://localhost:7687')
    const absentAddress = ServerAddress.fromUrl('bolt://localhost:7688')

    const pool = new Pool((server, release) =>
      Promise.resolve(new Resource(server, 42, release))
    )

    const p0 = pool.acquire(existingAddress)
    const p1 = pool.acquire(existingAddress)

    Promise.all([p0, p1]).then(() => {
      expect(pool.has(existingAddress)).toBeTruthy()
      expect(pool.has(absentAddress)).toBeFalsy()

      done()
    })
  })

  it('reports zero active resources when empty', () => {
    const pool = new Pool((server, release) =>
      Promise.resolve(new Resource(server, 42, release))
    )

    expect(
      pool.activeResourceCount(ServerAddress.fromUrl('bolt://localhost:1'))
    ).toEqual(0)
    expect(
      pool.activeResourceCount(ServerAddress.fromUrl('bolt://localhost:2'))
    ).toEqual(0)
    expect(
      pool.activeResourceCount(ServerAddress.fromUrl('bolt://localhost:3'))
    ).toEqual(0)
  })

  it('reports active resources', done => {
    const address = ServerAddress.fromUrl('bolt://localhost:7687')
    const pool = new Pool((server, release) =>
      Promise.resolve(new Resource(server, 42, release))
    )

    const p0 = pool.acquire(address)
    const p1 = pool.acquire(address)
    const p2 = pool.acquire(address)

    Promise.all([p0, p1, p2]).then(values => {
      values.forEach(v => expect(v).toBeDefined())

      expect(pool.activeResourceCount(address)).toEqual(3)

      done()
    })
  })

  it('reports active resources when they are acquired', done => {
    const address = ServerAddress.fromUrl('bolt://localhost:7687')
    const pool = new Pool((server, release) =>
      Promise.resolve(new Resource(server, 42, release))
    )

    // three new resources are created and returned to the pool
    const p0 = pool.acquire(address)
    const p1 = pool.acquire(address)
    const p2 = pool.acquire(address)
    const p012 = Promise.all([p0, p1, p2]).then(values => {
      values.forEach(v => v.close())
      return values
    })

    // three idle resources are acquired from the pool
    const p3 = p012.then(() => pool.acquire(address))
    const p4 = p012.then(() => pool.acquire(address))
    const p5 = p012.then(() => pool.acquire(address))

    Promise.all([p012, p3, p4, p5]).then(values => {
      const r0 = values[0][0]
      const r1 = values[0][1]
      const r2 = values[0][2]

      expect(values).toContain(r0)
      expect(values).toContain(r1)
      expect(values).toContain(r2)

      expect(pool.activeResourceCount(address)).toEqual(3)

      done()
    })
  })

  it('does not report resources that are returned to the pool', done => {
    const address = ServerAddress.fromUrl('bolt://localhost:7687')
    const pool = new Pool((server, release) =>
      Promise.resolve(new Resource(server, 42, release))
    )

    const p0 = pool.acquire(address)
    const p1 = pool.acquire(address)
    const p2 = pool.acquire(address)
    const p012 = Promise.all([p0, p1, p2]).then(values => {
      const r0 = values[0]
      const r1 = values[1]
      const r2 = values[2]

      expect(pool.activeResourceCount(address)).toEqual(3)

      r0.close()
      expect(pool.activeResourceCount(address)).toEqual(2)

      r1.close()
      expect(pool.activeResourceCount(address)).toEqual(1)

      r2.close()
      expect(pool.activeResourceCount(address)).toEqual(0)

      return values
    })

    p012
      .then(() => pool.acquire(address))
      .then(r3 => {
        expect(pool.activeResourceCount(address)).toEqual(1)

        r3.close()
        expect(pool.activeResourceCount(address)).toEqual(0)

        done()
      })
  })

  it('should wait for a returned connection when max pool size is reached', done => {
    let counter = 0

    const address = ServerAddress.fromUrl('bolt://localhost:7687')
    const pool = new Pool(
      (server, release) =>
        Promise.resolve(new Resource(server, counter++, release)),
      resource => {},
      resource => true,
      new PoolConfig(2, 5000)
    )

    const p0 = pool.acquire(address)
    const p1 = pool.acquire(address)
    Promise.all([p0, p1]).then(values => {
      const r0 = values[0]
      const r1 = values[1]

      expect(r0.id).toEqual(0)
      expect(r1.id).toEqual(1)

      pool.acquire(address).then(r2 => {
        expect(r2).toBe(r1)

        done()
      })

      setTimeout(() => {
        expectNumberOfAcquisitionRequests(pool, address, 1)
        r1.close()
      }, 1000)
    })
  })

  it('should time out when max pool size is reached', done => {
    let counter = 0

    const address = ServerAddress.fromUrl('bolt://localhost:7687')
    const pool = new Pool(
      (server, release) =>
        Promise.resolve(new Resource(server, counter++, release)),
      resource => {},
      resource => true,
      new PoolConfig(2, 1000)
    )

    const p0 = pool.acquire(address)
    const p1 = pool.acquire(address)
    Promise.all([p0, p1]).then(values => {
      const r0 = values[0]
      const r1 = values[1]

      expect(r0.id).toEqual(0)
      expect(r1.id).toEqual(1)

      pool.acquire(address).catch(error => {
        expect(error.message).toContain('timed out')
        expectNumberOfAcquisitionRequests(pool, address, 0)
        done()
      })
    })
  })

  it('should not time out if max pool size is not set', done => {
    let counter = 0

    const address = ServerAddress.fromUrl('bolt://localhost:7687')
    const pool = new Pool(
      (server, release) =>
        Promise.resolve(new Resource(server, counter++, release)),
      resource => {},
      resource => true
    )

    const p0 = pool.acquire(address)
    const p1 = pool.acquire(address)
    Promise.all([p0, p1]).then(values => {
      const r0 = values[0]
      const r1 = values[1]

      expect(r0.id).toEqual(0)
      expect(r1.id).toEqual(1)

      pool.acquire(address).then(r2 => {
        expect(r2.id).toEqual(2)
        expectNoPendingAcquisitionRequests(pool)
        done()
      })
    })
  })

  it('should work fine when resources released together with acquisition timeout', done => {
    const acquisitionTimeout = 1000
    let counter = 0

    const address = ServerAddress.fromUrl('bolt://localhost:7687')
    const pool = new Pool(
      (server, release) =>
        Promise.resolve(new Resource(server, counter++, release)),
      resource => {},
      () => true,
      new PoolConfig(2, acquisitionTimeout)
    )

    pool.acquire(address).then(resource1 => {
      expect(resource1.id).toEqual(0)

      pool.acquire(address).then(resource2 => {
        expect(resource2.id).toEqual(1)

        // try to release both resources around the time acquisition fails with timeout
        // double-release used to cause deletion of acquire requests in the pool and failure of the timeout
        // such background failure made this test fail, not the existing assertions
        setTimeout(() => {
          resource1.close()
          resource2.close()
        }, acquisitionTimeout)

        pool
          .acquire(address)
          .then(someResource => {
            expect(someResource).toBeDefined()
            expect(someResource).not.toBeNull()
            expectNoPendingAcquisitionRequests(pool)
            done() // ok, promise got resolved before the timeout
          })
          .catch(error => {
            expect(error).toBeDefined()
            expect(error).not.toBeNull()
            expectNoPendingAcquisitionRequests(pool)
            done() // also ok, timeout fired before promise got resolved
          })
      })
    })
  })

  it('should resolve pending acquisition request when single invalid resource returned', done => {
    const address = ServerAddress.fromUrl('bolt://localhost:7687')
    const acquisitionTimeout = 1000
    let counter = 0

    const pool = new Pool(
      (server, release) =>
        Promise.resolve(new Resource(server, counter++, release)),
      resource => {},
      resourceValidOnlyOnceValidationFunction,
      new PoolConfig(1, acquisitionTimeout)
    )

    pool.acquire(address).then(resource1 => {
      expect(resource1.id).toEqual(0)
      expect(pool.activeResourceCount(address)).toEqual(1)

      // release the resource before the acquisition timeout, it should be treated as invalid
      setTimeout(() => {
        expectNumberOfAcquisitionRequests(pool, address, 1)
        resource1.close()
      }, acquisitionTimeout / 2)

      pool
        .acquire(address)
        .then(resource2 => {
          expect(resource2.id).toEqual(1)
          expectNoPendingAcquisitionRequests(pool)
          expect(pool.activeResourceCount(address)).toEqual(1)
          done()
        })
        .catch(error => {
          done.fail(error)
        })
    })
  })

  it('should work fine when invalid resources released and acquisition attempt pending', done => {
    const address = ServerAddress.fromUrl('bolt://localhost:7687')
    const acquisitionTimeout = 1000
    let counter = 0

    const pool = new Pool(
      (server, release) =>
        Promise.resolve(new Resource(server, counter++, release)),
      resource => {},
      resourceValidOnlyOnceValidationFunction,
      new PoolConfig(2, acquisitionTimeout)
    )

    pool.acquire(address).then(resource1 => {
      expect(resource1.id).toEqual(0)
      expect(pool.activeResourceCount(address)).toEqual(1)

      pool.acquire(address).then(resource2 => {
        expect(resource2.id).toEqual(1)
        expect(pool.activeResourceCount(address)).toEqual(2)

        // release both resources before the acquisition timeout, they should be treated as invalid
        setTimeout(() => {
          expectNumberOfAcquisitionRequests(pool, address, 1)
          resource1.close()
          resource2.close()
        }, acquisitionTimeout / 2)

        pool
          .acquire(address)
          .then(resource3 => {
            expect(resource3.id).toEqual(2)
            expectNoPendingAcquisitionRequests(pool)
            expect(pool.activeResourceCount(address)).toEqual(1)
            done()
          })
          .catch(error => {
            done.fail(error)
          })
      })
    })
  })
})

function expectNoPendingAcquisitionRequests (pool) {
  const acquireRequests = pool._acquireRequests
  Object.values(acquireRequests).forEach(requests => {
    if (Array.isArray(requests) && requests.length === 0) {
      requests = undefined
    }
    expect(requests).not.toBeDefined()
  })
}

function expectNumberOfAcquisitionRequests (pool, address, expectedNumber) {
  expect(pool._acquireRequests[address.asKey()].length).toEqual(expectedNumber)
}

function resourceValidOnlyOnceValidationFunction (resource) {
  // all resources are valid only once
  if (resource.validatedOnce) {
    return false
  } else {
    resource.validatedOnce = true
    return true
  }
}

class Resource {
  constructor (key, id, release) {
    this.id = id
    this.key = key
    this.release = release
    this.destroyed = false
  }

  close () {
    this.release(this.key, this)
  }
}
