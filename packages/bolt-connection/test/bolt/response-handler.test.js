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

import ResponseHandler from '../../src/bolt/response-handler'
import BoltProtocolV1 from '../../src/bolt/bolt-protocol-v1'
import { internal, newError } from 'neo4j-driver-core'

/* eslint-disable camelcase */
const {
  logger: { Logger }
} = internal

const SUCCESS = 0x70 // 0111 0000 // SUCCESS <metadata>
const FAILURE = 0x7f // 0111 1111 // FAILURE <metadata>

describe('response-handler', () => {
  describe('.handleResponse()', () => {
    it.each([
      {
        code: 'Neo.TransientError.Transaction.Terminated',
        expectedErrorCode: 'Neo.ClientError.Transaction.Terminated'
      },
      {
        code: 'Neo.TransientError.Transaction.LockClientStopped',
        expectedErrorCode: 'Neo.ClientError.Transaction.LockClientStopped'
      },
      {
        code: 'Neo.ClientError.Transaction.LockClientStopped',
        expectedErrorCode: 'Neo.ClientError.Transaction.LockClientStopped'
      },
      {
        code: 'Neo.ClientError.Transaction.Terminated',
        expectedErrorCode: 'Neo.ClientError.Transaction.Terminated'
      },
      {
        code: 'Neo.TransientError.Security.NotYourBusiness',
        expectedErrorCode: 'Neo.TransientError.Security.NotYourBusiness'
      }
    ])('should fix wrong classified error codes', ({ code, expectedErrorCode }) => {
      const observer = {
        capturedErrors: [],
        onFailure: error => observer.capturedErrors.push(error)
      }
      const message = 'Something gets wrong'
      const expectedError = newError(message, expectedErrorCode)
      const responseHandler = new ResponseHandler({ observer, log: Logger.noOp() })
      responseHandler._queueObserver({})

      const errorMessage = {
        signature: FAILURE,
        fields: [{ message, code }]
      }
      responseHandler.handleResponse(errorMessage)

      expect(observer.capturedErrors.length).toBe(1)
      const [receivedError] = observer.capturedErrors
      expect(receivedError.message).toBe(expectedError.message)
      expect(receivedError.code).toBe(expectedError.code)
    })

    it('should correctly handle errors with gql data', () => {
      const errorPayload = {
        message: 'older message',
        code: 'Neo.ClientError.Test.Kaboom',
        gql_status: '13N37',
        description: 'I made this error up, for fun and profit!',
        diagnostic_record: { OPERATION: '', OPERATION_CODE: '0', CURRENT_SCHEMA: '/', _classification: 'CLIENT_ERROR' }
      }
      const observer = {
        capturedErrors: [],
        onFailure: error => observer.capturedErrors.push(error)
      }
      const responseHandler = new ResponseHandler({ observer, log: Logger.noOp() })
      responseHandler._queueObserver({})

      const errorMessage = {
        signature: FAILURE,
        fields: [errorPayload]
      }
      responseHandler.handleResponse(errorMessage)

      expect(observer.capturedErrors.length).toBe(1)
      const [receivedError] = observer.capturedErrors
      expect(receivedError.code).toBe(errorPayload.code)
      expect(receivedError.message).toBe(errorPayload.message)
      expect(receivedError.gqlStatus).toBe(errorPayload.gql_status)
      expect(receivedError.gqlStatusDescription).toBe(errorPayload.description)
      expect(receivedError.classification).toBe(errorPayload.diagnostic_record._classification)
    })

    it('should correctly handle errors with gql data and nested causes', () => {
      const errorPayload = {
        message: 'old message',
        code: 'Neo.ClientError.Test.Error',
        gql_status: '13N37',
        description: 'I made this error up, for fun and profit!',
        diagnostic_record: { OPERATION_CODE: '0', CURRENT_SCHEMA: '/', _classification: 'CLIENT_ERROR', additional_thing: 5268 },
        cause: {
          message: 'old cause message',
          gql_status: '13N38',
          description: 'I made this error up, for fun and profit and reasons!',
          diagnostic_record: { OPERATION: '', OPERATION_CODE: '2', CURRENT_SCHEMA: '/', _classification: 'DATABASE_ERROR', additional_thing: false }
        }
      }
      const observer = {
        capturedErrors: [],
        onFailure: error => observer.capturedErrors.push(error)
      }
      const enrichErrorMetadata = new BoltProtocolV1().enrichErrorMetadata
      const responseHandler = new ResponseHandler({ observer, enrichErrorMetadata, log: Logger.noOp() })
      responseHandler._queueObserver({})

      const errorMessage = {
        signature: FAILURE,
        fields: [errorPayload]
      }
      responseHandler.handleResponse(errorMessage)

      expect(observer.capturedErrors.length).toBe(1)
      const [receivedError] = observer.capturedErrors
      expect(receivedError.code).toBe(errorPayload.code)
      expect(receivedError.message).toBe(errorPayload.message)
      expect(receivedError.gqlStatus).toBe(errorPayload.gql_status)
      expect(receivedError.gqlStatusDescription).toBe(errorPayload.description)
      testDiagnosticRecord(receivedError.diagnosticRecord, { ...errorPayload.diagnostic_record, OPERATION: '' })
      testDiagnosticRecord(receivedError.cause.diagnosticRecord, errorPayload.cause.diagnostic_record)
      expect(receivedError.classification).toBe(errorPayload.diagnostic_record._classification)
      expect(receivedError.cause.classification).toBe(errorPayload.cause.diagnostic_record._classification)
    })
  })

  function testDiagnosticRecord (diagnostic_record, expected_diagnostic_record) {
    expect(diagnostic_record.OPERATION).toBe(expected_diagnostic_record.OPERATION)
    expect(diagnostic_record.CURRENT_SCHEMA).toBe(expected_diagnostic_record.CURRENT_SCHEMA)
    expect(diagnostic_record.OPERATION_CODE).toBe(expected_diagnostic_record.OPERATION_CODE)
    expect(diagnostic_record.additional_thing).toBe(expected_diagnostic_record.additional_thing)
  }

  it('should keep track of observers and notify onObserversCountChange()', () => {
    const observer = {
      onObserversCountChange: jest.fn()
    }
    const responseHandler = new ResponseHandler({ observer, log: Logger.noOp() })

    responseHandler._queueObserver({})
    expect(observer.onObserversCountChange).toHaveBeenLastCalledWith(1)

    responseHandler._queueObserver({})
    expect(observer.onObserversCountChange).toHaveBeenLastCalledWith(2)

    responseHandler._queueObserver({})
    expect(observer.onObserversCountChange).toHaveBeenLastCalledWith(3)

    const success = {
      signature: SUCCESS,
      fields: [{}]
    }

    responseHandler.handleResponse(success)
    expect(observer.onObserversCountChange).toHaveBeenLastCalledWith(2)

    responseHandler.handleResponse(success)
    expect(observer.onObserversCountChange).toHaveBeenLastCalledWith(1)

    responseHandler.handleResponse(success)
    expect(observer.onObserversCountChange).toHaveBeenLastCalledWith(0)

    expect(observer.onObserversCountChange).toHaveBeenCalledTimes(6)
  })
})
