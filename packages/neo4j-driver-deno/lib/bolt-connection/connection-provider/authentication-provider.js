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

import { object } from '../lang/index.js'

/**
 * Class which provides Authorization for {@link Connection}
 */
export default class AuthenticationProvider {
  constructor ({ authTokenProvider, userAgent }) {
    this._getAuthToken = authTokenProvider || (() => ({}))
    this._renewableAuthToken = undefined
    this._userAgent = userAgent
    this._refreshObserver = undefined
  }

  async authenticate ({ connection, auth }) {
    if (auth != null) {
      if (connection.authToken == null || (connection.supportsReAuth && !object.equals(connection.authToken, auth))) {
        return await connection.connect(this._userAgent, auth)
      }
      return connection
    }

    if (!this._authToken || this._isTokenExpired) {
      await this._getFreshAuthToken()
    }

    if (this._renewableAuthToken.authToken !== connection.authToken) {
      return await connection.connect(this._userAgent, this._authToken)
    }

    return connection
  }

  async handleError ({ connection, code }) {
    if ( 
      connection.authToken === this._authToken &&  
      [
        'Neo.ClientError.Security.Unauthorized',
        'Neo.ClientError.Security.TokenExpired'
      ].includes(code)
    ) {
      this._scheduleRefresh()
    }
  }

  get _authToken () {
    if (this._renewableAuthToken) {
      return this._renewableAuthToken.authToken
    }
    return undefined
  }

  get _isTokenExpired () {
    return !this._renewableAuthToken ||
      (this._renewableAuthToken.expectedExpirationTime &&
      this._renewableAuthToken.expectedExpirationTime < new Date())
  }

  async _getFreshAuthToken () {
    if (this._isTokenExpired) {
      const promise = new Promise((resolve, reject) => {
        this._scheduleRefresh({
          onSuccess: resolve,
          onError: reject
        })
      })
      await promise
    }

    return this._authToken
  }

  _scheduleRefresh (observer) {
    // there is no refresh schedule
    if (!this._refreshObserver) {
      const subscribers = []

      this._refreshObserver = {
        subscribe: (sub) => subscribers.push(sub),
        notify: () => subscribers.forEach(sub => sub.onSuccess()),
        notifyError: (e) => subscribers.forEach(sub => sub.onError(e))
      }

      Promise.resolve(this._getAuthToken())
        .then(token => {
          this._renewableAuthToken = token
          this._refreshObserver.notify()
          return token
        })
        .catch(e => {
          this._refreshObserver.notifyError(e)
        })
        .finally(() => {
          this._refreshObserver = undefined
        })
    }

    if (observer) {
      this._refreshObserver.subscribe(observer)
    }
  }
}
