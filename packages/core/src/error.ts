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

// A common place for constructing error objects, to keep them
// uniform across the driver surface.

/**
 * Error code representing complete loss of service. Used by {@link Neo4jError#code}.
 * @type {string}
 */
const SERVICE_UNAVAILABLE: string = 'ServiceUnavailable'

/**
 * Error code representing transient loss of service. Used by {@link Neo4jError#code}.
 * @type {string}
 */
const SESSION_EXPIRED: string = 'SessionExpired'

/**
 * Error code representing serialization/deserialization issue in the Bolt protocol. Used by {@link Neo4jError#code}.
 * @type {string}
 */
const PROTOCOL_ERROR: string = 'ProtocolError'

/**
 * Error code representing an no classified error. Used by {@link Neo4jError#code}.
 * @type {string}
 */
const NOT_AVAILABLE: 'N/A' = 'N/A'

/**
 * Possible error codes in the {@link Neo4jError}
 */
type Neo4jErrorCode =
  | typeof SERVICE_UNAVAILABLE
  | typeof SESSION_EXPIRED
  | typeof PROTOCOL_ERROR
  | typeof NOT_AVAILABLE

/**
 * The Neo4j Error category
 * @typedef {
 *  'ClientError' | 
 *  'TransientError' | 
 *  'N/A' |
 *  'AuthorizationExpiredError' |
 *  'ServiceUnavailableError' |
 *  'SessionExpiredError' |
 *  'ResultConsumedError' | 
 *  'SecurityError' |
 *  'IllegalArgumentError' |
 *  'ProtocolError' |
 *  'FatalDiscoveryError' |
 *  'TokenExpiredError'} Neo4jErrorCategory
 */
type Neo4jErrorCategory = 
  'AuthorizationExpiredError' |
  'ClientError' |
  'FatalDiscoveryError' |
  'IllegalArgumentError' |
  'N/A' |
  'ProtocolError' |
  'ResultConsumedError' |
  'SecurityError' |
  'ServiceUnavailableError' |
  'SessionExpiredError' |
  'TokenExpiredError' |
  'TransientError' 

/// TODO: Remove definitions of this.constructor and this.__proto__
/**
 * Class for all errors thrown/returned by the driver.
 */
class Neo4jError extends Error {
  /**
   * Optional error code. Will be populated when error originates in the database.
   */
  code: Neo4jErrorCode
  retriable: boolean
  category: Neo4jErrorCategory
  __proto__: Neo4jError

  /**
   * @constructor
   * @param {string} message - the error message
   * @param {string} code - Optional error code. Will be populated when error originates in the database.
   * @param {string|undefined} category - Optional error category. Will be populated when error originates in the database.
   */
  constructor (message: string, code: Neo4jErrorCode, category?: Neo4jErrorCategory) {
    super(message)
    this.constructor = Neo4jError
    // eslint-disable-next-line no-proto
    this.__proto__ = Neo4jError.prototype
    this.code = code
    this.name = 'Neo4jError'
    /**
     * Indicates if the error is retriable.
     * @type {boolean} - true if the error is retriable
     */
    this.retriable = _isRetriableCode(code)
    /**
     * Indicates if the category of the error occurred.
     * @type {Neo4jErrorCategory} - the category of the error
     */
    this.category = category || _categorizeErrorCode(code)
  }

  /**
   * Verifies if the given error is retriable.
   *
   * @param {object|undefined|null} error the error object
   * @returns {boolean} true if the error is retriable
   */
  static isRetriable(error?: any | null): boolean {
    return error !== null &&
      error !== undefined &&
      error instanceof Neo4jError &&
      error.retriable
  }
}

/**
 * Create a new error from a message and error code
 * @param message the error message
 * @param code the error code
 * @param category the error category
 * @return {Neo4jError} an {@link Neo4jError}
 * @private
 */
function newError (message: string, code?: Neo4jErrorCode, category?: Neo4jErrorCategory): Neo4jError {
  return new Neo4jError(message, code || NOT_AVAILABLE, category)
}

function newIllegalArgumentError (message: string, code?: Neo4jErrorCode): Neo4jError {
  return newError(message, code, 'IllegalArgumentError' )
}

function newResultConsumedError (message: string, code?: Neo4jErrorCode): Neo4jError {
  return newError(message, code, 'ResultConsumedError')
}

function newFatalDiscoveryError (message: string, code?: Neo4jErrorCode): Neo4jError {
  return newError(message, code, 'FatalDiscoveryError')
}

/**
 * Verifies if the given error is retriable.
 *
 * @public
 * @param {object|undefined|null} error the error object
 * @returns {boolean} true if the error is retriable
 */
 const isRetriableError = Neo4jError.isRetriable

/**
 * @private
 * @param {string} code the error code
 * @returns {boolean} true if the error is a retriable error
 */
function _isRetriableCode (code?: Neo4jErrorCode): boolean {
  return code === SERVICE_UNAVAILABLE ||
    code === SESSION_EXPIRED ||
    _isAuthorizationExpired(code) ||
    _isRetriableTransientError(code)
}

/**
 * @private
 * @param {string} code the error to check
 * @return {boolean} true if the error is a transient error
 */
function _isRetriableTransientError (code?: Neo4jErrorCode): boolean {
  // Retries should not happen when transaction was explicitly terminated by the user.
  // Termination of transaction might result in two different error codes depending on where it was
  // terminated. These are really client errors but classification on the server is not entirely correct and
  // they are classified as transient.

  if (code !== undefined && code.indexOf('TransientError') >= 0) {
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

function _categorizeErrorCode (code?: Neo4jErrorCode): Neo4jErrorCategory {
  if (code === undefined) {
    return NOT_AVAILABLE 
  } else if (code === 'Neo.ClientError.Security.AuthorizationExpired') {
    return 'AuthorizationExpiredError'
  } else if (code === SERVICE_UNAVAILABLE) {
    return 'ServiceUnavailableError'
  } else if (code === PROTOCOL_ERROR) {
    return 'ProtocolError'
  } else if (code === SESSION_EXPIRED) {
    return 'SessionExpiredError'
  } else if (_isRetriableTransientError(code)) {
    return 'TransientError'
  } else if (code === 'Neo.ClientError.Security.TokenExpired') {
    return 'TokenExpiredError'
  } else if (code?.startsWith('Neo.ClientError.Security')) {
    return 'SecurityError'
  } else if (code?.startsWith('Neo.ClientError.') || code?.startsWith('Neo.TransientError.')) {
    return 'ClientError'
  } else {
    return NOT_AVAILABLE
  }
}

/**
 * @private
 * @param {string} code the error to check
 * @returns {boolean} true if the error is a service unavailable error
 */
function _isAuthorizationExpired (code?: Neo4jErrorCode): boolean {
  return code === 'Neo.ClientError.Security.AuthorizationExpired'
}

export {
  newError,
  newIllegalArgumentError,
  newResultConsumedError,
  newFatalDiscoveryError,
  isRetriableError,
  Neo4jError,
  SERVICE_UNAVAILABLE,
  SESSION_EXPIRED,
  PROTOCOL_ERROR
}
