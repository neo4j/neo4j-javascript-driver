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

import { Driver } from './driver'
import { newError, SESSION_EXPIRED } from './error'
import { LoadBalancer } from './internal/connection-providers'
import LeastConnectedLoadBalancingStrategy from './internal/least-connected-load-balancing-strategy'
import ConnectionErrorHandler from './internal/connection-error-handler'
import ConfiguredHostNameResolver from './internal/resolver/configured-host-name-resolver'
import { HostNameResolver } from './internal/node'

/**
 * A driver that supports routing in a causal cluster.
 * @private
 */
class RoutingDriver extends Driver {
  constructor (hostPort, routingContext, userAgent, token = {}, config = {}) {
    super(hostPort, userAgent, token, validateConfig(config))
    this._routingContext = routingContext
  }

  _afterConstruction () {
    this._log.info(`Routing driver ${this._id} created for server address ${this._hostPort}`)
  }

  _createConnectionProvider (hostPort, connectionPool, driverOnErrorCallback) {
    const loadBalancingStrategy = RoutingDriver._createLoadBalancingStrategy(this._config, connectionPool)
    const resolver = createHostNameResolver(this._config)
    return new LoadBalancer(hostPort, this._routingContext, connectionPool, loadBalancingStrategy, resolver, driverOnErrorCallback, this._log)
  }

  _createConnectionErrorHandler () {
    // connection errors mean SERVICE_UNAVAILABLE for direct driver but for routing driver they should only
    // result in SESSION_EXPIRED because there might still exist other servers capable of serving the request
    return new ConnectionErrorHandler(SESSION_EXPIRED,
      (error, hostPort) => this._handleUnavailability(error, hostPort),
      (error, hostPort) => this._handleWriteFailure(error, hostPort))
  }

  _handleUnavailability (error, hostPort) {
    this._log.warn(`Routing driver ${this._id} will forget ${hostPort} because of an error ${error.code} '${error.message}'`)
    this._connectionProvider.forget(hostPort)
    return error
  }

  _handleWriteFailure (error, hostPort) {
    this._log.warn(`Routing driver ${this._id} will forget writer ${hostPort} because of an error ${error.code} '${error.message}'`)
    this._connectionProvider.forgetWriter(hostPort)
    return newError('No longer possible to write to server at ' + hostPort, SESSION_EXPIRED)
  }

  /**
   * Create new load balancing strategy based on the config.
   * @param {object} config the user provided config.
   * @param {Pool} connectionPool the connection pool for this driver.
   * @return {LoadBalancingStrategy} new strategy.
   * @private
   */
  static _createLoadBalancingStrategy (config, connectionPool) {
    return new LeastConnectedLoadBalancingStrategy(connectionPool)
  }
}

/**
 * @private
 * @returns {HostNameResolver} new resolver.
 */
function createHostNameResolver (config) {
  if (config.resolver) {
    return new ConfiguredHostNameResolver(config.resolver)
  }
  return new HostNameResolver()
}

/**
 * @private
 * @returns {object} the given config.
 */
function validateConfig (config) {
  const resolver = config.resolver
  if (resolver && typeof resolver !== 'function') {
    throw new TypeError(`Configured resolver should be a function. Got: ${resolver}`)
  }
  return config
}

export default RoutingDriver
