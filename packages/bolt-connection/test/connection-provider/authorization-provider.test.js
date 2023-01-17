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
import AuthenticationProvider from '../../src/connection-provider/authentication-provider'

describe('AuthenticationProvider', () => {
  const USER_AGENT = 'javascript-driver/5.5.0'

  describe('.authenticate()', () => {
    describe('when called without an auth', () => {
      describe('and first call', () => {
        describe('and connection.authToken is different of new AuthToken', () => {
          it('should refresh the auth token', async () => {
            const authTokenProvider = jest.fn(() => toRenewableToken({ scheme: 'none' }))
            const authenticationProvider = createAuthenticationProvider(authTokenProvider)
            const connection = mockConnection()

            await authenticationProvider.authenticate({ connection })

            expect(authTokenProvider).toHaveBeenCalledTimes(1)
          })

          it('should refresh authToken only once', async () => {
            const authTokenProvider = jest.fn(() => new Promise((resolve) => {
              setTimeout(() => {
                resolve(toRenewableToken({ scheme: 'none' }))
              }, 100)
            }))

            const authenticationProvider = createAuthenticationProvider(authTokenProvider)
            const connections = [mockConnection(), mockConnection()]

            await Promise.all(connections.map(connection => authenticationProvider.authenticate({ connection })))

            expect(authTokenProvider).toHaveBeenCalledTimes(1)
          })

          it('should return the connection', async () => {
            const authTokenProvider = jest.fn(() => toRenewableToken({ scheme: 'none' }))
            const authenticationProvider = createAuthenticationProvider(authTokenProvider)
            const connection = mockConnection()

            const resultedConnection = await authenticationProvider.authenticate({ connection })

            expect(resultedConnection).toBe(connection)
          })

          it('should call connection.connect', async () => {
            const authToken = { scheme: 'none' }
            const authTokenProvider = jest.fn(() => toRenewableToken(authToken))
            const authenticationProvider = createAuthenticationProvider(authTokenProvider)
            const connection = mockConnection()

            await authenticationProvider.authenticate({ connection })

            expect(connection.connect).toHaveBeenCalledWith(USER_AGENT, authToken)
          })

          it('should throw errors happened during token refresh', async () => {
            const error = new Error('ops')
            const authTokenProvider = jest.fn(() => Promise.reject(error))
            const authenticationProvider = createAuthenticationProvider(authTokenProvider)
            const connection = mockConnection()

            await expect(authenticationProvider.authenticate({ connection })).rejects.toThrow(error)
          })

          it('should throw errors happened during connection.connect', async () => {
            const error = new Error('ops')
            const authTokenProvider = jest.fn(() => toRenewableToken({ scheme: 'none' }))
            const authenticationProvider = createAuthenticationProvider(authTokenProvider)
            const connection = mockConnection({
              connect: () => Promise.reject(error)
            })

            await expect(authenticationProvider.authenticate({ connection })).rejects.toThrow(error)
          })
        })

        describe('when connection.authToken is equal to new AuthToken', () => {
          it('should refresh the auth token', async () => {
            const authTokenProvider = jest.fn(() => toRenewableToken({ scheme: 'none' }))
            const authenticationProvider = createAuthenticationProvider(authTokenProvider)
            const connection = mockConnection()

            await authenticationProvider.authenticate({ connection })

            expect(authTokenProvider).toHaveBeenCalledTimes(1)
          })

          it('should refresh authToken only once', async () => {
            const authTokenProvider = jest.fn(() => new Promise((resolve) => {
              setTimeout(() => {
                resolve(toRenewableToken({ scheme: 'none' }))
              }, 100)
            }))

            const authenticationProvider = createAuthenticationProvider(authTokenProvider)
            const connections = [mockConnection(), mockConnection()]

            await Promise.all(connections.map(connection => authenticationProvider.authenticate({ connection })))

            expect(authTokenProvider).toHaveBeenCalledTimes(1)
          })

          it('should return the connection', async () => {
            const authTokenProvider = jest.fn(() => toRenewableToken({ scheme: 'none' }))
            const authenticationProvider = createAuthenticationProvider(authTokenProvider)
            const connection = mockConnection()

            const resultedConnection = await authenticationProvider.authenticate({ connection })

            expect(resultedConnection).toBe(connection)
          })

          it('should not call connection.connect', async () => {
            const authTokenProvider = jest.fn(() => toRenewableToken({ scheme: 'none' }))
            const authenticationProvider = createAuthenticationProvider(authTokenProvider)
            const connection = mockConnection({ authToken: { scheme: 'none' } })

            await authenticationProvider.authenticate({ connection })

            expect(connection.connect).toHaveBeenCalledTimes(0)
          })

          it('should throw errors happened during token refresh', async () => {
            const error = new Error('ops')
            const authTokenProvider = jest.fn(() => Promise.reject(error))
            const authenticationProvider = createAuthenticationProvider(authTokenProvider)
            const connection = mockConnection()

            await expect(authenticationProvider.authenticate({ connection })).rejects.toThrow(error)
          })
        })
      })

      describe('and token has expired', () => {
        describe('and connection.authToken is different of new AuthToken', () => {
          it('should refresh the auth token', async () => {
            const authTokenProvider = jest.fn(() => toRenewableToken({ scheme: 'none' }))
            const authenticationProvider = createAuthenticationProvider(authTokenProvider, {
              renewableAuthToken: toExpiredRenewableToken({ scheme: 'none' })
            })
            const connection = mockConnection()

            await authenticationProvider.authenticate({ connection })

            expect(authTokenProvider).toHaveBeenCalledTimes(1)
          })

          it('should refresh authToken only once', async () => {
            const authTokenProvider = jest.fn(() => new Promise((resolve) => {
              setTimeout(() => {
                resolve(toRenewableToken({ scheme: 'none' }))
              }, 100)
            }))

            const authenticationProvider = createAuthenticationProvider(authTokenProvider)
            const connections = [mockConnection(), mockConnection()]

            await Promise.all(connections.map(connection => authenticationProvider.authenticate({ connection })))

            expect(authTokenProvider).toHaveBeenCalledTimes(1)
          })

          it('should return the connection', async () => {
            const authTokenProvider = jest.fn(() => toRenewableToken({ scheme: 'none' }))
            const authenticationProvider = createAuthenticationProvider(authTokenProvider, {
              renewableAuthToken: toExpiredRenewableToken({ scheme: 'none' })
            })
            const connection = mockConnection()

            const resultedConnection = await authenticationProvider.authenticate({ connection })

            expect(resultedConnection).toBe(connection)
          })

          it('should call connection.connect', async () => {
            const authToken = { scheme: 'none' }
            const authTokenProvider = jest.fn(() => toRenewableToken(authToken))
            const authenticationProvider = createAuthenticationProvider(authTokenProvider, {
              renewableAuthToken: toExpiredRenewableToken({ scheme: 'none' })
            })
            const connection = mockConnection()

            await authenticationProvider.authenticate({ connection })

            expect(connection.connect).toHaveBeenCalledWith(USER_AGENT, authToken)
          })

          it('should throw errors happened during token refresh', async () => {
            const error = new Error('ops')
            const authTokenProvider = jest.fn(() => Promise.reject(error))
            const authenticationProvider = createAuthenticationProvider(authTokenProvider, {
              renewableAuthToken: toExpiredRenewableToken({ scheme: 'none' })
            })
            const connection = mockConnection()

            await expect(authenticationProvider.authenticate({ connection })).rejects.toThrow(error)
          })

          it('should throw errors happened during connection.connect', async () => {
            const error = new Error('ops')
            const authTokenProvider = jest.fn(() => toRenewableToken({ scheme: 'none' }))
            const authenticationProvider = createAuthenticationProvider(authTokenProvider, {
              renewableAuthToken: toExpiredRenewableToken({ scheme: 'none' })
            })
            const connection = mockConnection({
              connect: () => Promise.reject(error)
            })

            await expect(authenticationProvider.authenticate({ connection })).rejects.toThrow(error)
          })
        })

        describe('when connection.authToken is equal to new AuthToken', () => {
          it('should refresh the auth token', async () => {
            const authTokenProvider = jest.fn(() => toRenewableToken({ scheme: 'none' }))
            const authenticationProvider = createAuthenticationProvider(authTokenProvider, {
              renewableAuthToken: toExpiredRenewableToken({ scheme: 'none' })
            })
            const connection = mockConnection()

            await authenticationProvider.authenticate({ connection })

            expect(authTokenProvider).toHaveBeenCalledTimes(1)
          })

          it('should refresh authToken only once', async () => {
            const authTokenProvider = jest.fn(() => new Promise((resolve) => {
              setTimeout(() => {
                resolve(toRenewableToken({ scheme: 'none' }))
              }, 100)
            }))

            const authenticationProvider = createAuthenticationProvider(authTokenProvider)
            const connections = [mockConnection(), mockConnection()]

            await Promise.all(connections.map(connection => authenticationProvider.authenticate({ connection })))

            expect(authTokenProvider).toHaveBeenCalledTimes(1)
          })

          it('should return the connection', async () => {
            const authTokenProvider = jest.fn(() => toRenewableToken({ scheme: 'none' }))
            const authenticationProvider = createAuthenticationProvider(authTokenProvider, {
              renewableAuthToken: toExpiredRenewableToken({ scheme: 'none' })
            })
            const connection = mockConnection()

            const resultedConnection = await authenticationProvider.authenticate({ connection })

            expect(resultedConnection).toBe(connection)
          })

          it('should not call connection.connect', async () => {
            const authTokenProvider = jest.fn(() => toRenewableToken({ scheme: 'none' }))
            const authenticationProvider = createAuthenticationProvider(authTokenProvider, {
              renewableAuthToken: toExpiredRenewableToken({ scheme: 'none' })
            })
            const connection = mockConnection({ authToken: { scheme: 'none' } })

            await authenticationProvider.authenticate({ connection })

            expect(connection.connect).toHaveBeenCalledTimes(0)
          })

          it('should throw errors happened during token refresh', async () => {
            const error = new Error('ops')
            const authTokenProvider = jest.fn(() => Promise.reject(error))
            const authenticationProvider = createAuthenticationProvider(authTokenProvider, {
              renewableAuthToken: toExpiredRenewableToken({ scheme: 'none' })
            })
            const connection = mockConnection()

            await expect(authenticationProvider.authenticate({ connection })).rejects.toThrow(error)
          })
        })
      })

      describe('and token is not expired', () => {
        describe('and connection.authToken is different of provider.authToken', () => {
          it('should not refresh the auth token', async () => {
            const authTokenProvider = jest.fn(() => toRenewableToken({}))
            const authenticationProvider = createAuthenticationProvider(authTokenProvider, {
              renewableAuthToken: toRenewableToken({ scheme: 'none' })
            })
            const connection = mockConnection()

            await authenticationProvider.authenticate({ connection })

            expect(authTokenProvider).toHaveBeenCalledTimes(0)
          })

          it('should return the connection', async () => {
            const authTokenProvider = jest.fn(() => toRenewableToken({}))
            const authenticationProvider = createAuthenticationProvider(authTokenProvider, {
              renewableAuthToken: toRenewableToken({ scheme: 'none' })
            })
            const connection = mockConnection()

            const resultedConnection = await authenticationProvider.authenticate({ connection })

            expect(resultedConnection).toBe(connection)
          })

          it('should call connection.connect', async () => {
            const authToken = { scheme: 'none' }
            const authTokenProvider = jest.fn(() => toRenewableToken({}))
            const authenticationProvider = createAuthenticationProvider(authTokenProvider, {
              renewableAuthToken: toRenewableToken({ scheme: 'none' })
            })
            const connection = mockConnection()

            await authenticationProvider.authenticate({ connection })

            expect(connection.connect).toHaveBeenCalledWith(USER_AGENT, authToken)
          })

          it('should throw errors happened during connection.connect', async () => {
            const error = new Error('ops')
            const authTokenProvider = jest.fn(() => toRenewableToken({}))
            const authenticationProvider = createAuthenticationProvider(authTokenProvider, {
              renewableAuthToken: toRenewableToken({ scheme: 'none' })
            })
            const connection = mockConnection({
              connect: () => Promise.reject(error)
            })

            await expect(authenticationProvider.authenticate({ connection })).rejects.toThrow(error)
          })
        })

        describe('when connection.authToken is equal to provider.authToken', () => {
          it('should not refresh the auth token', async () => {
            const authTokenProvider = jest.fn(() => toRenewableToken({}))
            const authenticationProvider = createAuthenticationProvider(authTokenProvider, {
              renewableAuthToken: toRenewableToken({ scheme: 'none' })
            })
            const connection = mockConnection()

            await authenticationProvider.authenticate({ connection })

            expect(authTokenProvider).toHaveBeenCalledTimes(0)
          })

          it('should return the connection', async () => {
            const authTokenProvider = jest.fn(() => toRenewableToken({}))
            const authenticationProvider = createAuthenticationProvider(authTokenProvider, {
              renewableAuthToken: toRenewableToken({ scheme: 'none' })
            })
            const connection = mockConnection()

            const resultedConnection = await authenticationProvider.authenticate({ connection })

            expect(resultedConnection).toBe(connection)
          })

          it('should not call connection.connect', async () => {
            const authTokenProvider = jest.fn(() => toRenewableToken({}))
            const authenticationProvider = createAuthenticationProvider(authTokenProvider, {
              renewableAuthToken: toRenewableToken({ scheme: 'none' })
            })
            const connection = mockConnection({ authToken: { scheme: 'none' } })

            await authenticationProvider.authenticate({ connection })

            expect(connection.connect).toHaveBeenCalledTimes(0)
          })
        })
      })
    })
  })

  function createAuthenticationProvider (authTokenProvider, mocks) {
    const provider = new AuthenticationProvider({
      authTokenProvider,
      userAgent: USER_AGENT
    })

    if (mocks) {
      provider._renewableAuthToken = mocks.renewableAuthToken
    }

    return provider
  }

  function mockConnection ({ connect, authToken, supportsReAuth } = {}) {
    const connection = {
      connect: connect || jest.fn(() => Promise.resolve(connection)),
      authToken,
      supportsReAuth
    }
    return connection
  }

  function toRenewableToken (authToken, expectedExpirationTime) {
    return {
      authToken,
      expectedExpirationTime
    }
  }

  function toExpiredRenewableToken (authToken) {
    return {
      authToken,
      expectedExpirationTime: new Date(new Date().getTime() - 1)
    }
  }
})
