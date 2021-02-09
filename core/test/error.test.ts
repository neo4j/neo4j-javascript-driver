import {
  Neo4jError,
  newError,
  PROTOCOL_ERROR,
  SERVICE_UNAVAILABLE,
  SESSION_EXPIRED
} from 'neo4j-driver-core/src/error'

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
