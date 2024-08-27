/**
 * Copyright (c) "Neo4j"
 * Neo4j Sweden AB [https://neo4j.com]
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

import Pool from '../../../src/internal/pool/pool'
import PoolConfig from '../../../src/internal/pool/pool-config'
import { ServerAddress } from '../../../src/internal/server-address'
import { newError, error } from '../../../src'

const { SERVICE_UNAVAILABLE } = error

describe('#unit Pool', () => {
  it('allocates if pool is empty', async () => {
    // Given
    let counter = 0
    const address = ServerAddress.fromUrl('bolt://localhost:7687')
    const pool = new Pool({
      create: (_: unknown, server: ServerAddress, release: (address: ServerAddress, resource: unknown) => Promise<void> ) =>
        Promise.resolve(new Resource(server, counter++, release))
    })

    // When
    const r0 = await pool.acquire({}, address)
    const r1 = await pool.acquire({}, address)

    // Then
    expect(r0.id).toBe(0)
    expect(r1.id).toBe(1)
    expect(r0).not.toBe(r1)
  })

  it('pools if resources are returned', async () => {
    // Given a pool that allocates
    let counter = 0
    const address = ServerAddress.fromUrl('bolt://localhost:7687')
    const pool = new Pool({
      create: (_, server, release) =>
        Promise.resolve(new Resource(server, counter++, release))
    })

    // When
    const r0 = await pool.acquire({}, address)
    await r0.close()

    const r1 = await pool.acquire({}, address)

    // Then
    expect(r0.id).toBe(0)
    expect(r1.id).toBe(0)
    expect(r0).toBe(r1)
  })

  it('handles multiple keys', async () => {
    // Given a pool that allocates
    let counter = 0
    const address1 = ServerAddress.fromUrl('bolt://localhost:7687')
    const address2 = ServerAddress.fromUrl('bolt://localhost:7688')
    const pool = new Pool({
      create: (_, server, release) =>
        Promise.resolve(new Resource(server, counter++, release))
    })

    // When
    const r0 = await pool.acquire({}, address1)
    const r1 = await pool.acquire({}, address2)
    await r0.close()

    const r2 = await pool.acquire({}, address1)
    const r3 = await pool.acquire({}, address2)

    // Then
    expect(r0.id).toBe(0)
    expect(r1.id).toBe(1)
    expect(r2.id).toBe(0)
    expect(r3.id).toBe(2)

    expect(r0).toBe(r2)
    expect(r1).not.toBe(r3)
  })

  it('frees if validate returns false', async () => {
    // Given a pool that allocates
    let counter = 0
    const destroyed = []
    const address = ServerAddress.fromUrl('bolt://localhost:7687')
    const pool = new Pool({
      create: (_acquisitionContext, server, release) =>
        Promise.resolve(new Resource(server, counter++, release)),
      destroy: res => {
        destroyed.push(res)
        return Promise.resolve()
      },
      validateOnRelease: res => false,
      config: new PoolConfig(1000, 60000)
    })

    // When
    const r0 = await pool.acquire({}, address)
    const r1 = await pool.acquire({}, address)

    // Then
    await r0.close()
    await r1.close()

    expect(destroyed.length).toBe(2)
    expect(destroyed[0].id).toBe(r0.id)
    expect(destroyed[1].id).toBe(r1.id)
  })

  it('should release resources and process acquisitions when destroy connection', async () => {
    // Given a pool that allocates
    let counter = 0
    const destroyed = []
    const address = ServerAddress.fromUrl('bolt://localhost:7687')
    const pool = new Pool({
      create: (_acquisitionContext, server, release) =>
        Promise.resolve(new Resource(server, counter++, release)),
      destroy: res => {
        destroyed.push(res)
        return Promise.resolve()
      },
      validateOnRelease: res => false,
      config: new PoolConfig(2, 10000)
    })

    // When
    const r0 = await pool.acquire({}, address)
    const r1 = await pool.acquire({}, address)
    const promiseOfR2Status = { state: 'pending' }
    const promiseOfR2 = pool.acquire({}, address)
      .then(r2 => {
        promiseOfR2Status.state = 'resolved'
        return r2
      }).catch((e) => {
        promiseOfR2Status.state = 'rejected'
        throw e
      })

    expect(promiseOfR2Status.state).toEqual('pending')

    await r0.close()
    await r1.close()

    // Then
    const r2 = await promiseOfR2

    await r2.close()

    expect(destroyed.length).toBe(3)
    expect(destroyed[0].id).toBe(r0.id)
    expect(destroyed[1].id).toBe(r1.id)
    expect(destroyed[2].id).toBe(r2.id)
  })

  it('should release resources and process acquisitions when destroy connection fails', async () => {
    // Given a pool that allocates
    let counter = 0
    const theMadeUpError = new Error('I made this error for testing')
    const destroyed = []
    const address = ServerAddress.fromUrl('bolt://localhost:7687')
    const pool = new Pool({
      create: (_acquisitionContext, server, release) =>
        Promise.resolve(new Resource(server, counter++, release)),
      destroy: res => {
        destroyed.push(res)
        return Promise.reject(theMadeUpError)
      },
      validateOnRelease: res => false,
      config: new PoolConfig(2, 3000)
    })

    // When
    const r0 = await pool.acquire({}, address)
    const r1 = await pool.acquire({}, address)
    const promiseOfR2Status = { state: 'pending' }
    const promiseOfR2 = pool.acquire({}, address)
      .then(r2 => {
        promiseOfR2Status.state = 'resolved'
        return r2
      }).catch((e) => {
        promiseOfR2Status.state = 'rejected'
        throw e
      })

    expect(promiseOfR2Status.state).toEqual('pending')

    await expect(r0.close()).rejects.toThrow(theMadeUpError)
    await expect(r1.close()).rejects.toThrow(theMadeUpError)

    // Then
    const r2 = await promiseOfR2

    await expect(r2.close()).rejects.toThrow(theMadeUpError)

    expect(destroyed.length).toBe(3)
    expect(destroyed[0].id).toBe(r0.id)
    expect(destroyed[1].id).toBe(r1.id)
    expect(destroyed[2].id).toBe(r2.id)
  })

  it('should release resources and process acquisitions when destroy connection fails in closed pools', async () => {
    // Given a pool that allocates
    let counter = 0
    const theMadeUpError = new Error('I made this error for testing')
    const destroyed = []
    const address = ServerAddress.fromUrl('bolt://localhost:7687')
    const pool = new Pool({
      create: (_acquisitionContext, server, release) =>
        Promise.resolve(new Resource(server, counter++, release)),
      destroy: res => {
        destroyed.push(res)
        return Promise.reject(theMadeUpError)
      },
      validateOnRelease: res => true,
      config: new PoolConfig(2, 3000)
    })

    // When
    const r0 = await pool.acquire({}, address)
    const r1 = await pool.acquire({}, address)

    const promiseOfR2Status = { state: 'pending' }
    const promiseOfR2 = pool.acquire({}, address)
      .then(r2 => {
        promiseOfR2Status.state = 'resolved'
        return r2
      }).catch((e) => {
        promiseOfR2Status.state = 'rejected'
        throw e
      })

    await pool.purge(address)

    expect(promiseOfR2Status.state).toEqual('pending')

    await expect(r0.close()).rejects.toThrow(theMadeUpError)
    await expect(r1.close()).rejects.toThrow(theMadeUpError)

    // Then
    const r2 = await promiseOfR2

    // Don't fail since the pool will be open again
    await r2.close()

    expect(destroyed.length).toBe(2)
    expect(destroyed[0].id).toBe(r0.id)
    expect(destroyed[1].id).toBe(r1.id)
  })

  it('frees if validateOnRelease returns Promise.resolve(false)', async () => {
    // Given a pool that allocates
    let counter = 0
    const destroyed = []
    const address = ServerAddress.fromUrl('bolt://localhost:7687')
    const pool = new Pool({
      create: (_acquisitionContext, server, release) =>
        Promise.resolve(new Resource(server, counter++, release)),
      destroy: res => {
        destroyed.push(res)
        return Promise.resolve()
      },
      validateOnRelease: res => Promise.resolve(false),
      config: new PoolConfig(1000, 60000)
    })

    // When
    const r0 = await pool.acquire({}, address)
    const r1 = await pool.acquire({}, address)

    // Then
    await r0.close()
    await r1.close()

    expect(destroyed.length).toBe(2)
    expect(destroyed[0].id).toBe(r0.id)
    expect(destroyed[1].id).toBe(r1.id)
  })

  it('does not free if validateOnRelease returns Promise.resolve(true)', async () => {
    // Given a pool that allocates
    let counter = 0
    const destroyed = []
    const address = ServerAddress.fromUrl('bolt://localhost:7687')
    const pool = new Pool({
      create: (_acquisitionContext, server, release) =>
        Promise.resolve(new Resource(server, counter++, release)),
      destroy: res => {
        destroyed.push(res)
        return Promise.resolve()
      },
      validateOnRelease: res => Promise.resolve(true),
      config: new PoolConfig(1000, 60000)
    })

    // When
    const r0 = await pool.acquire({}, address)
    const r1 = await pool.acquire({}, address)

    // Then
    await r0.close()
    await r1.close()

    expect(destroyed.length).toBe(0)
  })

  it('frees if validateOnAcquire returns Promise.resolve(false)', async () => {
    // Given a pool that allocates
    let counter = 0
    const destroyed = []
    const address = ServerAddress.fromUrl('bolt://localhost:7687')
    const pool = new Pool({
      create: (_acquisitionContext, server, release) =>
        Promise.resolve(new Resource(server, counter++, release)),
      destroy: res => {
        destroyed.push(res)
        return Promise.resolve()
      },
      validateOnAcquire: res => Promise.resolve(false),
      config: new PoolConfig(1000, 60000)
    })

    // When
    const r0 = await pool.acquire({}, address)
    const r1 = await pool.acquire({}, address)
    await r1.close()
    await r0.close()

    // Then
    const r2 = await pool.acquire({}, address)

    // Closing
    await r2.close()

    expect(destroyed.length).toBe(2)
    expect(destroyed[0].id).toBe(r0.id)
    expect(destroyed[1].id).toBe(r1.id)
  })

  it('does not free if validateOnAcquire returns Promise.resolve(true)', async () => {
    // Given a pool that allocates
    let counter = 0
    const destroyed = []
    const address = ServerAddress.fromUrl('bolt://localhost:7687')
    const pool = new Pool({
      create: (_acquisitionContext, server, release) =>
        Promise.resolve(new Resource(server, counter++, release)),
      destroy: res => {
        destroyed.push(res)
        return Promise.resolve()
      },
      validateOnAcquire: res => Promise.resolve(true),
      config: new PoolConfig(1000, 60000)
    })

    // When
    const r0 = await pool.acquire({}, address)
    const r1 = await pool.acquire({}, address)
    await r0.close()
    await r1.close()

    // Then
    const r2 = await pool.acquire({}, address)

    // Closing
    await r2.close()

    expect(destroyed.length).toBe(0)
  })

  it('purges keys', async () => {
    // Given a pool that allocates
    let counter = 0
    const address1 = ServerAddress.fromUrl('bolt://localhost:7687')
    const address2 = ServerAddress.fromUrl('bolt://localhost:7688')
    const pool = new Pool({
      create: (_, server, release) =>
        Promise.resolve(new Resource(server, counter++, release)),
      destroy: res => {
        res.destroyed = true
        return Promise.resolve()
      }
    })

    // When
    const r0 = await pool.acquire({}, address1)
    const r1 = await pool.acquire({}, address2)

    await r0.close()
    await r1.close()

    expect(pool.has(address1)).toBeTruthy()
    expect(pool.has(address2)).toBeTruthy()

    await pool.purge(address1)

    expect(pool.has(address1)).toBeFalsy()
    expect(pool.has(address2)).toBeTruthy()

    const r2 = await pool.acquire({}, address1)
    const r3 = await pool.acquire({}, address2)

    // Then
    expect(r0.id).toBe(0)
    expect(r0.destroyed).toBeTruthy()
    expect(r1.id).toBe(1)
    expect(r2.id).toBe(2)
    expect(r3.id).toBe(1)
  })

  it('clears out resource counters even after purge', async () => {
    // Given a pool that allocates
    let counter = 0
    const address1 = ServerAddress.fromUrl('bolt://localhost:7687')
    const address2 = ServerAddress.fromUrl('bolt://localhost:7688')
    const pool = new Pool({
      create: (_, server, release) =>
        Promise.resolve(new Resource(server, counter++, release)),
      destroy: res => {
        res.destroyed = true
        return Promise.resolve()
      }
    })

    // When
    const r00 = await pool.acquire({}, address1)
    const r01 = await pool.acquire({}, address1)
    await pool.acquire({}, address2)
    await pool.acquire({}, address2)
    await pool.acquire({}, address2)

    expect(pool.activeResourceCount(address1)).toEqual(2)
    expect(pool.activeResourceCount(address2)).toEqual(3)

    expect(pool.has(address1)).toBeTruthy()
    expect(pool.has(address2)).toBeTruthy()

    await r00.close()

    expect(pool.activeResourceCount(address1)).toEqual(1)

    await pool.purge(address1)

    expect(pool.activeResourceCount(address1)).toEqual(1)

    await r01.close()

    expect(pool.activeResourceCount(address1)).toEqual(0)
    expect(pool.activeResourceCount(address2)).toEqual(3)

    expect(r00.destroyed).toBeTruthy()
    expect(r01.destroyed).toBeTruthy()

    expect(pool.has(address1)).toBeFalsy()
    expect(pool.has(address2)).toBeTruthy()
  })

  it('destroys resource when key was purged', async () => {
    let counter = 0
    const address = ServerAddress.fromUrl('bolt://localhost:7687')
    const pool = new Pool({
      create: (_, server, release) =>
        Promise.resolve(new Resource(server, counter++, release)),
      destroy: res => {
        res.destroyed = true
        return Promise.resolve()
      }
    })

    const r0 = await pool.acquire({}, address)
    expect(pool.has(address)).toBeTruthy()
    expect(r0.id).toEqual(0)

    await pool.purge(address)
    expect(pool.has(address)).toBeFalsy()
    expect(r0.destroyed).toBeFalsy()

    await r0.close()
    expect(pool.has(address)).toBeFalsy()
    expect(r0.destroyed).toBeTruthy()
  })

  it('destroys resource when pool is purged even if a new pool is created for the same address', async () => {
    let counter = 0
    const address = ServerAddress.fromUrl('bolt://localhost:7687')
    const pool = new Pool({
      create: (_, server, release) =>
        Promise.resolve(new Resource(server, counter++, release)),
      destroy: res => {
        res.destroyed = true
        return Promise.resolve()
      }
    })

    // Acquire resource
    const r0 = await pool.acquire({}, address)
    expect(pool.has(address)).toBeTruthy()
    expect(r0.id).toEqual(0)

    // Purging the key
    await pool.purge(address)
    expect(pool.has(address)).toBeFalsy()
    expect(r0.destroyed).toBeFalsy()

    // Acquiring second resource should recreate the pool
    const r1 = await pool.acquire({}, address)
    expect(pool.has(address)).toBeTruthy()
    expect(r1.id).toEqual(1)

    // Closing the first resource should destroy it
    await r0.close()
    expect(pool.has(address)).toBeTruthy()
    expect(r0.destroyed).toBeTruthy()

    // Closing the second resource should not destroy it
    await r1.close()
    expect(pool.has(address)).toBeTruthy()
    expect(r1.destroyed).toBeFalsy()
  })

  it('close purges all keys', async () => {
    let counter = 0

    const address1 = ServerAddress.fromUrl('bolt://localhost:7687')
    const address2 = ServerAddress.fromUrl('bolt://localhost:7688')
    const address3 = ServerAddress.fromUrl('bolt://localhost:7689')

    const pool = new Pool({
      create: (_, server, release) =>
        Promise.resolve(new Resource(server, counter++, release)),
      destroy: res => {
        res.destroyed = true
        return Promise.resolve()
      }
    })

    const acquiredResources = [
      pool.acquire({}, address2),
      pool.acquire({}, address3),
      pool.acquire({}, address1),
      pool.acquire({}, address1),
      pool.acquire({}, address2),
      pool.acquire({}, address3)
    ]
    const values = await Promise.all(acquiredResources)
    await Promise.all(values.map(resource => resource.close()))

    await pool.close()

    values.forEach(resource => expect(resource.destroyed).toBeTruthy())
  })

  it('should fail to acquire when closed', async () => {
    const address = ServerAddress.fromUrl('bolt://localhost:7687')
    const pool = new Pool({
      create: (_, server, release) =>
        Promise.resolve(new Resource(server, 0, release)),
      destroy: res => {
        return Promise.resolve()
      }
    })

    // Close the pool
    await pool.close()

    await expect(pool.acquire({}, address)).rejects.toMatchObject({
      message: expect.stringMatching('Pool is closed')
    })
  })

  it('should fail to acquire when closed with idle connections', async () => {
    const address = ServerAddress.fromUrl('bolt://localhost:7687')

    const pool = new Pool({
      create: (_, server, release) =>
        Promise.resolve(new Resource(server, 0, release)),
      destroy: res => {
        return Promise.resolve()
      }
    })

    // Acquire and release a resource
    const resource = await pool.acquire({}, address)
    await resource.close()

    // Close the pool
    await pool.close()

    await expect(pool.acquire({}, address)).rejects.toMatchObject({
      message: expect.stringMatching('Pool is closed')
    })
  })

  it('purges keys other than the ones to keep', async () => {
    let counter = 0

    const address1 = ServerAddress.fromUrl('bolt://localhost:7687')
    const address2 = ServerAddress.fromUrl('bolt://localhost:7688')
    const address3 = ServerAddress.fromUrl('bolt://localhost:7689')

    const pool = new Pool({
      create: (_, server, release) =>
        Promise.resolve(new Resource(server, counter++, release)),
      destroy: res => {
        res.destroyed = true
        return Promise.resolve()
      }
    })

    const acquiredResources = [
      pool.acquire({}, address1),
      pool.acquire({}, address2),
      pool.acquire({}, address3),
      pool.acquire({}, address1),
      pool.acquire({}, address2),
      pool.acquire({}, address3)
    ]
    await Promise.all(acquiredResources)

    expect(pool.has(address1)).toBeTruthy()
    expect(pool.has(address2)).toBeTruthy()
    expect(pool.has(address3)).toBeTruthy()

    await pool.keepAll([address1, address3])

    expect(pool.has(address1)).toBeTruthy()
    expect(pool.has(address3)).toBeTruthy()
    expect(pool.has(address2)).toBeFalsy()
  })

  it('purges all keys if addresses to keep is empty', async () => {
    let counter = 0

    const address1 = ServerAddress.fromUrl('bolt://localhost:7687')
    const address2 = ServerAddress.fromUrl('bolt://localhost:7688')
    const address3 = ServerAddress.fromUrl('bolt://localhost:7689')

    const pool = new Pool({
      create: (_, server, release) =>
        Promise.resolve(new Resource(server, counter++, release)),
      destroy: res => {
        res.destroyed = true
        return Promise.resolve()
      }
    })

    const acquiredResources = [
      pool.acquire({}, address1),
      pool.acquire({}, address2),
      pool.acquire({}, address3),
      pool.acquire({}, address1),
      pool.acquire({}, address2),
      pool.acquire({}, address3)
    ]
    await Promise.all(acquiredResources)

    expect(pool.has(address1)).toBeTruthy()
    expect(pool.has(address2)).toBeTruthy()
    expect(pool.has(address3)).toBeTruthy()

    await pool.keepAll([])

    expect(pool.has(address1)).toBeFalsy()
    expect(pool.has(address3)).toBeFalsy()
    expect(pool.has(address2)).toBeFalsy()
  })

  it('skips broken connections during acquire', async () => {
    let validated = true
    let counter = 0
    const address = ServerAddress.fromUrl('bolt://localhost:7687')
    const pool = new Pool({
      create: (_, server, release) =>
        Promise.resolve(new Resource(server, counter++, release)),
      destroy: res => {
        res.destroyed = true
        return Promise.resolve()
      },
      validateOnAcquire: (context, _res) => {
        if (context.triggerValidation) {
          validated = !validated
          return validated
        }
        return true
      }
    })

    const r0 = await pool.acquire({ triggerValidation: false }, address)
    await r0.close()
    const r1 = await pool.acquire({ triggerValidation: true }, address)

    expect(r1).not.toBe(r0)
  })

  it('reports presence of the key', async () => {
    const existingAddress = ServerAddress.fromUrl('bolt://localhost:7687')
    const absentAddress = ServerAddress.fromUrl('bolt://localhost:7688')

    const pool = new Pool({
      create: (_, server, release) =>
        Promise.resolve(new Resource(server, 42, release))
    })

    await pool.acquire({}, existingAddress)
    await pool.acquire({}, existingAddress)

    expect(pool.has(existingAddress)).toBeTruthy()
    expect(pool.has(absentAddress)).toBeFalsy()
  })

  it('reports zero active resources when empty', () => {
    const pool = new Pool({
      create: (_, server, release) =>
        Promise.resolve(new Resource(server, 42, release))
    })

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

  it('reports active resources', async () => {
    const address = ServerAddress.fromUrl('bolt://localhost:7687')
    const pool = new Pool({
      create: (_, server, release) =>
        Promise.resolve(new Resource(server, 42, release))
    })

    const acquiredResources = [
      pool.acquire({}, address),
      pool.acquire({}, address),
      pool.acquire({}, address)
    ]
    const values = await Promise.all(acquiredResources)

    values.forEach(v => expect(v).toBeDefined())

    expect(pool.activeResourceCount(address)).toEqual(3)
  })

  it('reports active resources when they are acquired', async () => {
    const address = ServerAddress.fromUrl('bolt://localhost:7687')
    const pool = new Pool({
      create: (_, server, release) =>
        Promise.resolve(new Resource(server, 42, release))
    })

    // three new resources are created and returned to the pool
    const r0 = await pool.acquire({}, address)
    const r1 = await pool.acquire({}, address)
    const r2 = await pool.acquire({}, address)
    await [r0, r1, r2].map(v => v.close())

    // three idle resources are acquired from the pool
    const acquiredResources = [
      pool.acquire({}, address),
      pool.acquire({}, address),
      pool.acquire({}, address)
    ]
    const resources = await Promise.all(acquiredResources)

    expect(resources).toContain(r0)
    expect(resources).toContain(r1)
    expect(resources).toContain(r2)

    expect(pool.activeResourceCount(address)).toEqual(3)
  })

  it('does not report resources that are returned to the pool', async () => {
    const address = ServerAddress.fromUrl('bolt://localhost:7687')
    const pool = new Pool({
      create: (_, server, release) =>
        Promise.resolve(new Resource(server, 42, release))
    })

    const r0 = await pool.acquire({}, address)
    const r1 = await pool.acquire({}, address)
    const r2 = await pool.acquire({}, address)
    expect(pool.activeResourceCount(address)).toEqual(3)

    await r0.close()
    expect(pool.activeResourceCount(address)).toEqual(2)

    await r1.close()
    expect(pool.activeResourceCount(address)).toEqual(1)

    await r2.close()
    expect(pool.activeResourceCount(address)).toEqual(0)

    const r3 = await pool.acquire({}, address)
    expect(pool.activeResourceCount(address)).toEqual(1)

    await r3.close()
    expect(pool.activeResourceCount(address)).toEqual(0)
  })

  it('should wait for a returned connection when max pool size is reached', async () => {
    let counter = 0

    const address = ServerAddress.fromUrl('bolt://localhost:7687')
    const pool = new Pool({
      create: (_, server, release) =>
        Promise.resolve(new Resource(server, counter++, release)),
      destroy: res => Promise.resolve(),
      config: new PoolConfig(2, 5000)
    })

    await pool.acquire({}, address)
    const r1 = await pool.acquire({}, address)

    setTimeout(() => {
      expectNumberOfAcquisitionRequests(pool, address, 1)
      r1.close()
    }, 1000)

    const r2 = await pool.acquire({}, address)
    expect(r2).toBe(r1)
  })

  it('should time out when max pool size is reached', async () => {
    let counter = 0

    const address = ServerAddress.fromUrl('bolt://localhost:7687')
    const pool = new Pool({
      create: (_, server, release) =>
        Promise.resolve(new Resource(server, counter++, release)),
      destroy: res => Promise.resolve(),
      config: new PoolConfig(2, 1000)
    })

    await pool.acquire({}, address)
    await pool.acquire({}, address)

    await expect(pool.acquire({}, address)).rejects.toMatchObject({
      message: expect.stringMatching('acquisition timed out')
    })
    expectNumberOfAcquisitionRequests(pool, address, 0)
  })

  const address = ServerAddress.fromUrl('bolt://localhost:7687')

  it('should consider pending connects when evaluating max pool size', async () => {
    const conns = []
    const pool = new Pool({
      // Hook into connection creation to track when and what connections that are
      // created.
      create: (_, server, release) => {
        // Create a fake connection that makes it possible control when it's connected
        // and released from the outer scope.
        const conn = {
          server,
          release
        }
        const promise = new Promise((resolve, reject) => {
          conn.resolve = resolve
          conn.reject = reject
        })
        // Put the connection in a list in outer scope even though there only should be
        // one when the test is succeeding.
        conns.push(conn)
        return promise
      },
      // Setup pool to only allow one connection
      config: new PoolConfig(1, 100000)
    })

    // Make the first request for a connection, this will be hanging waiting for the
    // connect promise to be resolved.
    const req1 = pool.acquire({}, address)
    expect(conns.length).toEqual(1)

    // Make another request to the same server, this should not try to acquire another
    // connection since the pool will be full when the connection for the first request
    // is resolved.
    const req2 = pool.acquire({}, address)
    expect(conns.length).toEqual(1)

    // Let's fulfill the connect promise belonging to the first request.
    conns[0].resolve(conns[0])
    await expect(req1).resolves.toBeDefined()

    // Release the connection, it should be picked up by the second request.
    conns[0].release(address, conns[0])
    await expect(req2).resolves.toBeDefined()

    // Just to make sure that there hasn't been any new connection.
    expect(conns.length).toEqual(1)
  })

  it('should not time out if max pool size is not set', async () => {
    let counter = 0

    const pool = new Pool({
      create: (_, server, release) =>
        Promise.resolve(new Resource(server, counter++, release)),
      destroy: res => Promise.resolve()
    })

    await pool.acquire({}, address)
    await pool.acquire({}, address)

    const r2 = await pool.acquire({}, address)
    expect(r2.id).toEqual(2)
    expectNoPendingAcquisitionRequests(pool)
  })

  it('should work fine when resources released together with acquisition timeout', async () => {
    const acquisitionTimeout = 1000
    let counter = 0

    const address = ServerAddress.fromUrl('bolt://localhost:7687')
    const pool = new Pool({
      create: (_, server, release) =>
        Promise.resolve(new Resource(server, counter++, release)),
      destroy: res => Promise.resolve(),
      config: new PoolConfig(2, acquisitionTimeout)
    })

    const resource1 = await pool.acquire({}, address)
    expect(resource1.id).toEqual(0)

    const resource2 = await pool.acquire({}, address)
    expect(resource2.id).toEqual(1)

    // try to release both resources around the time acquisition fails with timeout
    // double-release used to cause deletion of acquire requests in the pool and failure of the timeout
    // such background failure made this test fail, not the existing assertions
    setTimeout(() => {
      resource1.close()
      resource2.close()
    }, acquisitionTimeout)

    // Remember that both code paths are ok with this test, either a success with a valid resource
    // or a time out error due to acquisition timeout being kicked in.
    await pool
      .acquire({}, address)
      .then(someResource => {
        expect(someResource).toBeDefined()
        expect(someResource).not.toBeNull()
        expectNoPendingAcquisitionRequests(pool)
      })
      .catch(error => {
        expect(error).toBeDefined()
        expect(error).not.toBeNull()
        expectNoPendingAcquisitionRequests(pool)
      })
  })

  it('should resolve pending acquisition request when single invalid resource returned', async () => {
    const address = ServerAddress.fromUrl('bolt://localhost:7687')
    const acquisitionTimeout = 1000
    let counter = 0

    const pool = new Pool({
      create: (_, server, release) =>
        Promise.resolve(new Resource(server, counter++, release)),
      destroy: res => Promise.resolve(),
      validateOnAcquire: (_, res) => resourceValidOnlyOnceValidationFunction(res),
      validateOnRelease: resourceValidOnlyOnceValidationFunction,
      config: new PoolConfig(1, acquisitionTimeout)
    })

    const resource1 = await pool.acquire({}, address)
    expect(resource1.id).toEqual(0)
    expect(pool.activeResourceCount(address)).toEqual(1)

    // release the resource before the acquisition timeout, it should be treated as invalid
    setTimeout(() => {
      expectNumberOfAcquisitionRequests(pool, address, 1)
      resource1.close()
    }, acquisitionTimeout / 2)

    const resource2 = await pool.acquire({}, address)
    expect(resource2.id).toEqual(1)
    expectNoPendingAcquisitionRequests(pool)
    expect(pool.activeResourceCount(address)).toEqual(1)
  })

  it('should work fine when invalid resources released and acquisition attempt pending', async () => {
    const address = ServerAddress.fromUrl('bolt://localhost:7687')
    const acquisitionTimeout = 1000
    let counter = 0

    const pool = new Pool({
      create: (_, server, release) =>
        Promise.resolve(new Resource(server, counter++, release)),
      destroy: res => Promise.resolve(),
      validateOnAcquire: (_, res) => resourceValidOnlyOnceValidationFunction(res),
      validateOnRelease: resourceValidOnlyOnceValidationFunction,
      config: new PoolConfig(2, acquisitionTimeout)
    })

    const resource1 = await pool.acquire({}, address)
    expect(resource1.id).toEqual(0)
    expect(pool.activeResourceCount(address)).toEqual(1)

    const resource2 = await pool.acquire({}, address)
    expect(resource2.id).toEqual(1)
    expect(pool.activeResourceCount(address)).toEqual(2)

    // release both resources before the acquisition timeout, they should be treated as invalid
    setTimeout(() => {
      expectNumberOfAcquisitionRequests(pool, address, 1)
      resource1.close()
      resource2.close()
    }, acquisitionTimeout / 2)

    const resource3 = await pool.acquire({}, address)
    expect(resource3.id).toEqual(2)
    expectNoPendingAcquisitionRequests(pool)
    expect(pool.activeResourceCount(address)).toEqual(1)
  })

  it('should set-up idle observer on acquire and release', async () => {
    const address = ServerAddress.fromUrl('bolt://localhost:7687')
    let resourceCount = 0
    let installIdleObserverCount = 0
    let removeIdleObserverCount = 0

    const pool = new Pool({
      create: (_, server, release) =>
        Promise.resolve(new Resource(server, resourceCount++, release)),
      destroy: res => Promise.resolve(),
      installIdleObserver: (resource, observer) => {
        installIdleObserverCount++
      },
      removeIdleObserver: resource => {
        removeIdleObserverCount++
      }
    })

    const r1 = await pool.acquire({}, address)
    const r2 = await pool.acquire({}, address)
    const r3 = await pool.acquire({}, address)
    await [r1, r2, r3].map(r => r.close())

    expect(installIdleObserverCount).toEqual(3)
    expect(removeIdleObserverCount).toEqual(0)

    await pool.acquire({}, address)
    await pool.acquire({}, address)
    await pool.acquire({}, address)

    expect(installIdleObserverCount).toEqual(3)
    expect(removeIdleObserverCount).toEqual(3)
  })

  it('should clean-up resource when connection fails while idle', async () => {
    const address = ServerAddress.fromUrl('bolt://localhost:7687')
    let resourceCount = 0

    const pool = new Pool({
      create: (_, server, release) =>
        Promise.resolve(new Resource(server, resourceCount++, release)),
      destroy: res => Promise.resolve(),
      installIdleObserver: (resource, observer) => {
        resource.observer = observer
      },
      removeIdleObserver: resource => {
        delete resource.observer
      }
    })

    const resource1 = await pool.acquire({}, address)
    const resource2 = await pool.acquire({}, address)
    expect(pool.activeResourceCount(address)).toBe(2)

    await resource1.close()
    expect(pool.activeResourceCount(address)).toBe(1)

    await resource2.close()
    expect(pool.activeResourceCount(address)).toBe(0)

    expect(pool.has(address)).toBeTruthy()

    resource1.observer.onError(
      newError('connection reset', SERVICE_UNAVAILABLE)
    )
    resource2.observer.onError(
      newError('connection reset', SERVICE_UNAVAILABLE)
    )

    expect(pool.activeResourceCount(address)).toBe(0)
    expectNoIdleResources(pool, address)
  })

  it('should clean-up idle observer on purge', async () => {
    const address = ServerAddress.fromUrl('bolt://localhost:7687')
    let resourceCount = 0

    const pool = new Pool({
      create: (_, server, release) =>
        Promise.resolve(new Resource(server, resourceCount++, release)),
      destroy: res => Promise.resolve(),
      installIdleObserver: (resource, observer) => {
        resource.observer = observer
      },
      removeIdleObserver: resource => {
        delete resource.observer
      }
    })

    const resource1 = await pool.acquire({}, address)
    const resource2 = await pool.acquire({}, address)
    await resource1.close()
    await resource2.close()

    await pool.purge(address)

    expect(resource1.observer).toBeFalsy()
    expect(resource2.observer).toBeFalsy()
  })

  it('should thrown acquisition timeout exception if resource takes longer to be created', async () => {
    const address = ServerAddress.fromUrl('bolt://localhost:7687')
    const acquisitionTimeout = 1000
    let counter = 0

    const pool = new Pool({
      create: (_, server, release) =>
        new Promise(resolve => setTimeout(
          () => resolve(new Resource(server, counter++, release))
          , acquisitionTimeout + 10)),
      destroy: res => Promise.resolve(),
      validateOnAcquire: (_, res) => resourceValidOnlyOnceValidationFunction(res),
      validateOnRelease: resourceValidOnlyOnceValidationFunction,
      config: new PoolConfig(1, acquisitionTimeout)
    })

    try {
      await pool.acquire({}, address)
      fail('should have thrown')
    } catch (e) {
      expect(e).toEqual(
        newError(
          `Connection acquisition timed out in ${acquisitionTimeout} ms. ` +
          'Pool status: Active conn count = 0, Idle conn count = 0.'
        )
      )

      const numberOfIdleResourceAfterResourceGetCreated = await new Promise(resolve =>
        setTimeout(() => resolve(idleResources(pool, address)), 11))

      expect(numberOfIdleResourceAfterResourceGetCreated).toEqual(1)
      expect(counter).toEqual(1)
    }
  })

  it('should purge resources in parallel', async () => {
    const address = ServerAddress.fromUrl('bolt://localhost:7687')
    let resourceCount = 0
    const resourcesReleased = []
    let resolveRelease
    const releasePromise = new Promise((resolve) => {
      resolveRelease = resolve
    })

    const pool = new Pool({
      create: (_, server, release) =>
        Promise.resolve(new Resource(server, resourceCount++, release)),
      destroy: res => {
        resourcesReleased.push(res)
        resourceCount--
        // Only destroy when the last resource
        // get destroyed
        if (resourceCount === 0) {
          resolveRelease()
        }
        return releasePromise
      }
    })

    const resource1 = await pool.acquire({}, address)
    const resource2 = await pool.acquire({}, address)
    await resource1.close()
    await resource2.close()

    await pool.purge(address)

    expect(resourcesReleased).toEqual([
      resource2, resource1
    ])
  })

  describe('when acquire force new', () => {
    it('allocates if pool is empty', async () => {
      // Given
      let counter = 0
      const address = ServerAddress.fromUrl('bolt://localhost:7687')
      const pool = new Pool({
        create: (_, server, release) =>
          Promise.resolve(new Resource(server, counter++, release))
      })

      // When
      const r0 = await pool.acquire({}, address)
      const r1 = await pool.acquire({}, address, { requireNew: true })

      // Then
      expect(r0.id).toBe(0)
      expect(r1.id).toBe(1)
      expect(r0).not.toBe(r1)
    })

    it('not pools if resources are returned', async () => {
      // Given a pool that allocates
      let counter = 0
      const address = ServerAddress.fromUrl('bolt://localhost:7687')
      const pool = new Pool({
        create: (_, server, release) =>
          Promise.resolve(new Resource(server, counter++, release))
      })

      // When
      const r0 = await pool.acquire({}, address)
      await r0.close()

      const r1 = await pool.acquire({}, address, { requireNew: true })

      // Then
      expect(r0.id).toBe(0)
      expect(r1.id).toBe(1)
      expect(r0).not.toBe(r1)
    })

    it('should fail to acquire when closed', async () => {
      const address = ServerAddress.fromUrl('bolt://localhost:7687')
      const pool = new Pool({
        create: (_, server, release) =>
          Promise.resolve(new Resource(server, 0, release)),
        destroy: res => {
          return Promise.resolve()
        }
      })

      // Close the pool
      await pool.close()

      await expect(pool.acquire({}, address, { requireNew: true })).rejects.toMatchObject({
        message: expect.stringMatching('Pool is closed')
      })
    })

    it('should fail to acquire when closed with idle connections', async () => {
      const address = ServerAddress.fromUrl('bolt://localhost:7687')

      const pool = new Pool({
        create: (_, server, release) =>
          Promise.resolve(new Resource(server, 0, release)),
        destroy: res => {
          return Promise.resolve()
        }
      })

      // Acquire and release a resource
      const resource = await pool.acquire({}, address)
      await resource.close()

      // Close the pool
      await pool.close()

      await expect(pool.acquire({}, address, { requireNew: true })).rejects.toMatchObject({
        message: expect.stringMatching('Pool is closed')
      })
    })

    it('should wait for a returned connection when max pool size is reached', async () => {
      let counter = 0

      const address = ServerAddress.fromUrl('bolt://localhost:7687')
      const pool = new Pool({
        create: (_, server, release) =>
          Promise.resolve(new Resource(server, counter++, release)),
        destroy: res => Promise.resolve(),
        config: new PoolConfig(2, 5000)
      })

      const r0 = await pool.acquire({}, address)
      const r1 = await pool.acquire({}, address, { requireNew: true })

      setTimeout(() => {
        expectNumberOfAcquisitionRequests(pool, address, 1)
        r1.close()
      }, 1000)

      expect(r1).not.toBe(r0)
      const r2 = await pool.acquire({}, address)
      expect(r2).toBe(r1)
    })

    it('should wait for a returned connection when max pool size is reached and return new', async () => {
      let counter = 0

      const address = ServerAddress.fromUrl('bolt://localhost:7687')
      const pool = new Pool({
        create: (_, server, release) =>
          Promise.resolve(new Resource(server, counter++, release)),
        destroy: res => Promise.resolve(),
        config: new PoolConfig(2, 5000)
      })

      const r0 = await pool.acquire({}, address)
      const r1 = await pool.acquire({}, address, { requireNew: true })

      setTimeout(() => {
        expectNumberOfAcquisitionRequests(pool, address, 1)
        r1.close()
      }, 1000)

      expect(r1).not.toBe(r0)
      const r2 = await pool.acquire({}, address, { requireNew: true })
      expect(r2).not.toBe(r1)
    })

    it('should handle a sequence of request new and the regular request', async () => {
      let counter = 0

      const destroy = jest.fn(res => Promise.resolve())
      const removeIdleObserver = jest.fn(res => undefined)
      const address = ServerAddress.fromUrl('bolt://localhost:7687')
      const pool = new Pool({
        create: (_, server, release) =>
          Promise.resolve(new Resource(server, counter++, release)),
        destroy,
        removeIdleObserver,
        config: new PoolConfig(1, 5000)
      })

      const r0 = await pool.acquire({}, address, { requireNew: true })
      expect(pool.activeResourceCount(address)).toEqual(1)
      expect(idleResources(pool, address)).toBe(0)
      expect(resourceInUse(pool, address)).toBe(1)

      setTimeout(() => {
        expectNumberOfAcquisitionRequests(pool, address, 1)
        r0.close()
      }, 1000)

      const r1 = await pool.acquire({}, address, { requireNew: true })
      expect(destroy).toHaveBeenCalledWith(r0)
      expect(removeIdleObserver).toHaveBeenCalledWith(r0)
      expect(pool.activeResourceCount(address)).toEqual(1)
      expect(idleResources(pool, address)).toBe(0)
      expect(resourceInUse(pool, address)).toBe(1)

      setTimeout(() => {
        expectNumberOfAcquisitionRequests(pool, address, 1)
        r1.close()
      }, 1000)

      expect(r1).not.toBe(r0)
      const r2 = await pool.acquire({}, address, { requireNew: true })
      expect(removeIdleObserver).toHaveBeenCalledWith(r1)
      expect(destroy).toHaveBeenCalledWith(r1)
      expect(r2).not.toBe(r1)
      expect(pool.activeResourceCount(address)).toEqual(1)
      expect(idleResources(pool, address)).toBe(0)
      expect(resourceInUse(pool, address)).toBe(1)

      setTimeout(() => {
        expectNumberOfAcquisitionRequests(pool, address, 1)
        r2.close()
      }, 1000)

      const r3 = await pool.acquire({}, address)
      expect(r3).toBe(r2)
      expect(removeIdleObserver).toHaveBeenCalledWith(r2)
      expect(destroy).not.toHaveBeenCalledWith(r2)
      expect(pool.activeResourceCount(address)).toEqual(1)
      expect(idleResources(pool, address)).toBe(0)
      expect(resourceInUse(pool, address)).toBe(1)
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

function expectNoIdleResources (pool, address) {
  if (pool.has(address)) {
    expect(pool._pools[address.asKey()].length).toBe(0)
  }
}

function idleResources (pool, address) {
  if (pool.has(address)) {
    return pool._pools[address.asKey()].length
  }
  return undefined
}

function resourceInUse (pool, address) {
  if (pool.has(address)) {
    return pool._pools[address.asKey()]._elementsInUse.size
  }
  return undefined
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
    return this.release(this.key, this)
  }
}
