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
import RoutingConnectionProvider from './internal/connection-provider-routing'
import LeastConnectedLoadBalancingStrategy from './internal/least-connected-load-balancing-strategy'
import ConnectionErrorHandler from './internal/connection-error-handler'
import ConfiguredCustomResolver from './internal/resolver/configured-custom-resolver'

/**
 * A driver that supports routing in a causal cluster.
 * @private
 */
class RoutingDriver extends Driver {
  constructor (address, routingContext, userAgent, token = {}, config = {}) {
    super(address, userAgent, token, validateConfig(config))
    this._routingContext = routingContext
  }

  _afterConstruction () {
    this._log.info(
      `Routing driver ${this._id} created for server address ${this._address}`
    )
  }

  _createConnectionProvider (address, connectionPool, driverOnErrorCallback) {
    const loadBalancingStrategy = RoutingDriver._createLoadBalancingStrategy(
      this._config,
      connectionPool
    )
    const resolver = createHostNameResolver(this._config)
    return new RoutingConnectionProvider(
      address,
      this._routingContext,
      connectionPool,
      loadBalancingStrategy,
      resolver,
      driverOnErrorCallback,
      this._log
    )
  }

  _createConnectionErrorHandler () {
    // connection errors mean SERVICE_UNAVAILABLE for direct driver but for routing driver they should only
    // result in SESSION_EXPIRED because there might still exist other servers capable of serving the request
    return new ConnectionErrorHandler(
      SESSION_EXPIRED,
      (error, address) => this._handleUnavailability(error, address),
      (error, address) => this._handleWriteFailure(error, address)
    )
  }

  _handleUnavailability (error, address) {
    this._log.warn(
      `Routing driver ${this._id} will forget ${address} because of an error ${
        error.code
      } '${error.message}'`
    )
    this._connectionProvider.forget(address)
    return error
  }

  _handleWriteFailure (error, address) {
    this._log.warn(
      `Routing driver ${
        this._id
      } will forget writer ${address} because of an error ${error.code} '${
        error.message
      }'`
    )
    this._connectionProvider.forgetWriter(address)
    return newError(
      'No longer possible to write to server at ' + address,
      SESSION_EXPIRED
    )
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
 * @returns {ConfiguredCustomResolver} new custom resolver that wraps the passed-in resolver function.
 *              If resolved function is not specified, it defaults to an identity resolver.
 */
function createHostNameResolver (config) {
  return new ConfiguredCustomResolver(config.resolver)
}

/**
 * @private
 * @returns {object} the given config.
 */
function validateConfig (config) {
  const resolver = config.resolver
  if (resolver && typeof resolver !== 'function') {
    throw new TypeError(
      `Configured resolver should be a function. Got: ${resolver}`
    )
  }
  return config
}

export default RoutingDriver
