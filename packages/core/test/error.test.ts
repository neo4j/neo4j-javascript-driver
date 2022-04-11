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
import {
  Neo4jError,
  isRetriableError,
  newError,
  PROTOCOL_ERROR,
  SERVICE_UNAVAILABLE,
  SESSION_EXPIRED,
  Neo4jErrorCategory,
  newIllegalArgumentError,
  newResultConsumedError,
  newFatalDiscoveryError
} from '../src/error'

describe('newError', () => {
  ;[PROTOCOL_ERROR, SERVICE_UNAVAILABLE, SESSION_EXPIRED].forEach(
    expectedCode => {
      test(`should create Neo4jError for code ${expectedCode}`, () => {
        const error: Neo4jError = newError('some error', expectedCode)

        expect(error.code).toEqual(expectedCode)
        expect(error.message).toEqual('some error')
      })
    }
  )

  test('should create Neo4jErro without code should be created with "N/A" error', () => {
    const error: Neo4jError = newError('some error')

    expect(error.message).toEqual('some error')
    expect(error.code).toEqual('N/A')
    expect(error.category).not.toBeDefined()
  })

  test.each([
    ['ResultConsumedError']
  ])('should allow define "%s" as category', category => {
    // @ts-ignore
    const error = new Neo4jError('message', 'code', category)

    expect(error.category).toEqual(category)
  })
})

describe('isRetriableError()', () => {
  it.each(getRetriableErrorsFixture())
    ('should return true for error with code %s', error => {
      expect(isRetriableError(error)).toBe(true)
    })

  it.each(getNonRetriableErrorsFixture())
    ('should return false for error with code %s', error => {
      expect(isRetriableError(error)).toBe(false)
    })
})

describe('Neo4jError', () => {
  test('should have message', () => {
    const error = new Neo4jError('message', 'code')

    expect(error.message).toEqual('message')
  })

  test('should have code', () => {
    const error = new Neo4jError('message', 'code')

    expect(error.code).toEqual('code')
  })

  test('should have name equal to Neo4jError', () => {
    const error = new Neo4jError('message', 'code')

    expect(error.name).toEqual('Neo4jError')
  })

  test('should define stackstrace', () => {
    const error = new Neo4jError('message', 'code')

    expect(error.stack).toBeDefined()
  })

  test('should define __proto__ and constructor to backwards compatility with ES6', () => {
    const error = new Neo4jError('message', 'code')

    // eslint-disable-next-line no-proto
    expect(error.__proto__).toEqual(Neo4jError.prototype)
    expect(error.constructor).toEqual(Neo4jError)
  })

  test.each(getRetriableCodes())
    ('should define retriable as true for error with code %s', code => {
      const error = new Neo4jError('message', code)

      expect(error.retriable).toBe(true)
    })

  test.each(getNonRetriableCodes())
    ('should define retriable as false for error with code %s', code => {
      const error = new Neo4jError('message', code)

      expect(error.retriable).toBe(false)
    })

  describe('.isRetriable()', () => {
    it.each(getRetriableErrorsFixture())
      ('should return true for error with code %s', error => {
        expect(Neo4jError.isRetriable(error)).toBe(true)
      })
  
    it.each(getNonRetriableErrorsFixture())
      ('should return false for error with code %s', error => {
        expect(Neo4jError.isRetriable(error)).toBe(false)
      })
  })

  test.each([
    ['Neo.ClientError.Made.Up'],
    ['Neo.TransientError.Transaction.LockClientStopped'],
    ['Neo.TransientError.Transaction.Terminated']
  ])('should define category as "ClientError" for error with code %s', code => {
    const error = new Neo4jError('message', code)

    expect(error.category).toEqual(Neo4jErrorCategory.CLIENT_ERROR)
  })

  test.each([
    ['Neo.TransientError.Transaction.DeadlockDetected'],
    ['Neo.TransientError.Network.CommunicationError']
  ])('should define category as "TransientError" for error with code %s', code => {
    const error = new Neo4jError('message', code)

    expect(error.category).toEqual(Neo4jErrorCategory.TRANSIENT_ERROR)
  })

  test.each([
    ['Neo.ClientError.Security.AuthorizationExpired']
  ])('should define category as "AuthorizationExpiredError" for error with code %s', code => {
    const error = new Neo4jError('message', code)

    expect(error.category).toEqual(Neo4jErrorCategory.AUTORIZATION_EXPIRED_ERROR)
  })

  test.each([
    ['Neo.ClientError.Security.TokenExpired']
  ])('should define category as "TokenExpiredError" for error with code %s', code => {
    const error = new Neo4jError('message', code)

    expect(error.category).toEqual(Neo4jErrorCategory.TOKEN_EXPIRED_ERROR)
  })

  test.each([
    ['ServiceUnavailable']
  ])('should define category as "ServiceUnavailableError" for error with code %s', code => {
    const error = new Neo4jError('message', code)

    expect(error.category).toEqual(Neo4jErrorCategory.SERVICE_UNAVAILABLE_ERROR)
  })

  test.each([
    ['SessionExpired']
  ])('should define category as "SessionExpiredError" for error with code %s', code => {
    const error = new Neo4jError('message', code)

    expect(error.category).toEqual(Neo4jErrorCategory.SESSION_EXPIRED_ERROR)
  })

  test.each([
    'ProtocolError'
  ])('should define category as "ProtocolError" for error with code %s', code => {
    const error = new Neo4jError('message', code)

    expect(error.category).toEqual(Neo4jErrorCategory.PROTOCOL_ERROR)
  })

  test.each([
    ['Neo.ClientError.Security.Forbidden']
  ])('should define category as "SecurityError" for error with code %s', code => {
    const error = new Neo4jError('message', code)

    expect(error.category).toEqual(Neo4jErrorCategory.SECURITY_ERROR)
  })

  test.each([
    [Neo4jErrorCategory.RESULT_CONSUMED_ERROR]
  ])('should allow define "%s" as category', category => {
    // @ts-ignore
    const error = new Neo4jError('message', 'code', category)

    expect(error.category).toEqual(Neo4jErrorCategory.RESULT_CONSUMED_ERROR)
  })
})

describe.each([
  [newIllegalArgumentError, Neo4jErrorCategory.ILLEGAL_ARGUMENT_ERROR],
  [newResultConsumedError, Neo4jErrorCategory.RESULT_CONSUMED_ERROR],
  [newFatalDiscoveryError, Neo4jErrorCategory.FATAL_DISCOVERY_ERROR]
])('%s', (newEspecificError: (mesage: string, code?: string) => Neo4jError, category: Neo4jErrorCategory) => {

  it(`should define category as "${category}"`, () => {
    const error = newEspecificError('message', 'code')

    expect(error.category).toEqual(category)
  })

  it(`should define an arbistrary message`, () => {
    const error = newEspecificError('arbitrary message', 'code')

    expect(error.message).toEqual('arbitrary message')
  })

  it(`should define an arbistrary code`, () => {
    const error = newEspecificError('message', 'arbitrary code')

    expect(error.code).toEqual('arbitrary code')
  })

  it('should set code to "N/A" when not defined', () => {
    const error = newEspecificError('message')

    expect(error.code).toEqual('N/A')
  })
})

describe('Neo4jErrorCategory', () => {
  describe.each([
    [Neo4jErrorCategory.AUTORIZATION_EXPIRED_ERROR, 'AuthorizationExpiredError'],
    [Neo4jErrorCategory.CLIENT_ERROR, 'ClientError'],
    [Neo4jErrorCategory.FATAL_DISCOVERY_ERROR, 'FatalDiscoveryError'],
    [Neo4jErrorCategory.ILLEGAL_ARGUMENT_ERROR, 'IllegalArgumentError'],
    [Neo4jErrorCategory.RESULT_CONSUMED_ERROR, 'ResultConsumedError'],
    [Neo4jErrorCategory.SECURITY_ERROR, 'SecurityError'],
    [Neo4jErrorCategory.SERVICE_UNAVAILABLE_ERROR, 'ServiceUnavailableError'],
    [Neo4jErrorCategory.SESSION_EXPIRED_ERROR, 'SessionExpiredError'],
    [Neo4jErrorCategory.TOKEN_EXPIRED_ERROR, 'TokenExpiredError'],
    [Neo4jErrorCategory.TRANSIENT_ERROR, 'TransientError']
  ])('%s category', (category, name) => {
    it(`.toString() === "${name}"`, () => {
      expect(category.toString()).toEqual(name)
    })

    it(`JSON.stringify() === JSON.stringify("${name}")`, () => {
      expect(JSON.stringify(category)).toEqual(JSON.stringify(name))
    })

    it(`.valueOf() === ${name}`, () => {
      expect(category.valueOf()).toEqual(name)
    })
  })
})

function getRetriableErrorsFixture () {
  return getRetriableCodes().map(code => [newError('message', code)])
}

function getNonRetriableErrorsFixture () {
  return [
    null,
    undefined,
    '',
    'Neo.TransientError.Transaction.DeadlockDetected',
    new Error('Neo.ClientError.Security.AuthorizationExpired'),
    ...getNonRetriableCodes().map(code => [newError('message', code)])
  ]
}

function getRetriableCodes () {
  return [
    SERVICE_UNAVAILABLE,
    SESSION_EXPIRED,
    'Neo.ClientError.Security.AuthorizationExpired',
    'Neo.TransientError.Transaction.DeadlockDetected',
    'Neo.TransientError.Network.CommunicationError'
  ]
}

function getNonRetriableCodes () {
  return [
    'Neo.TransientError.Transaction.Terminated',
    'Neo.DatabaseError.General.UnknownError',
    'Neo.TransientError.Transaction.LockClientStopped',
    'Neo.DatabaseError.General.OutOfMemoryError'
  ]
}
