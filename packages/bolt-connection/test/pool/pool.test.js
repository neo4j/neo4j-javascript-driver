/**
 * Copyright (c) "Neo4j"
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

import Pool from '../../src/pool/pool'
import PoolConfig from '../../src/pool/pool-config'
import { newError, error, internal } from 'neo4j-driver-core'

const {
  serverAddress: { ServerAddress }
} = internal

const { SERVICE_UNAVAILABLE } = error

describe('#unit Pool', () => {
  it('allocates if pool is empty', async () => {
    // Given
    let counter = 0
    const address = ServerAddress.fromUrl('bolt://localhost:7687')
    const pool = new Pool({
      create: (server, release) =>
        Promise.resolve(new Resource(server, counter++, release))
    })

    // When
    const r0 = await pool.acquire(address)
    const r1 = await pool.acquire(address)

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
      create: (server, release) =>
        Promise.resolve(new Resource(server, counter++, release))
    })

    // When
    const r0 = await pool.acquire(address)
    await r0.close()

    const r1 = await pool.acquire(address)

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
      create: (server, release) =>
        Promise.resolve(new Resource(server, counter++, release))
    })

    // When
    const r0 = await pool.acquire(address1)
    const r1 = await pool.acquire(address2)
    await r0.close()

    const r2 = await pool.acquire(address1)
    const r3 = await pool.acquire(address2)

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
      create: (server, release) =>
        Promise.resolve(new Resource(server, counter++, release)),
      destroy: res => {
        destroyed.push(res)
        return Promise.resolve()
      },
      validate: res => false,
      config: new PoolConfig(1000, 60000)
    })

    // When
    const r0 = await pool.acquire(address)
    const r1 = await pool.acquire(address)

    // Then
    await r0.close()
    await r1.close()

    expect(destroyed.length).toBe(2)
    expect(destroyed[0].id).toBe(r0.id)
    expect(destroyed[1].id).toBe(r1.id)
  })

  it('purges keys', async () => {
    // Given a pool that allocates
    let counter = 0
    const address1 = ServerAddress.fromUrl('bolt://localhost:7687')
    const address2 = ServerAddress.fromUrl('bolt://localhost:7688')
    const pool = new Pool({
      create: (server, release) =>
        Promise.resolve(new Resource(server, counter++, release)),
      destroy: res => {
        res.destroyed = true
        return Promise.resolve()
      }
    })

    // When
    const r0 = await pool.acquire(address1)
    const r1 = await pool.acquire(address2)

    await r0.close()
    await r1.close()

    expect(pool.has(address1)).toBeTruthy()
    expect(pool.has(address2)).toBeTruthy()

    await pool.purge(address1)

    expect(pool.has(address1)).toBeFalsy()
    expect(pool.has(address2)).toBeTruthy()

    const r2 = await pool.acquire(address1)
    const r3 = await pool.acquire(address2)

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
      create: (server, release) =>
        Promise.resolve(new Resource(server, counter++, release)),
      destroy: res => {
        res.destroyed = true
        return Promise.resolve()
      }
    })

    // When
    const r00 = await pool.acquire(address1)
    const r01 = await pool.acquire(address1)
    const r10 = await pool.acquire(address2)
    const r11 = await pool.acquire(address2)
    const r12 = await pool.acquire(address2)

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
      create: (server, release) =>
        Promise.resolve(new Resource(server, counter++, release)),
      destroy: res => {
        res.destroyed = true
        return Promise.resolve()
      }
    })

    const r0 = await pool.acquire(address)
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
      create: (server, release) =>
        Promise.resolve(new Resource(server, counter++, release)),
      destroy: res => {
        res.destroyed = true
        return Promise.resolve()
      }
    })

    // Acquire resource
    const r0 = await pool.acquire(address)
    expect(pool.has(address)).toBeTruthy()
    expect(r0.id).toEqual(0)

    // Purging the key
    await pool.purge(address)
    expect(pool.has(address)).toBeFalsy()
    expect(r0.destroyed).toBeFalsy()

    // Acquiring second resource should recreate the pool
    const r1 = await pool.acquire(address)
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

  it('people are strange', async () => {
    let counter = 0
    const address = ServerAddress.fromUrl('bolt://localhost:7687')
    const pool = new Pool({
      create: (server, release) =>
        Promise.resolve(new Resource(server, counter++, release)),
      destroy: res => {
        res.destroyed = true
        return Promise.resolve()
      },
      config: new PoolConfig(2, 500)
    })

    // Acquire resource
    const r0 = await pool.acquire(address)
    expect(pool.has(address)).toBeTruthy()
    expect(r0.id).toEqual(0)

    // Purging the key
    await pool.purge(address)
    expect(pool.has(address)).toBeFalsy()
    expect(r0.destroyed).toBeFalsy()

    // Acquiring second resource should recreate the pool
    const r1 = await pool.acquire(address)

    const r2 = pool.acquire(address)


    setTimeout(async () => {
      pool._poolState = {}
      await r0.close()
    }, 700)
    

    try {
      await r2
      expect(false).toBeTruthy()
    } catch(e) {
      expect(e.message).toEqual('Connection acquisition timed out in 500 ms. Pool status: Active conn count = 2, Idle conn count = 0.')
    }

    await r1.close()
    await pool.close()
  })

  it('close purges all keys', async () => {
    let counter = 0

    const address1 = ServerAddress.fromUrl('bolt://localhost:7687')
    const address2 = ServerAddress.fromUrl('bolt://localhost:7688')
    const address3 = ServerAddress.fromUrl('bolt://localhost:7689')

    const pool = new Pool({
      create: (server, release) =>
        Promise.resolve(new Resource(server, counter++, release)),
      destroy: res => {
        res.destroyed = true
        return Promise.resolve()
      }
    })

    const acquiredResources = [
      pool.acquire(address1),
      pool.acquire(address2),
      pool.acquire(address3),
      pool.acquire(address1),
      pool.acquire(address2),
      pool.acquire(address3)
    ]
    const values = await Promise.all(acquiredResources)
    await Promise.all(values.map(resource => resource.close()))

    await pool.close()

    values.forEach(resource => expect(resource.destroyed).toBeTruthy())
  })

  it('should fail to acquire when closed', async () => {
    const address = ServerAddress.fromUrl('bolt://localhost:7687')
    const pool = new Pool({
      create: (server, release) =>
        Promise.resolve(new Resource(server, 0, release)),
      destroy: res => {
        return Promise.resolve()
      }
    })

    // Close the pool
    await pool.close()

    await expect(pool.acquire(address)).rejects.toMatchObject({
      message: expect.stringMatching('Pool is closed')
    })
  })

  it('should fail to acquire when closed with idle connections', async () => {
    const address = ServerAddress.fromUrl('bolt://localhost:7687')

    const pool = new Pool({
      create: (server, release) =>
        Promise.resolve(new Resource(server, 0, release)),
      destroy: res => {
        return Promise.resolve()
      }
    })

    // Acquire and release a resource
    const resource = await pool.acquire(address)
    await resource.close()

    // Close the pool
    await pool.close()

    await expect(pool.acquire(address)).rejects.toMatchObject({
      message: expect.stringMatching('Pool is closed')
    })
  })
  it('purges keys other than the ones to keep', async () => {
    let counter = 0

    const address1 = ServerAddress.fromUrl('bolt://localhost:7687')
    const address2 = ServerAddress.fromUrl('bolt://localhost:7688')
    const address3 = ServerAddress.fromUrl('bolt://localhost:7689')

    const pool = new Pool({
      create: (server, release) =>
        Promise.resolve(new Resource(server, counter++, release)),
      destroy: res => {
        res.destroyed = true
        return Promise.resolve()
      }
    })

    const acquiredResources = [
      pool.acquire(address1),
      pool.acquire(address2),
      pool.acquire(address3),
      pool.acquire(address1),
      pool.acquire(address2),
      pool.acquire(address3)
    ]
    const values = await Promise.all(acquiredResources)

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
      create: (server, release) =>
        Promise.resolve(new Resource(server, counter++, release)),
      destroy: res => {
        res.destroyed = true
        return Promise.resolve()
      }
    })

    const acquiredResources = [
      pool.acquire(address1),
      pool.acquire(address2),
      pool.acquire(address3),
      pool.acquire(address1),
      pool.acquire(address2),
      pool.acquire(address3)
    ]
    const values = await Promise.all(acquiredResources)

    expect(pool.has(address1)).toBeTruthy()
    expect(pool.has(address2)).toBeTruthy()
    expect(pool.has(address3)).toBeTruthy()

    await pool.keepAll([])

    expect(pool.has(address1)).toBeFalsy()
    expect(pool.has(address3)).toBeFalsy()
    expect(pool.has(address2)).toBeFalsy()
  })

  it('skips broken connections during acquire', async () => {
    let validated = false
    let counter = 0
    const address = ServerAddress.fromUrl('bolt://localhost:7687')
    const pool = new Pool({
      create: (server, release) =>
        Promise.resolve(new Resource(server, counter++, release)),
      destroy: res => {
        res.destroyed = true
        return Promise.resolve()
      },
      validate: () => {
        if (validated) {
          return false
        }
        validated = true
        return true
      }
    })

    const r0 = await pool.acquire(address)
    await r0.close()
    const r1 = await pool.acquire(address)

    expect(r1).not.toBe(r0)
  })

  it('reports presence of the key', async () => {
    const existingAddress = ServerAddress.fromUrl('bolt://localhost:7687')
    const absentAddress = ServerAddress.fromUrl('bolt://localhost:7688')

    const pool = new Pool({
      create: (server, release) =>
        Promise.resolve(new Resource(server, 42, release))
    })

    const r1 = await pool.acquire(existingAddress)
    const r0 = await pool.acquire(existingAddress)

    expect(pool.has(existingAddress)).toBeTruthy()
    expect(pool.has(absentAddress)).toBeFalsy()
  })

  it('reports zero active resources when empty', () => {
    const pool = new Pool({
      create: (server, release) =>
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
      create: (server, release) =>
        Promise.resolve(new Resource(server, 42, release))
    })

    const acquiredResources = [
      pool.acquire(address),
      pool.acquire(address),
      pool.acquire(address)
    ]
    const values = await Promise.all(acquiredResources)

    values.forEach(v => expect(v).toBeDefined())

    expect(pool.activeResourceCount(address)).toEqual(3)
  })

  it('reports active resources when they are acquired', async () => {
    const address = ServerAddress.fromUrl('bolt://localhost:7687')
    const pool = new Pool({
      create: (server, release) =>
        Promise.resolve(new Resource(server, 42, release))
    })

    // three new resources are created and returned to the pool
    const r0 = await pool.acquire(address)
    const r1 = await pool.acquire(address)
    const r2 = await pool.acquire(address)
    await [r0, r1, r2].map(v => v.close())

    // three idle resources are acquired from the pool
    const acquiredResources = [
      pool.acquire(address),
      pool.acquire(address),
      pool.acquire(address)
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
      create: (server, release) =>
        Promise.resolve(new Resource(server, 42, release))
    })

    const r0 = await pool.acquire(address)
    const r1 = await pool.acquire(address)
    const r2 = await pool.acquire(address)
    expect(pool.activeResourceCount(address)).toEqual(3)

    await r0.close()
    expect(pool.activeResourceCount(address)).toEqual(2)

    await r1.close()
    expect(pool.activeResourceCount(address)).toEqual(1)

    await r2.close()
    expect(pool.activeResourceCount(address)).toEqual(0)

    const r3 = await pool.acquire(address)
    expect(pool.activeResourceCount(address)).toEqual(1)

    await r3.close()
    expect(pool.activeResourceCount(address)).toEqual(0)
  })

  it('should wait for a returned connection when max pool size is reached', async () => {
    let counter = 0

    const address = ServerAddress.fromUrl('bolt://localhost:7687')
    const pool = new Pool({
      create: (server, release) =>
        Promise.resolve(new Resource(server, counter++, release)),
      destroy: res => Promise.resolve(),
      validate: res => true,
      config: new PoolConfig(2, 5000)
    })

    const r0 = await pool.acquire(address)
    const r1 = await pool.acquire(address)

    setTimeout(() => {
      expectNumberOfAcquisitionRequests(pool, address, 1)
      r1.close()
    }, 1000)

    const r2 = await pool.acquire(address)
    expect(r2).toBe(r1)
  })

  it('should time out when max pool size is reached', async () => {
    let counter = 0

    const address = ServerAddress.fromUrl('bolt://localhost:7687')
    const pool = new Pool({
      create: (server, release) =>
        Promise.resolve(new Resource(server, counter++, release)),
      destroy: res => Promise.resolve(),
      validate: res => true,
      config: new PoolConfig(2, 1000)
    })

    await pool.acquire(address)
    await pool.acquire(address)

    await expect(pool.acquire(address)).rejects.toMatchObject({
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
      create: (server, release) => {
        // Create a fake connection that makes it possible control when it's connected
        // and released from the outer scope.
        const conn = {
          server: server,
          release: release
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
    const req1 = pool.acquire(address)
    expect(conns.length).toEqual(1)

    // Make another request to the same server, this should not try to acquire another
    // connection since the pool will be full when the connection for the first request
    // is resolved.
    const req2 = pool.acquire(address)
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
      create: (server, release) =>
        Promise.resolve(new Resource(server, counter++, release)),
      destroy: res => Promise.resolve(),
      validate: res => true
    })

    await pool.acquire(address)
    await pool.acquire(address)

    const r2 = await pool.acquire(address)
    expect(r2.id).toEqual(2)
    expectNoPendingAcquisitionRequests(pool)
  })

  it('should work fine when resources released together with acquisition timeout', async () => {
    const acquisitionTimeout = 1000
    let counter = 0

    const address = ServerAddress.fromUrl('bolt://localhost:7687')
    const pool = new Pool({
      create: (server, release) =>
        Promise.resolve(new Resource(server, counter++, release)),
      destroy: res => Promise.resolve(),
      validate: res => true,
      config: new PoolConfig(2, acquisitionTimeout)
    })

    const resource1 = await pool.acquire(address)
    expect(resource1.id).toEqual(0)

    const resource2 = await pool.acquire(address)
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
      .acquire(address)
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
      create: (server, release) =>
        Promise.resolve(new Resource(server, counter++, release)),
      destroy: res => Promise.resolve(),
      validate: resourceValidOnlyOnceValidationFunction,
      config: new PoolConfig(1, acquisitionTimeout)
    })

    const resource1 = await pool.acquire(address)
    expect(resource1.id).toEqual(0)
    expect(pool.activeResourceCount(address)).toEqual(1)

    // release the resource before the acquisition timeout, it should be treated as invalid
    setTimeout(() => {
      expectNumberOfAcquisitionRequests(pool, address, 1)
      resource1.close()
    }, acquisitionTimeout / 2)

    const resource2 = await pool.acquire(address)
    expect(resource2.id).toEqual(1)
    expectNoPendingAcquisitionRequests(pool)
    expect(pool.activeResourceCount(address)).toEqual(1)
  })

  it('should work fine when invalid resources released and acquisition attempt pending', async () => {
    const address = ServerAddress.fromUrl('bolt://localhost:7687')
    const acquisitionTimeout = 1000
    let counter = 0

    const pool = new Pool({
      create: (server, release) =>
        Promise.resolve(new Resource(server, counter++, release)),
      destroy: res => Promise.resolve(),
      validate: resourceValidOnlyOnceValidationFunction,
      config: new PoolConfig(2, acquisitionTimeout)
    })

    const resource1 = await pool.acquire(address)
    expect(resource1.id).toEqual(0)
    expect(pool.activeResourceCount(address)).toEqual(1)

    const resource2 = await pool.acquire(address)
    expect(resource2.id).toEqual(1)
    expect(pool.activeResourceCount(address)).toEqual(2)

    // release both resources before the acquisition timeout, they should be treated as invalid
    setTimeout(() => {
      expectNumberOfAcquisitionRequests(pool, address, 1)
      resource1.close()
      resource2.close()
    }, acquisitionTimeout / 2)

    const resource3 = await pool.acquire(address)
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
      create: (server, release) =>
        Promise.resolve(new Resource(server, resourceCount++, release)),
      destroy: res => Promise.resolve(),
      validate: res => true,
      installIdleObserver: (resource, observer) => {
        installIdleObserverCount++
      },
      removeIdleObserver: resource => {
        removeIdleObserverCount++
      }
    })

    const r1 = await pool.acquire(address)
    const r2 = await pool.acquire(address)
    const r3 = await pool.acquire(address)
    await [r1, r2, r3].map(r => r.close())

    expect(installIdleObserverCount).toEqual(3)
    expect(removeIdleObserverCount).toEqual(0)

    await pool.acquire(address)
    await pool.acquire(address)
    await pool.acquire(address)

    expect(installIdleObserverCount).toEqual(3)
    expect(removeIdleObserverCount).toEqual(3)
  })

  it('should clean-up resource when connection fails while idle', async () => {
    const address = ServerAddress.fromUrl('bolt://localhost:7687')
    let resourceCount = 0

    const pool = new Pool({
      create: (server, release) =>
        Promise.resolve(new Resource(server, resourceCount++, release)),
      destroy: res => Promise.resolve(),
      validate: res => true,
      installIdleObserver: (resource, observer) => {
        resource.observer = observer
      },
      removeIdleObserver: resource => {
        delete resource.observer
      }
    })

    const resource1 = await pool.acquire(address)
    const resource2 = await pool.acquire(address)
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
      create: (server, release) =>
        Promise.resolve(new Resource(server, resourceCount++, release)),
      destroy: res => Promise.resolve(),
      validate: res => true,
      installIdleObserver: (resource, observer) => {
        resource.observer = observer
      },
      removeIdleObserver: resource => {
        delete resource.observer
      }
    })

    const resource1 = await pool.acquire(address)
    const resource2 = await pool.acquire(address)
    await resource1.close()
    await resource2.close()

    await pool.purge(address)

    expect(resource1.observer).toBeFalsy()
    expect(resource2.observer).toBeFalsy()
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
