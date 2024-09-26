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

// A common place for constructing error objects, to keep them
// uniform across the driver surface.
import { NumberOrInteger } from './graph-types'
import * as json from './json'

export type ErrorClassification = 'DATABASE_ERROR' | 'CLIENT_ERROR' | 'TRANSIENT_ERROR' | 'UNKNOWN'
/**
 * @typedef { 'DATABASE_ERROR' | 'CLIENT_ERROR' | 'TRANSIENT_ERROR' | 'UNKNOWN' } ErrorClassification
 */

const errorClassification: { [key in ErrorClassification]: key } = {
  DATABASE_ERROR: 'DATABASE_ERROR',
  CLIENT_ERROR: 'CLIENT_ERROR',
  TRANSIENT_ERROR: 'TRANSIENT_ERROR',
  UNKNOWN: 'UNKNOWN'
}

Object.freeze(errorClassification)
const classifications = Object.values(errorClassification)

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
  gqlStatus: string
  gqlStatusDescription: string
  diagnosticRecord: ErrorDiagnosticRecord | undefined
  classification: ErrorClassification
  rawClassification?: string
  cause?: Error
  retriable: boolean
  __proto__: Neo4jError

  /**
   * @constructor
   * @param {string} message - the error message
   * @param {string} code - Optional error code. Will be populated when error originates in the database.
   * @param {string} gqlStatus - the error message
   * @param {string} gqlStatusDescription - the error message
   * @param {ErrorDiagnosticRecord} diagnosticRecord - the error message
   */
  constructor (message: string, code: Neo4jErrorCode, gqlStatus: string, gqlStatusDescription: string, diagnosticRecord?: ErrorDiagnosticRecord, cause?: Error) {
    // eslint-disable-next-line
    // @ts-ignore: not available in ES6 yet
    super(message, cause != null ? { cause } : undefined)
    this.constructor = Neo4jError
    // eslint-disable-next-line no-proto
    this.__proto__ = Neo4jError.prototype
    this.code = code
    this.gqlStatus = gqlStatus
    this.gqlStatusDescription = gqlStatusDescription
    this.diagnosticRecord = diagnosticRecord
    this.classification = extractClassification(this.diagnosticRecord)
    this.rawClassification = diagnosticRecord?._classification ?? undefined
    this.name = 'Neo4jError'
    /**
     * Indicates if the error is retriable.
     * @type {boolean} - true if the error is retriable
     */
    this.retriable = _isRetriableCode(code)
  }

  /**
   * Verifies if the given error is retriable.
   *
   * @param {object|undefined|null} error the error object
   * @returns {boolean} true if the error is retriable
   */
  static isRetriable (error?: any | null): boolean {
    return error !== null &&
      error !== undefined &&
      error instanceof Neo4jError &&
      error.retriable
  }

  /**
   * The json string representation of the diagnostic record.
   * The goal of this method is provide a serialized object for human inspection.
   *
   * @type {string}
   * @public
   */
  public get diagnosticRecordAsJsonString (): string {
    return json.stringify(this.diagnosticRecord, { useCustomToString: true })
  }
}

/**
 * Create a new error from a message and error code
 * @param message the error message
 * @param {Neo4jErrorCode} [code] the error code
 * @param {Neo4jError} [cause]
 * @param {String} [gqlStatus]
 * @param {String} [gqlStatusDescription]
 * @param {ErrorDiagnosticRecord} diagnosticRecord - the error message
 * @return {Neo4jError} an {@link Neo4jError}
 * @private
 */
function newError (message: string, code?: Neo4jErrorCode, cause?: Neo4jError, gqlStatus?: string, gqlStatusDescription?: string, diagnosticRecord?: ErrorDiagnosticRecord): Neo4jError {
  return new Neo4jError(message, code ?? NOT_AVAILABLE, gqlStatus ?? '50N42', gqlStatusDescription ?? 'error: general processing exception - unknown error. ' + message, diagnosticRecord, cause)
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
    _isTransientError(code)
}

/**
 * @private
 * @param {string} code the error to check
 * @return {boolean} true if the error is a transient error
 */
function _isTransientError (code?: Neo4jErrorCode): boolean {
  return code?.includes('TransientError') === true
}

/**
 * @private
 * @param {string} code the error to check
 * @returns {boolean} true if the error is a service unavailable error
 */
function _isAuthorizationExpired (code?: Neo4jErrorCode): boolean {
  return code === 'Neo.ClientError.Security.AuthorizationExpired'
}

function extractClassification (diagnosticRecord?: ErrorDiagnosticRecord): ErrorClassification {
  if (diagnosticRecord === undefined || diagnosticRecord._classification === undefined) {
    return 'UNKNOWN'
  }
  return classifications.includes(diagnosticRecord._classification) ? diagnosticRecord?._classification : 'UNKNOWN'
}

interface ErrorDiagnosticRecord {
  OPERATION: string
  OPERATION_CODE: string
  CURRENT_SCHEMA: string
  _severity?: string
  _classification?: ErrorClassification
  _position?: {
    offset: NumberOrInteger
    line: NumberOrInteger
    column: NumberOrInteger
  }
  _status_parameters?: Record<string, unknown>
  [key: string]: unknown
}

export {
  newError,
  isRetriableError,
  Neo4jError,
  SERVICE_UNAVAILABLE,
  SESSION_EXPIRED,
  PROTOCOL_ERROR
}
