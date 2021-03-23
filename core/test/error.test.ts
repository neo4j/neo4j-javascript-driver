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
  newError,
  PROTOCOL_ERROR,
  SERVICE_UNAVAILABLE,
  SESSION_EXPIRED
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
})
