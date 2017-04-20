/**
 * Copyright (c) 2002-2017 "Neo Technology,","
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

import Session from './session';
import {Driver} from './driver';
import {newError, SESSION_EXPIRED} from './error';
import {LoadBalancer} from './internal/connection-providers';

/**
 * A driver that supports routing in a core-edge cluster.
 */
class RoutingDriver extends Driver {

  constructor(url, routingContext, userAgent, token = {}, config = {}) {
    super(url, userAgent, token, RoutingDriver._validateConfig(config));
    this._routingContext = routingContext;
  }

  _createConnectionProvider(address, connectionPool, driverOnErrorCallback) {
    return new LoadBalancer(address, this._routingContext, connectionPool, driverOnErrorCallback);
  }

  _createSession(mode, connectionProvider, bookmark, config) {
    return new RoutingSession(mode, connectionProvider, bookmark, config, (error, conn) => {
      if (error.code === SESSION_EXPIRED) {
        this._forgetConnection(conn);
        return error;
      } else if (RoutingDriver._isFailureToWrite(error)) {
        let url = 'UNKNOWN';
        // connection is undefined if error happened before connection was acquired
        if (conn) {
          url = conn.url;
          this._connectionProvider.forgetWriter(conn.url);
        }
        return newError('No longer possible to write to server at ' + url, SESSION_EXPIRED);
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

  _forgetConnection(connection) {
    // connection is undefined if error happened before connection was acquired
    if (connection) {
      this._connectionProvider.forget(connection.url);
    }
  }

  static _validateConfig(config) {
    if(config.trust === 'TRUST_ON_FIRST_USE') {
      throw newError('The chosen trust mode is not compatible with a routing driver');
    }
    return config;
  }

  static _isFailureToWrite(error) {
    return error.code === 'Neo.ClientError.Cluster.NotALeader' ||
      error.code === 'Neo.ClientError.General.ForbiddenOnReadOnlyDatabase';
  }
}

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
