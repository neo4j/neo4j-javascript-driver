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

import PoolConfig from './pool-config.ts'
import { newError } from '../../error.ts'
import { Logger } from '../logger.ts'
import { ServerAddress } from '../server-address.ts'

type Release<R extends unknown = unknown> = (address: ServerAddress, resource: R) => Promise<void>
type Create<R extends unknown = unknown> = (acquisitionContext: unknown, address: ServerAddress, release: Release<R>) => Promise<R>
type Destroy<R extends unknown = unknown> = (resource: R) => Promise<void>
type ValidateOnAcquire<R extends unknown = unknown> = (acquisitionContext: unknown, resource: R) => (Promise<boolean> | boolean)
type ValidateOnRelease<R extends unknown = unknown> = (resource: R) => (Promise<boolean> | boolean)
type InstallObserver<R extends unknown = unknown> = (resource: R, observer: unknown) => void
type RemoveObserver<R extends unknown = unknown> = (resource: R) => void
interface AcquisitionConfig { requireNew?: boolean }

interface ConstructorParam<R extends unknown = unknown> {
  create?: Create<R>
  destroy?: Destroy<R>
  validateOnAcquire?: ValidateOnAcquire<R>
  validateOnRelease?: ValidateOnRelease<R>
  installIdleObserver?: InstallObserver<R>
  removeIdleObserver?: RemoveObserver<R>
  config?: PoolConfig
  log?: Logger
}

class Pool<R extends unknown = unknown> {
  private readonly _create: Create<R>
  private readonly _destroy: Destroy<R>
  private readonly _validateOnAcquire: ValidateOnAcquire<R>
  private readonly _validateOnRelease: ValidateOnRelease<R>
  private readonly _installIdleObserver: InstallObserver<R>
  private readonly _removeIdleObserver: RemoveObserver<R>
  private readonly _maxSize: number
  private readonly _acquisitionTimeout: number
  private readonly _log: Logger
  private readonly _pools: { [key: string]: SingleAddressPool<R> }
  private readonly _pendingCreates: { [key: string]: number }
  private readonly _acquireRequests: { [key: string]: Array<PendingRequest<R>> }
  private readonly _activeResourceCounts: { [key: string]: number }
  private _closed: boolean

  /**
   * @param {function(acquisitionContext: object, address: ServerAddress, function(address: ServerAddress, resource: object): Promise<object>): Promise<object>} create
   *                an allocation function that creates a promise with a new resource. It's given an address for which to
   *                allocate the connection and a function that will return the resource to the pool if invoked, which is
   *                meant to be called on .dispose or .close or whatever mechanism the resource uses to finalize.
   * @param {function(acquisitionContext: object, resource: object): boolean} validateOnAcquire
   *                called at various times when an instance is acquired
   *                If this returns false, the resource will be evicted
   * @param {function(resource: object): boolean} validateOnRelease
   *                called at various times when an instance is released
   *                If this returns false, the resource will be evicted
   * @param {function(resource: object): Promise<void>} destroy
   *                called with the resource when it is evicted from this pool
   * @param {function(resource: object, observer: { onError }): void} installIdleObserver
   *                called when the resource is released back to pool
   * @param {function(resource: object): void} removeIdleObserver
   *                called when the resource is acquired from the pool
   * @param {PoolConfig} config configuration for the new driver.
   * @param {Logger} log the driver logger.
   */
  constructor ({
    create = async (acquisitionContext, address, release) => await Promise.reject(new Error('Not implemented')),
    destroy = async conn => await Promise.resolve(),
    validateOnAcquire = (acquisitionContext, conn) => true,
    validateOnRelease = (conn) => true,
    installIdleObserver = (conn, observer) => {},
    removeIdleObserver = conn => {},
    config = PoolConfig.defaultConfig(),
    log = Logger.noOp()
  }: ConstructorParam<R>) {
    this._create = create
    this._destroy = destroy
    this._validateOnAcquire = validateOnAcquire
    this._validateOnRelease = validateOnRelease
    this._installIdleObserver = installIdleObserver
    this._removeIdleObserver = removeIdleObserver
    this._maxSize = config.maxSize
    this._acquisitionTimeout = config.acquisitionTimeout
    this._pools = {}
    this._pendingCreates = {}
    this._acquireRequests = {}
    this._activeResourceCounts = {}
    this._release = this._release.bind(this)
    this._log = log
    this._closed = false
  }

  /**
   * Acquire and idle resource fom the pool or create a new one.
   * @param {object} acquisitionContext the acquisition context used for create and validateOnAcquire connection
   * @param {ServerAddress} address the address for which we're acquiring.
   * @param {object} config the config
   * @param {boolean} config.requireNew Indicate it requires a new resource
   * @return {Promise<Object>} resource that is ready to use.
   */
  async acquire (acquisitionContext: unknown, address: ServerAddress, config?: AcquisitionConfig): Promise<R> {
    const key = address.asKey()

    // We're out of resources and will try to acquire later on when an existing resource is released.
    const allRequests = this._acquireRequests
    const requests = allRequests[key]
    if (requests == null) {
      allRequests[key] = []
    }
    return await new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        // acquisition timeout fired

        // remove request from the queue of pending requests, if it's still there
        // request might've been taken out by the release operation
        const pendingRequests = allRequests[key]
        if (pendingRequests != null) {
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
      typeof timeoutId === 'object' && timeoutId.unref()

      const request = new PendingRequest<R>(key, acquisitionContext, config, resolve, reject, timeoutId, this._log)
      allRequests[key].push(request)
      this._processPendingAcquireRequests(address)
    })
  }

  /**
   * Destroy all idle resources for the given address.
   * @param {ServerAddress} address the address of the server to purge its pool.
   * @returns {Promise<void>} A promise that is resolved when the resources are purged
   */
  async purge (address: ServerAddress): Promise<void> {
    return await this._purgeKey(address.asKey())
  }

  apply (address: ServerAddress, resourceConsumer: (resource: R) => void): void {
    const key = address.asKey()

    if (key in this._pools) {
      this._pools[key].apply(resourceConsumer)
    }
  }

  /**
   * Destroy all idle resources in this pool.
   * @returns {Promise<void>} A promise that is resolved when the resources are purged
   */
  async close (): Promise<void> {
    this._closed = true
    /**
     * The lack of Promise consuming was making the driver do not close properly in the scenario
     * captured at result.test.js:it('should handle missing onCompleted'). The test was timing out
     * because while waiting for the driver close.
     *
     * Consuming the Promise.all or by calling then or by awaiting in the result inside this method solved
     * the issue somehow.
     *
     * PS: the return of this method was already awaited at PooledConnectionProvider.close, but the await bellow
     * seems to be need also.
     */
    return await Promise.all(
      Object.keys(this._pools).map(async key => await this._purgeKey(key))
    ).then()
  }

  /**
   * Keep the idle resources for the provided addresses and purge the rest.
   * @returns {Promise<void>} A promise that is resolved when the other resources are purged
   */
  async keepAll (addresses: ServerAddress[]): Promise<void> {
    const keysToKeep = addresses.map(a => a.asKey())
    const keysPresent = Object.keys(this._pools)
    const keysToPurge = keysPresent.filter(k => !keysToKeep.includes(k))

    return await Promise.all(keysToPurge.map(async key => await this._purgeKey(key))).then()
  }

  /**
   * Check if this pool contains resources for the given address.
   * @param {ServerAddress} address the address of the server to check.
   * @return {boolean} `true` when pool contains entries for the given key, <code>false</code> otherwise.
   */
  has (address: ServerAddress): boolean {
    return address.asKey() in this._pools
  }

  /**
   * Get count of active (checked out of the pool) resources for the given key.
   * @param {ServerAddress} address the address of the server to check.
   * @return {number} count of resources acquired by clients.
   */
  activeResourceCount (address: ServerAddress): number {
    return this._activeResourceCounts[address.asKey()] ?? 0
  }

  _getOrInitializePoolFor (key: string): SingleAddressPool<R> {
    let pool = this._pools[key]
    if (pool == null) {
      pool = new SingleAddressPool<R>()
      this._pools[key] = pool
      this._pendingCreates[key] = 0
    }
    return pool
  }

  async _acquire (acquisitionContext: unknown, address: ServerAddress, requireNew: boolean): Promise<{ resource: R | null, pool: SingleAddressPool<R> }> {
    if (this._closed) {
      throw newError('Pool is closed, it is no more able to serve requests.')
    }

    const key = address.asKey()
    const pool = this._getOrInitializePoolFor(key)
    if (!requireNew) {
      while (pool.length > 0) {
        const resource = pool.pop()

        if (resource == null) {
          continue
        }

        if (this._removeIdleObserver != null) {
          this._removeIdleObserver(resource)
        }

        if (await this._validateOnAcquire(acquisitionContext, resource)) {
          // idle resource is valid and can be acquired
          resourceAcquired(key, this._activeResourceCounts)
          if (this._log.isDebugEnabled()) {
            // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
            this._log.debug(`${resource} acquired from the pool ${key}`)
          }
          return { resource, pool }
        } else {
          pool.removeInUse(resource)
          await this._destroy(resource)
        }
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
        return { resource: null, pool }
      }
    }

    // there exist no idle valid resources, create a new one for acquisition
    // Keep track of how many pending creates there are to avoid making too many connections.
    this._pendingCreates[key] = this._pendingCreates[key] + 1
    let resource
    try {
      const numConnections = this.activeResourceCount(address) + pool.length
      if (numConnections >= this._maxSize && requireNew) {
        const resource = pool.pop()
        if (resource != null) {
          if (this._removeIdleObserver != null) {
            this._removeIdleObserver(resource)
          }
          pool.removeInUse(resource)
          await this._destroy(resource)
        }
      }

      // Invoke callback that creates actual connection
      resource = await this._create(acquisitionContext, address, async (address, resource) => await this._release(address, resource, pool))
      pool.pushInUse(resource)
      resourceAcquired(key, this._activeResourceCounts)
      if (this._log.isDebugEnabled()) {
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        this._log.debug(`${resource} created for the pool ${key}`)
      }
    } finally {
      this._pendingCreates[key] = this._pendingCreates[key] - 1
    }
    return { resource, pool }
  }

  async _release (address: ServerAddress, resource: R, pool: SingleAddressPool<R>): Promise<void> {
    const key = address.asKey()

    try {
      if (pool.isActive()) {
        // there exist idle connections for the given key
        if (!await this._validateOnRelease(resource)) {
          if (this._log.isDebugEnabled()) {
            this._log.debug(
              // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
              `${resource} destroyed and can't be released to the pool ${key} because it is not functional`
            )
          }
          pool.removeInUse(resource)
          await this._destroy(resource)
        } else {
          if (this._installIdleObserver != null) {
            this._installIdleObserver(resource, {
              onError: (error: Error) => {
                this._log.debug(
                  // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
                  `Idle connection ${resource} destroyed because of error: ${error}`
                )
                const pool = this._pools[key]
                if (pool != null) {
                  this._pools[key] = pool.filter(r => r !== resource)
                  pool.removeInUse(resource)
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
            // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
            this._log.debug(`${resource} released to the pool ${key}`)
          }
        }
      } else {
        // key has been purged, don't put it back, just destroy the resource
        if (this._log.isDebugEnabled()) {
          this._log.debug(
            // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
            `${resource} destroyed and can't be released to the pool ${key} because pool has been purged`
          )
        }
        pool.removeInUse(resource)
        await this._destroy(resource)
      }
    } finally {
      resourceReleased(key, this._activeResourceCounts)

      this._processPendingAcquireRequests(address)
    }
  }

  async _purgeKey (key: string): Promise<void> {
    const pool = this._pools[key]
    const destructionList = []
    if (pool != null) {
      while (pool.length > 0) {
        const resource = pool.pop()
        if (resource == null) {
          continue
        }

        if (this._removeIdleObserver != null) {
          this._removeIdleObserver(resource)
        }
        destructionList.push(this._destroy(resource))
      }
      pool.close()
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete this._pools[key]
      await Promise.all(destructionList)
    }
  }

  _processPendingAcquireRequests (address: ServerAddress): void {
    const key = address.asKey()
    const requests = this._acquireRequests[key]
    if (requests != null) {
      const pendingRequest = requests.shift() // pop a pending acquire request

      if (pendingRequest != null) {
        this._acquire(pendingRequest.context, address, pendingRequest.requireNew)
          .catch(error => {
            // failed to acquire/create a new connection to resolve the pending acquire request
            // propagate the error by failing the pending request
            pendingRequest.reject(error)
            return { resource: null, pool: null }
          })
          .then(({ resource, pool }) => {
            // there is not situation where the pool resource is not null and the
            // pool is null.
            if (resource != null && pool != null) {
              // managed to acquire a valid resource from the pool

              if (pendingRequest.isCompleted()) {
                // request has been completed, most likely failed by a timeout
                // return the acquired resource back to the pool
                this._release(address, resource, pool)
                  .catch(error => {
                    if (this._log.isDebugEnabled()) {
                      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
                      this._log.debug(`${resource} could not be release back to the pool. Cause: ${error}`)
                    }
                  })
              } else {
                // request is still pending and can be resolved with the newly acquired resource
                pendingRequest.resolve(resource) // resolve the pending request with the acquired resource
              }
            } else {
              // failed to acquire a valid resource from the pool
              // return the pending request back to the pool
              if (!pendingRequest.isCompleted()) {
                if (this._acquireRequests[key] == null) {
                  this._acquireRequests[key] = []
                }
                this._acquireRequests[key].unshift(pendingRequest)
              }
            }
          }).catch(error => pendingRequest.reject(error))
      } else {
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
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
function resourceAcquired (key: string, activeResourceCounts: { [key: string]: number }): void {
  const currentCount = activeResourceCounts[key] ?? 0
  activeResourceCounts[key] = currentCount + 1
}

/**
 * Decrement active (checked out of the pool) resource counter.
 * @param {string} key the resource group identifier (server address for connections).
 * @param {Object.<string, number>} activeResourceCounts the object holding active counts per key.
 */
function resourceReleased (key: string, activeResourceCounts: { [key: string]: number }): void {
  const currentCount = activeResourceCounts[key] ?? 0
  const nextCount = currentCount - 1

  if (nextCount > 0) {
    activeResourceCounts[key] = nextCount
  } else {
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete activeResourceCounts[key]
  }
}

class PendingRequest<R extends unknown = unknown> {
  private readonly _key: string
  private readonly _context: unknown
  private readonly _config: AcquisitionConfig
  private readonly _resolve: (resource: R) => void
  private readonly _reject: (error: Error) => void
  private readonly _timeoutId: any
  private readonly _log: Logger
  private _completed: boolean

  constructor (key: string, context: unknown, config: AcquisitionConfig | undefined, resolve: (resource: R) => void, reject: (error: Error) => void, timeoutId: any, log: Logger) {
    this._key = key
    this._context = context
    this._resolve = resolve
    this._reject = reject
    this._timeoutId = timeoutId
    this._log = log
    this._completed = false
    this._config = config ?? {}
  }

  get context (): unknown {
    return this._context
  }

  get requireNew (): boolean {
    return this._config.requireNew ?? false
  }

  isCompleted (): boolean {
    return this._completed
  }

  resolve (resource: R): void {
    if (this._completed) {
      return
    }
    this._completed = true

    clearTimeout(this._timeoutId)
    if (this._log.isDebugEnabled()) {
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      this._log.debug(`${resource} acquired from the pool ${this._key}`)
    }
    this._resolve(resource)
  }

  reject (error: Error): void {
    if (this._completed) {
      return
    }
    this._completed = true

    clearTimeout(this._timeoutId)
    this._reject(error)
  }
}

class SingleAddressPool<R extends unknown = unknown> {
  private _active: boolean
  private _elements: R[]
  private _elementsInUse: Set<R>

  constructor () {
    this._active = true
    this._elements = []
    this._elementsInUse = new Set()
  }

  isActive (): boolean {
    return this._active
  }

  close (): void {
    this._active = false
    this._elements = []
    this._elementsInUse = new Set()
  }

  filter (predicate: (resource: R) => boolean): SingleAddressPool<R> {
    this._elements = this._elements.filter(predicate)
    return this
  }

  apply (resourceConsumer: (resource: R) => void): void {
    this._elements.forEach(resourceConsumer)
    this._elementsInUse.forEach(resourceConsumer)
  }

  get length (): number {
    return this._elements.length
  }

  pop (): R | undefined {
    const element = this._elements.pop()
    if (element != null) {
      this._elementsInUse.add(element)
    }
    return element
  }

  push (element: R): number {
    this._elementsInUse.delete(element)
    return this._elements.push(element)
  }

  pushInUse (element: R): void {
    this._elementsInUse.add(element)
  }

  removeInUse (element: R): void {
    this._elementsInUse.delete(element)
  }
}

export default Pool
