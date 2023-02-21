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

import { temporalAuthDataManager } from '../../core/index.ts'
import { object } from '../lang/index.js'

/**
 * Class which provides Authorization for {@link Connection}
 */
export default class AuthenticationProvider {
  constructor ({ authTokenManager, userAgent }) {
    this._authTokenManager = authTokenManager || temporalAuthDataManager({
      getAuthData: () => {}
    })
    this._userAgent = userAgent
  }

  async authenticate ({ connection, auth }) {
    if (auth != null) {
      if (connection.authToken == null || (connection.supportsReAuth && !object.equals(connection.authToken, auth))) {
        return await connection.connect(this._userAgent, auth)
      }
      return connection
    }

    const authToken = await this._authTokenManager.getToken()

    if (!object.equals(authToken, connection.authToken)) {
      return await connection.connect(this._userAgent, authToken)
    }

    return connection
  }

  handleError ({ connection, code }) {
    if (
      connection &&
      [
        'Neo.ClientError.Security.Unauthorized',
        'Neo.ClientError.Security.TokenExpired'
      ].includes(code)
    ) {
      this._authTokenManager.onTokenExpired(connection.authToken)
    }
  }
}
