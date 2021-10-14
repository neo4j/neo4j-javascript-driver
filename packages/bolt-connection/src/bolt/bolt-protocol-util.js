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
import { newError } from 'neo4j-driver-core'
import { ResultStreamObserver } from './stream-observers'

/**
 * @param {TxConfig} txConfig the auto-commit transaction configuration.
 * @param {function(error: string)} onProtocolError called when the txConfig is not empty.
 * @param {ResultStreamObserver} observer the response observer.
 */
function assertTxConfigIsEmpty (txConfig, onProtocolError = () => {}, observer) {
  if (txConfig && !txConfig.isEmpty()) {
    const error = newError(
      'Driver is connected to the database that does not support transaction configuration. ' +
        'Please upgrade to neo4j 3.5.0 or later in order to use this functionality'
    )

    // unsupported API was used, consider this a fatal error for the current connection
    onProtocolError(error.message)
    observer.onError(error)
    throw error
  }
}

/**
 * Asserts that the passed-in database name is empty.
 * @param {string} database
 * @param {fuction(err: String)} onProtocolError Called when it doesn't have database set
 */
function assertDatabaseIsEmpty (database, onProtocolError = () => {}, observer) {
  if (database) {
    const error = newError(
      'Driver is connected to the database that does not support multiple databases. ' +
        'Please upgrade to neo4j 4.0.0 or later in order to use this functionality'
    )

    // unsupported API was used, consider this a fatal error for the current connection
    onProtocolError(error.message)
    observer.onError(error)
    throw error
  }
}

/**
 * Asserts that the passed-in impersonated user is empty
 * @param {string} impersonatedUser 
 * @param {function (err:Error)} onProtocolError Called when it does have impersonated user set
 * @param {any} observer
 */
function assertImpersonatedUserIsEmpty (impersonatedUser, onProtocolError = () => {}, observer) {
  if (impersonatedUser) {
    const error = newError(
      'Driver is connected to the database that does not support user impersonation. ' +
        'Please upgrade to neo4j 4.4.0 or later in order to use this functionality. ' +
        `Trying to impersonate ${impersonatedUser}.`
    )

    // unsupported API was used, consider this a fatal error for the current connection
    onProtocolError(error.message)
    observer.onError(error)
    throw error
  }
}

export { assertDatabaseIsEmpty, assertTxConfigIsEmpty, assertImpersonatedUserIsEmpty }
