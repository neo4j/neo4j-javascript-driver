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

import auth from './auth'
import { AuthToken } from './types'
import { util } from './internal'

export type SecurityErrorCode = `Neo.ClientError.Security.${string}`

/**
 * Interface for the piece of software responsible for keeping track of current active {@link AuthToken} across the driver.
 * @interface
 * @since 5.8
 */
export default class AuthTokenManager {
  /**
   * Returns a valid token.
   *
   * **Warning**: This method must only ever return auth information belonging to the same identity.
   * Switching identities using the `AuthTokenManager` is undefined behavior.
   *
   * @returns {Promise<AuthToken>|AuthToken} The valid auth token or a promise for a valid auth token
   */
  getToken (): Promise<AuthToken> | AuthToken {
    throw new Error('Not Implemented')
  }

  /**
   * Handles an error notification emitted by the server if a security error happened.
   *
   * @param {AuthToken} token The expired token.
   * @param {`Neo.ClientError.Security.${string}`} securityErrorCode the security error code returned by the server
   * @return {boolean} whether the exception was handled by the manager, so the driver knows if it can be retried..
   */
  handleSecurityException (token: AuthToken, securityErrorCode: SecurityErrorCode): boolean {
    throw new Error('Not implemented')
  }
}

/**
 * Interface which defines an {@link AuthToken} with an expiration data time associated
 * @interface
 * @since 5.8
 */
export class AuthTokenAndExpiration {
  public readonly token: AuthToken
  public readonly expiration?: Date

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
     * in managers created with {@link authTokenManagers#bearer}.
     *
     * If this value is not defined, the {@link AuthToken} will be considered valid
     * until a `Neo.ClientError.Security.TokenExpired` error happens.
     *
     * @type {Date|undefined}
     */
    this.expiration = undefined
  }
}

/**
 * Defines the object which holds the common {@link AuthTokenManager} used in the Driver
 */
class AuthTokenManagers {
  /**
   * Creates a {@link AuthTokenManager} for handle {@link AuthToken} which is expires.
   *
   * **Warning**: `tokenProvider` must only ever return auth information belonging to the same identity.
   * Switching identities using the `AuthTokenManager` is undefined behavior.
   *
   * @param {object} param0 - The params
   * @param {function(): Promise<AuthTokenAndExpiration>} param0.tokenProvider - Retrieves a new valid auth token.
   * Must only ever return auth information belonging to the same identity.
   * @returns {AuthTokenManager} The temporal auth data manager.
   */
  bearer ({ tokenProvider }: { tokenProvider: () => Promise<AuthTokenAndExpiration> }): AuthTokenManager {
    if (typeof tokenProvider !== 'function') {
      throw new TypeError(`tokenProvider should be function, but got: ${typeof tokenProvider}`)
    }
    return new ExpirationBasedAuthTokenManager(tokenProvider, [
      'Neo.ClientError.Security.Unauthorized',
      'Neo.ClientError.Security.TokenExpired'
    ])
  }

  /**
   * Creates a {@link AuthTokenManager} for handle {@link AuthToken} and password rotation.
   *
   * **Warning**: `tokenProvider` must only ever return auth information belonging to the same identity.
   * Switching identities using the `AuthTokenManager` is undefined behavior.
   *
   * @param {object} param0 - The params
   * @param {function(): Promise<AuthToken>} param0.tokenProvider - Retrieves a new valid auth token.
   * Must only ever return auth information belonging to the same identity.
   * @returns {AuthTokenManager} The basic auth data manager.
   */
  basic ({ tokenProvider }: { tokenProvider: () => Promise<AuthToken> }): AuthTokenManager {
    if (typeof tokenProvider !== 'function') {
      throw new TypeError(`tokenProvider should be function, but got: ${typeof tokenProvider}`)
    }

    return new ExpirationBasedAuthTokenManager(async () => {
      return { token: await tokenProvider() }
    }, ['Neo.ClientError.Security.Unauthorized'])
  }
}

/**
 * Holds the common {@link AuthTokenManagers} used in the Driver.
 */
const authTokenManagers: AuthTokenManagers = new AuthTokenManagers()

Object.freeze(authTokenManagers)

export {
  authTokenManagers
}

export type {
  AuthTokenManagers
}

/**
 * Create a {@link AuthTokenManager} for handle static {@link AuthToken}
 *
 * @private
 * @param {param} args - The args
 * @param {AuthToken} args.authToken - The static auth token which will always used in the driver.
 * @returns {AuthTokenManager} The temporal auth data manager.
 */
export function staticAuthTokenManager ({ authToken }: { authToken: AuthToken }): AuthTokenManager {
  return new StaticAuthTokenManager(authToken)
}

interface TokenRefreshObserver {
  onCompleted: (data: AuthTokenAndExpiration) => void
  onError: (error: Error) => void
}

class TokenRefreshObservable implements TokenRefreshObserver {
  constructor (private readonly _subscribers: TokenRefreshObserver[] = []) {

  }

  subscribe (sub: TokenRefreshObserver): void {
    this._subscribers.push(sub)
  }

  onCompleted (data: AuthTokenAndExpiration): void {
    this._subscribers.forEach(sub => sub.onCompleted(data))
  }

  onError (error: Error): void {
    this._subscribers.forEach(sub => sub.onError(error))
  }
}

class ExpirationBasedAuthTokenManager implements AuthTokenManager {
  constructor (
    private readonly _tokenProvider: () => Promise<AuthTokenAndExpiration>,
    private readonly _handledSecurityCodes: SecurityErrorCode[],
    private _currentAuthData?: AuthTokenAndExpiration,
    private _refreshObservable?: TokenRefreshObservable) {

  }

  async getToken (): Promise<AuthToken> {
    if (this._currentAuthData === undefined ||
        (
          this._currentAuthData.expiration !== undefined &&
          this._currentAuthData.expiration < new Date()
        )) {
      await this._refreshAuthToken()
    }

    return this._currentAuthData?.token as AuthToken
  }

  handleSecurityException (token: AuthToken, securityErrorCode: SecurityErrorCode): boolean {
    if (this._handledSecurityCodes.includes(securityErrorCode)) {
      if (util.equals(token, this._currentAuthData?.token)) {
        this._scheduleRefreshAuthToken()
      }
      return true
    }
    return false
  }

  private _scheduleRefreshAuthToken (observer?: TokenRefreshObserver): void {
    if (this._refreshObservable === undefined) {
      this._currentAuthData = undefined
      this._refreshObservable = new TokenRefreshObservable()

      Promise.resolve(this._tokenProvider())
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

  private async _refreshAuthToken (): Promise<AuthTokenAndExpiration> {
    return await new Promise<AuthTokenAndExpiration>((resolve, reject) => {
      this._scheduleRefreshAuthToken({
        onCompleted: resolve,
        onError: reject
      })
    })
  }
}

class StaticAuthTokenManager implements AuthTokenManager {
  constructor (
    private readonly _authToken: AuthToken
  ) {

  }

  getToken (): AuthToken {
    return this._authToken
  }

  handleSecurityException (_: AuthToken, __: SecurityErrorCode): boolean {
    return false
  }
}
