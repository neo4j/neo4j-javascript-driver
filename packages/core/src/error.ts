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
 * Represents an category of error ocurrred in the Neo4j driver.
 * 
 * Categories are used to classify errors in a way that makes it possible to
 * distinguish between different types of errors and give the user a hint on how
 * to handle them.
 * 
 * The categories are:
 *  - **{@link Neo4jErrorCategory.AUTHORIZATION_EXPIRED_ERROR}** - Indicates that the authorization has expired in the Neo4j server.
 *    This error is recoverable and the driver will try to re-authenticate the user in next requests.
 *    - Serialized as `AutorizationExpiredError`
 *  - **{@link Neo4jErrorCategory.CLIENT_ERROR}** - Generically representing client errors. 
 *    Usually errors code started with `Neo.ClientError.` not security related.
 *    - Serialized as `ClientError`
 *  - **{@link Neo4jErrorCategory.FATAL_DISCOVERY_ERROR}** - non-recorverable errors related to the Neo4j cluster topology.
 *    Usually happens when the server return `Neo.ClientError.Database.DatabaseNotFound` during the discovery.
 *    - Serialized as `FatalDiscoveryError`
 *  - **{@link Neo4jErrorCategory.ILLEGAL_ARGUMENT_ERROR}** - errors that are caused by illegal arguments
 *    - Serialized as `IllegalArgumentError`
 *  - **{@link Neo4jErrorCategory.PROTOCOL_ERROR}** - errors that are caused by protocol errors
 *    - Serialized as `ProtocolError`
 *  - **{@link Neo4jErrorCategory.RESULT_CONSUMED_ERROR}** - errors that are caused by consuming a already consumed result
 *    - Serialized as `ResultConsumedError`
 *  - **{@link Neo4jErrorCategory.SECURITY_ERROR}** - errors that are caused by security related issues.
 *    Usually errors code started with `Neo.Client.SecurityError.` which are not categorized in other categories.
 *    - Serialized as `SecurityError`
 *  - **{@link Neo4jErrorCategory.SERVICE_UNAVAILABLE_ERROR}** - errors that are caused by service unavailable.
 *    - Serialized as `ServiceUnavailableError`
 *  - **{@link Neo4jErrorCategory.SESSION_EXPIRED}** - errors that are caused by session expired
 *    - Serialized as `SessionExpiredError`
 *  - **{@link Neo4jErrorCategory.TOKEN_EXPIRED_ERROR}** - errors that are caused by token expired
 *    The user must re-authenticate in this case.
 *    - Serialized as `TokenExpiredError`
 *  - **{@link Neo4jErrorCategory.TRANSIENT_ERROR}** - errors which are transient and can be retried.
 *    - Serialized as `TransientError`
 *
 * @public
 * @see {@link Neo4jError} for more information about errors.
 * @see {@link Neo4jError.isRetriable}, {@link Neo4jError#retriable} and {@link isRetriable} for more information about retries.
 * @see {@link Neo4jError#code} for more information about error codes.
 */
class Neo4jErrorCategory {
  private readonly _value: string

  /**
   * @type {Neo4jErrorCategory} Neo4jErrorCategory.AUTHORIZATION_EXPIRED_ERROR - The authorization token has expired.
   */
  public static readonly AUTHORIZATION_EXPIRED_ERROR: Neo4jErrorCategory = new Neo4jErrorCategory('AuthorizationExpiredError')
  public static readonly CLIENT_ERROR: Neo4jErrorCategory = new Neo4jErrorCategory('ClientError')
  public static readonly FATAL_DISCOVERY_ERROR: Neo4jErrorCategory = new Neo4jErrorCategory('FatalDiscoveryError')
  public static readonly ILLEGAL_ARGUMENT_ERROR: Neo4jErrorCategory = new Neo4jErrorCategory('IllegalArgumentError')
  public static readonly PROTOCOL_ERROR: Neo4jErrorCategory = new Neo4jErrorCategory('ProtocolError')
  public static readonly RESULT_CONSUMED_ERROR: Neo4jErrorCategory = new Neo4jErrorCategory('ResultConsumedError')
  public static readonly SECURITY_ERROR: Neo4jErrorCategory = new Neo4jErrorCategory('SecurityError')
  public static readonly SERVICE_UNAVAILABLE_ERROR: Neo4jErrorCategory = new Neo4jErrorCategory('ServiceUnavailableError')
  public static readonly SESSION_EXPIRED_ERROR: Neo4jErrorCategory = new Neo4jErrorCategory('SessionExpiredError')
  public static readonly TOKEN_EXPIRED_ERROR: Neo4jErrorCategory = new Neo4jErrorCategory('TokenExpiredError')
  public static readonly TRANSIENT_ERROR: Neo4jErrorCategory = new Neo4jErrorCategory('TransientError')

  /**
   * @private
   * @param value The category value
   */
  private constructor(value: string) {
    this._value = value
  }

  /**
   * @override
   * @returns {string} The value of the category
   */
  valueOf(): string {
    return this._value
  }

  /**
   * @override
   * @returns {string} The JSON representation of the category
   */
  toJSON(): string {
    return this._value
  }

  /**
   * @override
   * @returns {string} The string representation of the category
   */
  toString(): string {
    return this._value
  }
}
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
  category?: Neo4jErrorCategory
  __proto__: Neo4jError

  /**
   * @constructor
   * @param {string} message - the error message
   * @param {string} code - Optional error code. Will be populated when error originates in the database.
   * @param {Neo4jErrorCategory|undefined} category - Optional error category. Will be populated when error originates in the database.
   */
  constructor (message: string, code: Neo4jErrorCode, category?: Neo4jErrorCategory) {
    super(message)
    this.constructor = Neo4jError
    // eslint-disable-next-line no-proto
    this.__proto__ = Neo4jError.prototype

    /**
     * Indicates the code the error originated from the database.
     *
     * Read more about error code in https://neo4j.com/docs/status-codes/current/
     *
     * @type {string}
     */
    this.code = code
    this.name = 'Neo4jError'
    /**
     * Indicates if the error is retriable.
     * @type {boolean} - true if the error is retriable
     */
    this.retriable = _isRetriableCode(code)

    /**
     * Indicates if the category of the error occurred.
     *
     * The category is meant to be used to classify errors in a way that makes it possible to
     * distinguish between different types of errors and give the user a hint on how to handle them.
     *
     * More details about the error could be found in {@link Neo4jError#code} and {@link Neo4jError#message}.
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

/**
 * @private
 * @param message the error message
 * @param code the error code
 * @returns {Neo4jError} an {@link Neo4jError} with {@link Neo4jErrorCategory.ILLEGAL_ARGUMENT_ERROR} as category
 */
function newIllegalArgumentError (message: string, code?: Neo4jErrorCode): Neo4jError {
  return newError(message, code, Neo4jErrorCategory.ILLEGAL_ARGUMENT_ERROR )
}

/**
 * @private
 * @param message the error message
 * @param code the error code
 * @returns {Neo4jError} an {@link Neo4jError} with {@link Neo4jErrorCategory.RESULT_CONSUMED_ERROR} as category
 */
function newResultConsumedError (message: string, code?: Neo4jErrorCode): Neo4jError {
  return newError(message, code, Neo4jErrorCategory.RESULT_CONSUMED_ERROR)
}

/**
 * @private
 * @param message the error message
 * @param code the error code
 * @returns {Neo4jError} an {@link Neo4jError} with {@link Neo4jErrorCategory.FATAL_DISCOVERY_ERROR} as category
 */
function newFatalDiscoveryError (message: string, code?: Neo4jErrorCode): Neo4jError {
  return newError(message, code, Neo4jErrorCategory.FATAL_DISCOVERY_ERROR)
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

function _categorizeErrorCode (code?: Neo4jErrorCode): Neo4jErrorCategory | undefined {
  if (code === undefined) {
    return undefined 
  } else if (code === 'Neo.ClientError.Security.AuthorizationExpired') {
    return Neo4jErrorCategory.AUTHORIZATION_EXPIRED_ERROR
  } else if (code === SERVICE_UNAVAILABLE) {
    return Neo4jErrorCategory.SERVICE_UNAVAILABLE_ERROR
  } else if (code === PROTOCOL_ERROR) {
    return Neo4jErrorCategory.PROTOCOL_ERROR
  } else if (code === SESSION_EXPIRED) {
    return Neo4jErrorCategory.SESSION_EXPIRED_ERROR
  } else if (_isRetriableTransientError(code)) {
    return Neo4jErrorCategory.TRANSIENT_ERROR
  } else if (code === 'Neo.ClientError.Security.TokenExpired') {
    return Neo4jErrorCategory.TOKEN_EXPIRED_ERROR
  } else if (code?.startsWith('Neo.ClientError.Security')) {
    return Neo4jErrorCategory.SECURITY_ERROR
  } else if (code?.startsWith('Neo.ClientError.') || code?.startsWith('Neo.TransientError.')) {
    return Neo4jErrorCategory.CLIENT_ERROR
  } else {
    return undefined
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
  Neo4jErrorCategory,
  SERVICE_UNAVAILABLE,
  SESSION_EXPIRED,
  PROTOCOL_ERROR
}
