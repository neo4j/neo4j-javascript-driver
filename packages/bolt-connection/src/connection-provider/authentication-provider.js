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

import { staticAuthTokenManager } from 'neo4j-driver-core'
import { object } from '../lang'

/**
 * Class which provides Authorization for {@link Connection}
 */
export default class AuthenticationProvider {
  constructor ({ authTokenManager, userAgent, boltAgent }) {
    this._authTokenManager = authTokenManager || staticAuthTokenManager({})
    this._userAgent = userAgent
    this._boltAgent = boltAgent
  }

  async authenticate ({ connection, auth, skipReAuth, waitReAuth, forceReAuth }) {
    if (auth != null) {
      const shouldReAuth = connection.authToken == null || (connection.supportsReAuth === true && (
        (!object.equals(connection.authToken, auth) && skipReAuth !== true) ||
        forceReAuth === true
      ))
      if (shouldReAuth) {
        return await connection.connect(this._userAgent, this._boltAgent, auth, waitReAuth || false)
      }
      return connection
    }

    const authToken = await this._authTokenManager.getToken()

    if (connection.authToken == null || !object.equals(authToken, connection.authToken)) {
      return await connection.connect(this._userAgent, this._boltAgent, authToken, false)
    }

    return connection
  }

  handleError ({ connection, code }) {
    if (
      connection &&
      code.startsWith('Neo.ClientError.Security.')
    ) {
      return this._authTokenManager.handleSecurityException(connection.authToken, code)
    }
    return false
  }
}
