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
import {
  Neo4jError,
  isRetriableError,
  newError,
  newGQLError,
  PROTOCOL_ERROR,
  SERVICE_UNAVAILABLE,
  SESSION_EXPIRED
} from '../src/error'

describe('newError', () => {
  let supportsCause = false
  beforeAll(() => {
    // @ts-expect-error
    const error = new Error('a', { cause: new Error('a') })
    // @ts-expect-error
    supportsCause = error.cause != null
  })

  ;[PROTOCOL_ERROR, SERVICE_UNAVAILABLE, SESSION_EXPIRED].forEach(
    expectedCode => {
      test(`should create Neo4jError for code ${expectedCode}`, () => {
        const error: Neo4jError = newError('some error', expectedCode)

        expect(error.code).toEqual(expectedCode)
        expect(error.message).toEqual('some error')
      })
    }
  )

  test('should create Neo4jError without code with "N/A" error', () => {
    const error: Neo4jError = newError('some error')

    expect(error.message).toEqual('some error')
    expect(error.code).toEqual('N/A')
  })

  test('should create Neo4jError without status description with default description', () => {
    const error: Neo4jError = newError('some error')

    expect(error.gqlStatusDescription).toEqual('error: general processing exception - unexpected error. some error')
    expect(error.code).toEqual('N/A')
  })

  test('should create Neo4jError without gql status with default status', () => {
    const error: Neo4jError = newError('some error')

    expect(error.gqlStatus).toEqual('50N42')
    expect(error.code).toEqual('N/A')
  })

  test('should create Neo4jError with cause', () => {
    const cause = newGQLError('cause')
    const error: Neo4jError = newError('some error', undefined, cause, 'some status', 'some description', undefined)

    expect(error.message).toEqual('some error')
    expect(error.code).toEqual('N/A')
    if (supportsCause) {
      expect(error.cause).toBe(cause)
      // @ts-expect-error
      expect(error.cause.classification).toBe('UNKNOWN')
    } else {
      expect(error.cause).toBeUndefined()
    }
  })

  test('should create Neo4jError with nested cause', () => {
    const cause = newGQLError('cause', newGQLError('nested'), undefined, undefined, undefined)
    const error: Neo4jError = newError('some error', undefined, cause, 'some status', 'some description', undefined)

    expect(error.message).toEqual('some error')
    expect(error.code).toEqual('N/A')
    if (supportsCause) {
      expect(error.cause).toBe(cause)
      // @ts-expect-error
      expect(error.cause.classification).toBe('UNKNOWN')
      // @ts-expect-error
      expect(error.cause.cause.classification).toBe('UNKNOWN')
    } else {
      expect(error.cause).toBeUndefined()
    }
  })

  test.each([null, undefined])('should create Neo4jError without cause (%s)', (cause) => {
    // @ts-expect-error
    const error: Neo4jError = newError('some error', undefined, cause, undefined, undefined, undefined)

    expect(error.message).toEqual('some error')
    expect(error.code).toEqual('N/A')
    expect(error.cause).toBeUndefined()
  })

  test('should create Neo4jError without diagnosticRecord with UNKNOWN classification', () => {
    const error: Neo4jError = newError('some error')

    expect(error.classification).toEqual('UNKNOWN')
  })

  test.each([
    'TRANSIENT_ERROR',
    'CLIENT_ERROR',
    'DATABASE_ERROR'
  ])('should create Neo4jError with diagnosticRecord with classification (%s)', (classification) => {
    const error: Neo4jError = newError('some error', undefined, undefined, undefined, undefined, { OPERATION: '', OPERATION_CODE: '0', CURRENT_SCHEMA: '/', _classification: classification })

    expect(error.classification).toEqual(classification)
  })
})

describe('isRetriableError()', () => {
  it.each(getRetriableErrorsFixture())('should return true for error with code %s', error => {
    expect(isRetriableError(error)).toBe(true)
  })

  it.each(getNonRetriableErrorsFixture())('should return false for error with code %s', error => {
    expect(isRetriableError(error)).toBe(false)
  })
})

describe('Neo4jError', () => {
  test('should have message', () => {
    const error = new Neo4jError('message', 'code', 'gqlStatus', 'gqlStatusDescription')

    expect(error.message).toEqual('message')
  })

  test('should have code', () => {
    const error = new Neo4jError('message', 'code', 'gqlStatus', 'gqlStatusDescription')

    expect(error.code).toEqual('code')
  })

  test('should have gqlStatus', () => {
    const error = new Neo4jError('message', 'code', 'gqlStatus', 'gqlStatusDescription')

    expect(error.gqlStatus).toEqual('gqlStatus')
  })

  test('should have gqlStatusDescription', () => {
    const error = new Neo4jError('message', 'code', 'gqlStatus', 'gqlStatusDescription')

    expect(error.gqlStatusDescription).toEqual('gqlStatusDescription')
  })

  test('should have name equal to Neo4jError', () => {
    const error = new Neo4jError('message', 'code', 'gqlStatus', 'gqlStatusDescription')

    expect(error.name).toEqual('Neo4jError')
  })

  test('should define stackstrace', () => {
    const error = new Neo4jError('message', 'code', 'gqlStatus', 'gqlStatusDescription')

    expect(error.stack).toBeDefined()
  })

  test('should define __proto__ and constructor to backwards compatility with ES6', () => {
    const error = new Neo4jError('message', 'code', 'gqlStatus', 'gqlStatusDescription')

    // eslint-disable-next-line no-proto
    expect(error.__proto__).toEqual(Neo4jError.prototype)
    expect(error.constructor).toEqual(Neo4jError)
  })

  test.each(getRetriableCodes())('should define retriable as true for error with code %s', code => {
    const error = new Neo4jError('message', code, 'gqlStatus', 'gqlStatusDescription')

    expect(error.retriable).toBe(true)
  })

  test.each(getNonRetriableCodes())('should define retriable as false for error with code %s', code => {
    const error = new Neo4jError('message', code, 'gqlStatus', 'gqlStatusDescription')

    expect(error.retriable).toBe(false)
  })

  describe('.isRetriable()', () => {
    it.each(getRetriableErrorsFixture())('should return true for error with code %s', error => {
      expect(Neo4jError.isRetriable(error)).toBe(true)
    })

    it.each(getNonRetriableErrorsFixture())('should return false for error with code %s', error => {
      expect(Neo4jError.isRetriable(error)).toBe(false)
    })
  })
})

function getRetriableErrorsFixture (): Array<[Neo4jError]> {
  return getRetriableCodes().map(code => [newError('message', code)])
}

function getNonRetriableErrorsFixture (): any[] {
  return [
    null,
    undefined,
    '',
    'Neo.TransientError.Transaction.DeadlockDetected',
    new Error('Neo.ClientError.Security.AuthorizationExpired'),
    ...getNonRetriableCodes().map(code => [newError('message', code)])
  ]
}

function getRetriableCodes (): string[] {
  return [
    SERVICE_UNAVAILABLE,
    SESSION_EXPIRED,
    'Neo.ClientError.Security.AuthorizationExpired',
    'Neo.TransientError.Transaction.DeadlockDetected',
    'Neo.TransientError.Network.CommunicationError',
    'Neo.TransientError.Transaction.Terminated',
    'Neo.TransientError.Transaction.LockClientStopped'
  ]
}

function getNonRetriableCodes (): string[] {
  return [
    'Neo.DatabaseError.General.UnknownError',
    'Neo.DatabaseError.General.OutOfMemoryError',
    'Neo.ClientError.Transaction.Terminated',
    'Neo.ClientError.Transaction.LockClientStopped'
  ]
}
