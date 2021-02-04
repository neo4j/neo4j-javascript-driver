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
const NOT_AVAILABLE: string = 'N/A'

/**
 * Possible error codes in the {@link Neo4jError}
 */
type Neo4jErrorCode =
  | typeof SERVICE_UNAVAILABLE
  | typeof SESSION_EXPIRED
  | typeof PROTOCOL_ERROR
  | typeof NOT_AVAILABLE

/// TODO: Remove definitions of this.constructor and this.__proto__
/**
 * Class for all errors thrown/returned by the driver.
 */
class Neo4jError extends Error {
  /**
   * Optional error code. Will be populated when error originates in the database.
   */
  code: Neo4jErrorCode
  __proto__: Neo4jError

  /**
   * @constructor
   * @param {string} message - the error message
   * @param {string} code - Optional error code. Will be populated when error originates in the database.
   */
  constructor (message: string, code: Neo4jErrorCode) {
    super(message)
    this.constructor = Neo4jError
    // eslint-disable-next-line no-proto
    this.__proto__ = Neo4jError.prototype
    this.code = code
    this.name = 'Neo4jError'
  }
}

/**
 * Create a new error from a message and error code
 * @param message the error message
 * @param code the error code
 * @return {Neo4jError} an {@link Neo4jError}
 * @private
 */
function newError (message: string, code?: Neo4jErrorCode): Neo4jError {
  return new Neo4jError(message, code ?? NOT_AVAILABLE)
}

export {
  newError,
  Neo4jError,
  SERVICE_UNAVAILABLE,
  SESSION_EXPIRED,
  PROTOCOL_ERROR
}
