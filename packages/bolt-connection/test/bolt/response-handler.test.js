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

import ResponseHandler from '../../src/bolt/response-handler'
import { internal, newError } from 'neo4j-driver-core'

const {
  logger: { Logger }
} = internal

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
  })
})
