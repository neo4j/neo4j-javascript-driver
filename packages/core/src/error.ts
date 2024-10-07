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

import * as json from './json'
import { DiagnosticRecord, rawPolyfilledDiagnosticRecord } from './gql-constants'

export type ErrorClassification = 'DATABASE_ERROR' | 'CLIENT_ERROR' | 'TRANSIENT_ERROR' | 'UNKNOWN'
/**
 * @typedef { 'DATABASE_ERROR' | 'CLIENT_ERROR' | 'TRANSIENT_ERROR' | 'UNKNOWN' } ErrorClassification
 * @experimental this is part of the preview of GQL-compliant errors
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
 * Class for nested errors, to be used as causes in {@link Neo4jError}
 * @experimental this class is part of the preview of GQL-compliant errors
 */
class GQLError extends Error {
  gqlStatus: string
  gqlStatusDescription: string
  diagnosticRecord: DiagnosticRecord | undefined
  classification: ErrorClassification
  rawClassification?: string
  cause?: Error
  __proto__: GQLError

  /**
   * @constructor
   * @param {string} message - the error message
   * @param {string} gqlStatus - the GQL status code of the error
   * @param {string} gqlStatusDescription - the GQL status description of the error
   * @param {ErrorDiagnosticRecord} diagnosticRecord - the error diagnostic record
   * @param {Error} cause - Optional nested error, the cause of the error
   */
  constructor (message: string, gqlStatus: string, gqlStatusDescription: string, diagnosticRecord?: DiagnosticRecord, cause?: Error) {
    // eslint-disable-next-line
    // @ts-ignore: not available in ES6 yet
    super(message, cause != null ? { cause } : undefined)
    this.constructor = GQLError
    // eslint-disable-next-line no-proto
    this.__proto__ = GQLError.prototype
    /**
     * Optional, nested error which caused the error
     *
     * @type {Error?}
     * @public
     */
    this.cause = cause != null ? cause : undefined
    /**
     * The GQL Status code
     *
     * @type {string}
     * @experimental this property is part of the preview of GQL-compliant errors
     * @public
     */
    this.gqlStatus = gqlStatus
    /**
     * The GQL Status Description
     *
     * @type {string}
     * @experimental this property is part of the preview of GQL-compliant errors
     * @public
     */
    this.gqlStatusDescription = gqlStatusDescription
    /**
     * The GQL diagnostic record
     *
     * @type {DiagnosticRecord}
     * @experimental this property is part of the preview of GQL-compliant errors
     * @public
     */
    this.diagnosticRecord = diagnosticRecord
    /**
     * The GQL error classification, extracted from the diagnostic record
     *
     * @type {ErrorClassification}
     * @experimental this property is part of the preview of GQL-compliant errors
     * @public
     */
    this.classification = _extractClassification(this.diagnosticRecord)
    /**
     * The GQL error classification, extracted from the diagnostic record as a raw string
     *
     * @type {string}
     * @experimental this property is part of the preview of GQL-compliant errors
     * @public
     */
    this.rawClassification = diagnosticRecord?._classification ?? undefined
    this.name = 'GQLError'
  }

  /**
   * The json string representation of the diagnostic record.
   * The goal of this method is provide a serialized object for human inspection.
   *
   * @type {string}
   * @experimental this is part of the preview of GQL-compliant errors
   * @public
   */
  public get diagnosticRecordAsJsonString (): string {
    return json.stringify(this.diagnosticRecord, { useCustomToString: true })
  }
}

/**
 * Class for all errors thrown/returned by the driver.
 */
class Neo4jError extends GQLError {
  /**
   * Optional error code. Will be populated when error originates in the database.
   */
  code: string
  retriable: boolean

  /**
   * @constructor
   * @param {string} message - the error message
   * @param {string} code - Optional error code. Will be populated when error originates in the database.
   * @param {string} gqlStatus - the GQL status code of the error
   * @param {string} gqlStatusDescription - the GQL status description of the error
   * @param {DiagnosticRecord} diagnosticRecord - the error diagnostic record
   * @param {Error} cause - Optional nested error, the cause of the error
   */
  constructor (message: string, code: Neo4jErrorCode, gqlStatus: string, gqlStatusDescription: string, diagnosticRecord?: DiagnosticRecord, cause?: Error) {
    super(message, gqlStatus, gqlStatusDescription, diagnosticRecord, cause)
    this.constructor = Neo4jError
    // eslint-disable-next-line no-proto
    this.__proto__ = Neo4jError.prototype
    /**
     * The Neo4j Error code
     *
     * @type {string}
     * @public
     */
    this.code = code

    this.name = 'Neo4jError'
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
}

/**
 * Create a new error from a message and optional data
 * @param message the error message
 * @param {Neo4jErrorCode} [code] the error code
 * @param {Neo4jError} [cause]
 * @param {String} [gqlStatus]
 * @param {String} [gqlStatusDescription]
 * @param {DiagnosticRecord} diagnosticRecord - the error message
 * @return {Neo4jError} an {@link Neo4jError}
 * @private
 */
function newError (message: string, code?: Neo4jErrorCode, cause?: Error, gqlStatus?: string, gqlStatusDescription?: string, diagnosticRecord?: DiagnosticRecord): Neo4jError {
  return new Neo4jError(message, code ?? NOT_AVAILABLE, gqlStatus ?? '50N42', gqlStatusDescription ?? 'error: general processing exception - unexpected error. ' + message, diagnosticRecord ?? rawPolyfilledDiagnosticRecord, cause)
}

/**
 * Create a new GQL error from a message and optional data
 * @param message the error message
 * @param {Neo4jError} [cause]
 * @param {String} [gqlStatus]
 * @param {String} [gqlStatusDescription]
 * @param {DiagnosticRecord} diagnosticRecord - the error message
 * @return {Neo4jError} an {@link Neo4jError}
 * @experimental this is part of the preview of GQL-compliant errors
 * @private
 */
function newGQLError (message: string, cause?: Error, gqlStatus?: string, gqlStatusDescription?: string, diagnosticRecord?: DiagnosticRecord): GQLError {
  return new GQLError(message, gqlStatus ?? '50N42', gqlStatusDescription ?? 'error: general processing exception - unexpected error. ' + message, diagnosticRecord ?? rawPolyfilledDiagnosticRecord, cause)
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

/**
 * extracts a typed classification from the diagnostic record.
 */
function _extractClassification (diagnosticRecord?: any): ErrorClassification {
  if (diagnosticRecord === undefined || diagnosticRecord._classification === undefined) {
    return 'UNKNOWN'
  }
  return classifications.includes(diagnosticRecord._classification) ? diagnosticRecord?._classification : 'UNKNOWN'
}

export {
  newError,
  newGQLError,
  isRetriableError,
  Neo4jError,
  GQLError,
  SERVICE_UNAVAILABLE,
  SESSION_EXPIRED,
  PROTOCOL_ERROR
}
