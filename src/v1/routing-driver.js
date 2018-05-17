/**
 * Copyright (c) 2002-2018 "Neo4j,"
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

import Session from './session';
import {Driver} from './driver';
import {newError, SESSION_EXPIRED} from './error';
import {LoadBalancer} from './internal/connection-providers';
import LeastConnectedLoadBalancingStrategy, {LEAST_CONNECTED_STRATEGY_NAME} from './internal/least-connected-load-balancing-strategy';
import RoundRobinLoadBalancingStrategy, {ROUND_ROBIN_STRATEGY_NAME} from './internal/round-robin-load-balancing-strategy';

/**
 * A driver that supports routing in a causal cluster.
 * @private
 */
class RoutingDriver extends Driver {

  constructor(hostPort, routingContext, userAgent, token = {}, config = {}) {
    super(hostPort, userAgent, token, validateConfig(config));
    this._routingContext = routingContext;
  }

  _createConnectionProvider(hostPort, connectionPool, driverOnErrorCallback) {
    const loadBalancingStrategy = RoutingDriver._createLoadBalancingStrategy(this._config, connectionPool);
    return new LoadBalancer(hostPort, this._routingContext, connectionPool, loadBalancingStrategy, driverOnErrorCallback);
  }

  _createSession(mode, connectionProvider, bookmark, config) {
    return new RoutingSession(mode, connectionProvider, bookmark, config, (error, conn) => {
      if (!conn) {
        // connection can be undefined if error happened before connection was acquired
        return error;
      }

      const hostPort = conn.hostPort;

      if (error.code === SESSION_EXPIRED || isDatabaseUnavailable(error)) {
        this._connectionProvider.forget(hostPort);
        return error;
      } else if (isFailureToWrite(error)) {
        this._connectionProvider.forgetWriter(hostPort);
        return newError('No longer possible to write to server at ' + hostPort, SESSION_EXPIRED);
      } else {
        return error;
      }
    });
  }

  _connectionErrorCode() {
    // connection errors mean SERVICE_UNAVAILABLE for direct driver but for routing driver they should only
    // result in SESSION_EXPIRED because there might still exist other servers capable of serving the request
    return SESSION_EXPIRED;
  }

  /**
   * Create new load balancing strategy based on the config.
   * @param {object} config the user provided config.
   * @param {Pool} connectionPool the connection pool for this driver.
   * @return {LoadBalancingStrategy} new strategy.
   * @private
   */
  static _createLoadBalancingStrategy(config, connectionPool) {
    const configuredValue = config.loadBalancingStrategy;
    if (!configuredValue || configuredValue === LEAST_CONNECTED_STRATEGY_NAME) {
      return new LeastConnectedLoadBalancingStrategy(connectionPool);
    } else if (configuredValue === ROUND_ROBIN_STRATEGY_NAME) {
      return new RoundRobinLoadBalancingStrategy();
    } else {
      throw newError('Unknown load balancing strategy: ' + configuredValue);
    }
  }
}

/**
 * @private
 */
function validateConfig(config) {
  if (config.trust === 'TRUST_ON_FIRST_USE') {
    throw newError('The chosen trust mode is not compatible with a routing driver');
  }
  return config;
}

/**
 * @private
 */
function isFailureToWrite(error) {
  return error.code === 'Neo.ClientError.Cluster.NotALeader' ||
    error.code === 'Neo.ClientError.General.ForbiddenOnReadOnlyDatabase';
}

/**
 * @private
 */
function isDatabaseUnavailable(error) {
  return error.code === 'Neo.TransientError.General.DatabaseUnavailable';
}

/**
 * @private
 */
class RoutingSession extends Session {
  constructor(mode, connectionProvider, bookmark, config, onFailedConnection) {
    super(mode, connectionProvider, bookmark, config);
    this._onFailedConnection = onFailedConnection;
  }

  _onRunFailure() {
    return this._onFailedConnection;
  }
}

export default RoutingDriver
