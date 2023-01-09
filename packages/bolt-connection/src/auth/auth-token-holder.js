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

export class AuthTokenHolder {
  constructor ({ authTokenProvider }) {
    this._getAuthToken = authTokenProvider
    this._renewableAuthToken = undefined
    this._refreshObserver = undefined
  }

  get () {
    if (this._renewableAuthToken) {
      return this._renewableAuthToken.authToken
    }
    return undefined
  }

  isTokenExpired () {
    return !this._renewableAuthToken ||
      (this._renewableAuthToken.expectedExpirationTime &&
      this._renewableAuthToken.expectedExpirationTime < new Date())
  }

  async getFresh () {
    if (this.isTokenExpired()) {
      const promiseState = {}
      const promise = new Promise((resolve, reject) => {
        promiseState.resolve = resolve
        promiseState.reject = reject
      })

      this.scheduleRefresh({
        onSuccess: promiseState.resolve,
        onError: promiseState.onError
      })

      await promise
    }

    return this.get()
  }

  scheduleRefresh (observer) {
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
