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

import auth from './auth.ts'
import { AuthToken } from './types.ts'
import { util } from './internal/index.ts'

/**
 * Interface for the piece of software responsible for keeping track of current active {@link AuthToken} across the driver.
 * @interface
 * @since 5.6
 */
export default class AuthTokenManager {
  /**
   * Returns a valid token
   *
   * @returns {Promise<AuthToken>|AuthToken} The valid auth token or a promise for a valid auth token
   */
  getToken (): Promise<AuthToken> | AuthToken {
    throw new Error('Not Implemented')
  }

  onTokenExpired (token: AuthToken): void {
    throw new Error('Not implemented')
  }
}

/**
 * Interface which defines an {@link AuthToken} with an expiry data time associated
 * @interface
 * @since 5.6
 */
export class TemporalAuthData {
  public readonly token: AuthToken
  public readonly expiry?: Date

  private constructor () {
    /**
     * The {@link AuthToken} used for authenticate connections.
     *
     * @type {AuthToken}
     * @see {auth}
     */
    this.token = auth.none() as AuthToken

    /**
     * The expected expiration date of the auth token.
     *
     * This information will be used for triggering the auth token refresh
     * in managers created with {@link temporalAuthDataManager}.
     *
     * If this value is not defined, the {@link AuthToken} will be considered valid
     * until a `Neo.ClientError.Security.TokenExpired` error happens.
     *
     * @type {Date|undefined}
     */
    this.expiry = undefined
  }
}

/**
 * Creates a {@link AuthTokenManager} for handle {@link AuthToken} which is expires.
 *
 * @param {object} param0 - The params
 * @param {function(): Promise<TemporalAuthData>} param0.getAuthData - Retrieves a new valid auth token
 * @returns {AuthTokenManager} The temporal auth data manager.
 */
export function temporalAuthDataManager ({ getAuthData }: { getAuthData: () => Promise<TemporalAuthData> }): AuthTokenManager {
  if (typeof getAuthData !== 'function') {
    throw new TypeError(`getAuthData should be function, but got: ${typeof getAuthData}`)
  }
  return new TemporalAuthDataManager(getAuthData)
}

interface TokenRefreshObserver {
  onCompleted: (data: TemporalAuthData) => void
  onError: (error: Error) => void
}

class TokenRefreshObservable implements TokenRefreshObserver {
  constructor (private readonly _subscribers: TokenRefreshObserver[] = []) {

  }

  subscribe (sub: TokenRefreshObserver): void {
    this._subscribers.push(sub)
  }

  onCompleted (data: TemporalAuthData): void {
    this._subscribers.forEach(sub => sub.onCompleted(data))
  }

  onError (error: Error): void {
    this._subscribers.forEach(sub => sub.onError(error))
  }
}

class TemporalAuthDataManager implements AuthTokenManager {
  constructor (
    private readonly _getAuthData: () => Promise<TemporalAuthData>,
    private _currentAuthData?: TemporalAuthData,
    private _refreshObservable?: TokenRefreshObservable) {

  }

  async getToken (): Promise<AuthToken> {
    if (this._currentAuthData === undefined ||
        (
          this._currentAuthData.expiry !== undefined &&
          this._currentAuthData.expiry < new Date()
        )) {
      await this._refreshAuthToken()
    }

    return this._currentAuthData?.token as AuthToken
  }

  onTokenExpired (token: AuthToken): void {
    if (util.equals(token, this._currentAuthData?.token)) {
      this._scheduleRefreshAuthToken()
    }
  }

  private _scheduleRefreshAuthToken (observer?: TokenRefreshObserver): void {
    if (this._refreshObservable === undefined) {
      this._currentAuthData = undefined
      this._refreshObservable = new TokenRefreshObservable()

      Promise.resolve(this._getAuthData())
        .then(data => {
          this._currentAuthData = data
          this._refreshObservable?.onCompleted(data)
        })
        .catch(error => {
          this._refreshObservable?.onError(error)
        })
        .finally(() => {
          this._refreshObservable = undefined
        })
    }

    if (observer !== undefined) {
      this._refreshObservable.subscribe(observer)
    }
  }

  private async _refreshAuthToken (): Promise<TemporalAuthData> {
    return await new Promise<TemporalAuthData>((resolve, reject) => {
      this._scheduleRefreshAuthToken({
        onCompleted: resolve,
        onError: reject
      })
    })
  }
}
