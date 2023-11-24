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

import { error } from '../../core/index.ts'

const { SERVICE_UNAVAILABLE, SESSION_EXPIRED } = error

export default class ConnectionErrorHandler {
  constructor (
    errorCode,
    handleUnavailability,
    handleWriteFailure,
    handleSecurityError
  ) {
    this._errorCode = errorCode
    this._handleUnavailability = handleUnavailability || noOpHandler
    this._handleWriteFailure = handleWriteFailure || noOpHandler
    this._handleSecurityError = handleSecurityError || noOpHandler
  }

  static create ({
    errorCode,
    handleUnavailability,
    handleWriteFailure,
    handleSecurityError
  }) {
    return new ConnectionErrorHandler(
      errorCode,
      handleUnavailability,
      handleWriteFailure,
      handleSecurityError
    )
  }

  /**
   * Error code to use for network errors.
   * @return {string} the error code.
   */
  errorCode () {
    return this._errorCode
  }

  /**
   * Handle and transform the error.
   * @param {Neo4jError} error the original error.
   * @param {ServerAddress} address the address of the connection where the error happened.
   * @return {Neo4jError} new error that should be propagated to the user.
   */
  handleAndTransformError (error, address, connection) {
    if (isSecurityError(error)) {
      return this._handleSecurityError(error, address, connection)
    }
    if (isAvailabilityError(error)) {
      return this._handleUnavailability(error, address, connection)
    }
    if (isFailureToWrite(error)) {
      return this._handleWriteFailure(error, address, connection)
    }
    return error
  }
}

function isSecurityError (error) {
  return error != null &&
    error.code != null &&
    error.code.startsWith('Neo.ClientError.Security.')
}

function isAvailabilityError (error) {
  if (error) {
    return (
      error.code === SESSION_EXPIRED ||
      error.code === SERVICE_UNAVAILABLE ||
      error.code === 'Neo.TransientError.General.DatabaseUnavailable'
    )
  }
  return false
}

function isFailureToWrite (error) {
  if (error) {
    return (
      error.code === 'Neo.ClientError.Cluster.NotALeader' ||
      error.code === 'Neo.ClientError.General.ForbiddenOnReadOnlyDatabase'
    )
  }
  return false
}

function noOpHandler (error) {
  return error
}
