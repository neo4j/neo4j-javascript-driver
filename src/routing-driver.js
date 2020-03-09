/**
 * Copyright (c) 2002-2020 "Neo4j,"
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

  _createConnectionProvider (address, userAgent, authToken) {
    return new RoutingConnectionProvider({
      id: this._id,
      address: address,
      routingContext: this._routingContext,
      hostNameResolver: createHostNameResolver(this._config),
      config: this._config,
      log: this._log,
      userAgent: userAgent,
      authToken: authToken
    })
  }

  _supportsRouting () {
    return true
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
 * @returns {Object} the given config.
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
