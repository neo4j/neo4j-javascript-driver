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

import PoolConfig from './pool-config'
import { newError, internal } from 'neo4j-driver-core'

const {
  logger: { Logger }
} = internal

class Pool {
  /**
   * @param {function(address: ServerAddress, function(address: ServerAddress, resource: object): Promise<object>): Promise<object>} create
   *                an allocation function that creates a promise with a new resource. It's given an address for which to
   *                allocate the connection and a function that will return the resource to the pool if invoked, which is
   *                meant to be called on .dispose or .close or whatever mechanism the resource uses to finalize.
   * @param {function(resource: object): Promise<void>} destroy
   *                called with the resource when it is evicted from this pool
   * @param {function(resource: object): boolean} validate
   *                called at various times (like when an instance is acquired and when it is returned.
   *                If this returns false, the resource will be evicted
   * @param {function(resource: object, observer: { onError }): void} installIdleObserver
   *                called when the resource is released back to pool
   * @param {function(resource: object): void} removeIdleObserver
   *                called when the resource is acquired from the pool
   * @param {PoolConfig} config configuration for the new driver.
   * @param {Logger} log the driver logger.
   */
  constructor ({
    create = (address, release) => Promise.resolve(),
    destroy = conn => Promise.resolve(),
    validate = conn => true,
    installIdleObserver = (conn, observer) => {},
    removeIdleObserver = conn => {},
    config = PoolConfig.defaultConfig(),
    log = Logger.noOp()
  } = {}) {
    this._create = create
    this._destroy = destroy
    this._validate = validate
    this._installIdleObserver = installIdleObserver
    this._removeIdleObserver = removeIdleObserver
    this._maxSize = config.maxSize
    this._acquisitionTimeout = config.acquisitionTimeout
    this._pools = {}
    this._pendingCreates = {}
    this._acquireRequests = {}
    this._activeResourceCounts = {}
    this._poolState = {}
    this._release = this._release.bind(this)
    this._log = log
    this._closed = false
  }

  /**
   * Acquire and idle resource fom the pool or create a new one.
   * @param {ServerAddress} address the address for which we're acquiring.
   * @return {Object} resource that is ready to use.
   */
  acquire (address) {
    return this._acquire(address).then(resource => {
      const key = address.asKey()

      if (resource) {
        // New or existing resource acquired
        return resource
      }

      // We're out of resources and will try to acquire later on when an existing resource is released.
      const allRequests = this._acquireRequests
      const requests = allRequests[key]
      if (!requests) {
        allRequests[key] = []
      }

      return new Promise((resolve, reject) => {
        let request

        const timeoutId = setTimeout(() => {
          // acquisition timeout fired

          // remove request from the queue of pending requests, if it's still there
          // request might've been taken out by the release operation
          const pendingRequests = allRequests[key]
          if (pendingRequests) {
            allRequests[key] = pendingRequests.filter(item => item !== request)
          }

          if (request.isCompleted()) {
            // request already resolved/rejected by the release operation; nothing to do
          } else {
            // request is still pending and needs to be failed
            const activeCount = this.activeResourceCount(address)
            const idleCount = this.has(address) ? this._pools[key].length : 0
            request.reject(
              newError(
                `Connection acquisition timed out in ${this._acquisitionTimeout} ms. Pool status: Active conn count = ${activeCount}, Idle conn count = ${idleCount}.`
              )
            )
          }
        }, this._acquisitionTimeout)

        request = new PendingRequest(key, resolve, reject, timeoutId, this._log)
        allRequests[key].push(request)
      })
    })
  }

  /**
   * Destroy all idle resources for the given address.
   * @param {ServerAddress} address the address of the server to purge its pool.
   * @returns {Promise<void>} A promise that is resolved when the resources are purged
   */
  purge (address) {
    return this._purgeKey(address.asKey())
  }

  /**
   * Destroy all idle resources in this pool.
   * @returns {Promise<void>} A promise that is resolved when the resources are purged
   */
  async close () {
    this._closed = true
    /**
     * The lack of Promise consuming was making the driver do not close properly in the scenario
     * captured at result.test.js:it('should handle missing onCompleted'). The test was timing out
     * because while wainting for the driver close.
     *
     * Consuming the Promise.all or by calling then or by awaiting in the result inside this method solved
     * the issue somehow.
     *
     * PS: the return of this method was already awaited at PooledConnectionProvider.close, but the await bellow
     * seems to be need also.
     */
    return await Promise.all(
      Object.keys(this._pools).map(key => this._purgeKey(key))
    )
  }

  /**
   * Keep the idle resources for the provided addresses and purge the rest.
   * @returns {Promise<void>} A promise that is resolved when the other resources are purged
   */
  keepAll (addresses) {
    const keysToKeep = addresses.map(a => a.asKey())
    const keysPresent = Object.keys(this._pools)
    const keysToPurge = keysPresent.filter(k => keysToKeep.indexOf(k) === -1)

    return Promise.all(keysToPurge.map(key => this._purgeKey(key)))
  }

  /**
   * Check if this pool contains resources for the given address.
   * @param {ServerAddress} address the address of the server to check.
   * @return {boolean} `true` when pool contains entries for the given key, <code>false</code> otherwise.
   */
  has (address) {
    return address.asKey() in this._pools
  }

  /**
   * Get count of active (checked out of the pool) resources for the given key.
   * @param {ServerAddress} address the address of the server to check.
   * @return {number} count of resources acquired by clients.
   */
  activeResourceCount (address) {
    return this._activeResourceCounts[address.asKey()] || 0
  }

  async _acquire (address) {
    if (this._closed) {
      throw newError('Pool is closed, it is no more able to serve requests.')
    }

    const key = address.asKey()
    let pool = this._pools[key]
    let poolState = this._poolState[key]
    if (!pool) {
      pool = []
      poolState = new PoolState()
      this._pools[key] = pool
      this._pendingCreates[key] = 0
      this._poolState[key] = poolState
    }
    while (pool.length) {
      const resource = pool.pop()

      if (this._validate(resource)) {
        if (this._removeIdleObserver) {
          this._removeIdleObserver(resource)
        }

        // idle resource is valid and can be acquired
        resourceAcquired(key, this._activeResourceCounts)
        if (this._log.isDebugEnabled()) {
          this._log.debug(`${resource} acquired from the pool ${key}`)
        }
        return resource
      } else {
        await this._destroy(resource)
      }
    }

    // Ensure requested max pool size
    if (this._maxSize > 0) {
      // Include pending creates when checking pool size since these probably will add
      // to the number when fulfilled.
      const numConnections =
        this.activeResourceCount(address) + this._pendingCreates[key]
      if (numConnections >= this._maxSize) {
        // Will put this request in queue instead since the pool is full
        return null
      }
    }

    // there exist no idle valid resources, create a new one for acquisition
    // Keep track of how many pending creates there are to avoid making too many connections.
    this._pendingCreates[key] = this._pendingCreates[key] + 1
    let resource
    try {
      // Invoke callback that creates actual connection
      resource = await this._create(address, (address, resource) => this._release(poolState, address, resource))

      resourceAcquired(key, this._activeResourceCounts)
      if (this._log.isDebugEnabled()) {
        this._log.debug(`${resource} created for the pool ${key}`)
      }
    } finally {
      this._pendingCreates[key] = this._pendingCreates[key] - 1
    }
    return resource
  }

  async _release (poolState, address, resource) {
    const key = address.asKey()
    const pool = this._pools[key]

    if (pool && poolState && poolState.isActive()) {
      // there exist idle connections for the given key
      if (!this._validate(resource)) {
        if (this._log.isDebugEnabled()) {
          this._log.debug(
            `${resource} destroyed and can't be released to the pool ${key} because it is not functional`
          )
        }
        await this._destroy(resource)
      } else {
        if (this._installIdleObserver) {
          this._installIdleObserver(resource, {
            onError: error => {
              this._log.debug(
                `Idle connection ${resource} destroyed because of error: ${error}`
              )
              const pool = this._pools[key]
              if (pool) {
                this._pools[key] = pool.filter(r => r !== resource)
              }
              // let's not care about background clean-ups due to errors but just trigger the destroy
              // process for the resource, we especially catch any errors and ignore them to avoid
              // unhandled promise rejection warnings
              this._destroy(resource).catch(() => {})
            }
          })
        }
        pool.push(resource)
        if (this._log.isDebugEnabled()) {
          this._log.debug(`${resource} released to the pool ${key}`)
        }
      }
    } else {
      // key has been purged, don't put it back, just destroy the resource
      if (this._log.isDebugEnabled()) {
        this._log.debug(
          `${resource} destroyed and can't be released to the pool ${key} because pool has been purged`
        )
      }
      await this._destroy(resource)
    }
    resourceReleased(key, this._activeResourceCounts)

    this._processPendingAcquireRequests(address)
  }

  async _purgeKey (key) {
    const pool = this._pools[key] || []
    const poolState = this._poolState[key] || new PoolState()
    while (pool.length) {
      const resource = pool.pop()
      if (this._removeIdleObserver) {
        this._removeIdleObserver(resource)
      }
      await this._destroy(resource)
    }
    poolState.close()
    delete this._pools[key]
    delete this._poolState[key]
  }

  _processPendingAcquireRequests (address) {
    const key = address.asKey()
    const requests = this._acquireRequests[key]
    const poolState = this._poolState[key]
    if (requests) {
      const pendingRequest = requests.shift() // pop a pending acquire request

      if (pendingRequest) {
        this._acquire(address)
          .catch(error => {
            // failed to acquire/create a new connection to resolve the pending acquire request
            // propagate the error by failing the pending request
            pendingRequest.reject(error)
            return null
          })
          .then(resource => {
            if (resource) {
              // managed to acquire a valid resource from the pool

              if (pendingRequest.isCompleted()) {
                // request has been completed, most likely failed by a timeout
                // return the acquired resource back to the pool
                this._release(poolState, address, resource)
              } else {
                // request is still pending and can be resolved with the newly acquired resource
                pendingRequest.resolve(resource) // resolve the pending request with the acquired resource
              }
            }
          })
      } else {
        delete this._acquireRequests[key]
      }
    }
  }
}

/**
 * Increment active (checked out of the pool) resource counter.
 * @param {string} key the resource group identifier (server address for connections).
 * @param {Object.<string, number>} activeResourceCounts the object holding active counts per key.
 */
function resourceAcquired (key, activeResourceCounts) {
  const currentCount = activeResourceCounts[key] || 0
  activeResourceCounts[key] = currentCount + 1
}

/**
 * Decrement active (checked out of the pool) resource counter.
 * @param {string} key the resource group identifier (server address for connections).
 * @param {Object.<string, number>} activeResourceCounts the object holding active counts per key.
 */
function resourceReleased (key, activeResourceCounts) {
  const currentCount = activeResourceCounts[key] || 0
  const nextCount = currentCount - 1

  if (nextCount > 0) {
    activeResourceCounts[key] = nextCount
  } else {
    delete activeResourceCounts[key]
  }
}

class PendingRequest {
  constructor (key, resolve, reject, timeoutId, log) {
    this._key = key
    this._resolve = resolve
    this._reject = reject
    this._timeoutId = timeoutId
    this._log = log
    this._completed = false
  }

  isCompleted () {
    return this._completed
  }

  resolve (resource) {
    if (this._completed) {
      return
    }
    this._completed = true

    clearTimeout(this._timeoutId)
    if (this._log.isDebugEnabled()) {
      this._log.debug(`${resource} acquired from the pool ${this._key}`)
    }
    this._resolve(resource)
  }

  reject (error) {
    if (this._completed) {
      return
    }
    this._completed = true

    clearTimeout(this._timeoutId)
    this._reject(error)
  }
}

class PoolState {
  constructor() {
    this._active = true;
  }

  isActive() {
    return this._active;
  }

  close() {
    this._active = false;
  }
}

export default Pool
