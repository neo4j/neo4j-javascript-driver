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

import { Neo4jError, SERVICE_UNAVAILABLE, SESSION_EXPIRED } from '../error'

/**
 * Verified error and returns if it could be retried or not
 *
 * @param _error The error
 * @returns If the transaction could be retried.
 */
function canRetryOn (_error: any): boolean {
  return (
    _error &&
    _error instanceof Neo4jError &&
    _error.code &&
    (_error.code === SERVICE_UNAVAILABLE ||
      _error.code === SESSION_EXPIRED ||
      _isAuthorizationExpired(_error) ||
      _isTransientError(_error))
  )
}

function _isTransientError (error: Neo4jError): boolean {
  // Retries should not happen when transaction was explicitly terminated by the user.
  // Termination of transaction might result in two different error codes depending on where it was
  // terminated. These are really client errors but classification on the server is not entirely correct and
  // they are classified as transient.

  const code = error.code
  if (code.indexOf('TransientError') >= 0) {
    if (
      code === 'Neo.TransientError.Transaction.Terminated' ||
      code === 'Neo.TransientError.Transaction.LockClientStopped'
    ) {
      return false
    }
    return true
  }
  return false
}

function _isAuthorizationExpired (error: Neo4jError): boolean {
  return error.code === 'Neo.ClientError.Security.AuthorizationExpired'
}

export { canRetryOn }
