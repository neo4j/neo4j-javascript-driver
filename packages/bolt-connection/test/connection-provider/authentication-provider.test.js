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
import { expirationBasedAuthTokenManager } from 'neo4j-driver-core'
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

    describe.each([
      ['and first call', createAuthenticationProvider],
      ['and token has expired', (authTokenProvider) => createAuthenticationProvider(authTokenProvider, {
        renewableAuthToken: toExpiredRenewableToken({ scheme: 'none', credentials: 'token expired' })
      })],
      ['and toke is not expired', (authTokenProvider) => createAuthenticationProvider(authTokenProvider, {
        renewableAuthToken: toExpiredRenewableToken({ scheme: 'none' })
      })]
    ])('when called with an auth and %s', (_, createAuthenticationProvider) => {
      describe.each([false, true])('and connection is not authenticated (supportsReAuth=%s)', (supportsReAuth) => {
        it('should call connection connect with the supplied auth', async () => {
          const auth = { scheme: 'bearer', credentials: 'my token' }
          const authTokenProvider = jest.fn(() => toRenewableToken({}))
          const authenticationProvider = createAuthenticationProvider(authTokenProvider)
          const connection = mockConnection({ supportsReAuth })

          await authenticationProvider.authenticate({ connection, auth })

          expect(connection.connect).toHaveBeenCalledWith(USER_AGENT, auth, false)
        })

        it('should return the connection', async () => {
          const auth = { scheme: 'bearer', credentials: 'my token' }
          const authTokenProvider = jest.fn(() => toRenewableToken({}))
          const authenticationProvider = createAuthenticationProvider(authTokenProvider)
          const connection = mockConnection({ supportsReAuth })

          await expect(authenticationProvider.authenticate({ connection, auth })).resolves.toBe(connection)
        })

        it('should not refresh the token', async () => {
          const auth = { scheme: 'bearer', credentials: 'my token' }
          const authTokenProvider = jest.fn(() => toRenewableToken({}))
          const authenticationProvider = createAuthenticationProvider(authTokenProvider)
          const connection = mockConnection({ supportsReAuth })

          await authenticationProvider.authenticate({ connection, auth })

          expect(authTokenProvider).not.toHaveBeenCalled()
        })

        it('should throws if connection fails', async () => {
          const error = new Error('nope')
          const auth = { scheme: 'bearer', credentials: 'my token' }
          const authTokenProvider = jest.fn(() => toRenewableToken({}))
          const authenticationProvider = createAuthenticationProvider(authTokenProvider)
          const connection = mockConnection({
            supportsReAuth,
            connect: jest.fn(() => Promise.reject(error))
          })

          await expect(authenticationProvider.authenticate({ connection, auth })).rejects.toThrow(error)
        })
      })

      describe.each([false, true])('and connection is authenticated with same token (supportsReAuth=%s)', (supportsReAuth) => {
        it('should not call connection connect with the supplied auth', async () => {
          const auth = { scheme: 'bearer', credentials: 'my token' }
          const authTokenProvider = jest.fn(() => toRenewableToken({}))
          const authenticationProvider = createAuthenticationProvider(authTokenProvider)
          const connection = mockConnection({ supportsReAuth, authToken: { ...auth } })

          await authenticationProvider.authenticate({ connection, auth })

          expect(connection.connect).not.toHaveBeenCalledWith(USER_AGENT, auth)
        })

        it('should not call connection connect with the supplied auth and skipReAuth=true', async () => {
          const auth = { scheme: 'bearer', credentials: 'my token' }
          const authTokenProvider = jest.fn(() => toRenewableToken({}))
          const authenticationProvider = createAuthenticationProvider(authTokenProvider)
          const connection = mockConnection({ supportsReAuth, authToken: { ...auth } })

          await authenticationProvider.authenticate({ connection, auth, skipReAuth: true })

          expect(connection.connect).not.toHaveBeenCalledWith(USER_AGENT, auth)
        })

        if (supportsReAuth) {
          it('should call connection connect with the supplied auth if forceReAuth=true', async () => {
            const auth = { scheme: 'bearer', credentials: 'my token' }
            const authTokenProvider = jest.fn(() => toRenewableToken({}))
            const authenticationProvider = createAuthenticationProvider(authTokenProvider)
            const connection = mockConnection({ supportsReAuth, authToken: { scheme: 'bearer', credentials: 'other' } })

            await authenticationProvider.authenticate({ connection, auth, forceReAuth: true })

            expect(connection.connect).toHaveBeenCalledWith(USER_AGENT, auth, false)
          })
        } else {
          it('should not call connection connect with the supplied auth if forceReAuth=true', async () => {
            const auth = { scheme: 'bearer', credentials: 'my token' }
            const authTokenProvider = jest.fn(() => toRenewableToken({}))
            const authenticationProvider = createAuthenticationProvider(authTokenProvider)
            const connection = mockConnection({ supportsReAuth, authToken: { ...auth } })

            await authenticationProvider.authenticate({ connection, auth, forceReAuth: true })

            expect(connection.connect).not.toHaveBeenCalledWith(USER_AGENT, auth)
          })
        }

        it('should return the connection', async () => {
          const auth = { scheme: 'bearer', credentials: 'my token' }
          const authTokenProvider = jest.fn(() => toRenewableToken({}))
          const authenticationProvider = createAuthenticationProvider(authTokenProvider)
          const connection = mockConnection({ supportsReAuth, authToken: { ...auth } })

          await expect(authenticationProvider.authenticate({ connection, auth })).resolves.toBe(connection)
        })

        it('should not refresh the token', async () => {
          const auth = { scheme: 'bearer', credentials: 'my token' }
          const authTokenProvider = jest.fn(() => toRenewableToken({}))
          const authenticationProvider = createAuthenticationProvider(authTokenProvider)
          const connection = mockConnection({ supportsReAuth, authToken: { ...auth } })

          await authenticationProvider.authenticate({ connection, auth })

          expect(authTokenProvider).not.toHaveBeenCalled()
        })
      })

      describe.each([true])('and connection is authenticated with different token (supportsReAuth=%s)', (supportsReAuth) => {
        it('should call connection connect with the supplied auth', async () => {
          const auth = { scheme: 'bearer', credentials: 'my token' }
          const authTokenProvider = jest.fn(() => toRenewableToken({}))
          const authenticationProvider = createAuthenticationProvider(authTokenProvider)
          const connection = mockConnection({ supportsReAuth, authToken: { scheme: 'bearer', credentials: 'other' } })

          await authenticationProvider.authenticate({ connection, auth })

          expect(connection.connect).toHaveBeenCalledWith(USER_AGENT, auth, false)
        })

        it('should return the connection', async () => {
          const auth = { scheme: 'bearer', credentials: 'my token' }
          const authTokenProvider = jest.fn(() => toRenewableToken({}))
          const authenticationProvider = createAuthenticationProvider(authTokenProvider)
          const connection = mockConnection({ supportsReAuth, authToken: { scheme: 'bearer', credentials: 'other' } })

          await expect(authenticationProvider.authenticate({ connection, auth })).resolves.toBe(connection)
        })

        it('should not refresh the token', async () => {
          const auth = { scheme: 'bearer', credentials: 'my token' }
          const authTokenProvider = jest.fn(() => toRenewableToken({}))
          const authenticationProvider = createAuthenticationProvider(authTokenProvider)
          const connection = mockConnection({ supportsReAuth, authToken: { scheme: 'bearer', credentials: 'other' } })

          await authenticationProvider.authenticate({ connection, auth })

          expect(authTokenProvider).not.toHaveBeenCalled()
        })

        it('should throws if connection fails', async () => {
          const error = new Error('nope')
          const auth = { scheme: 'bearer', credentials: 'my token' }
          const authTokenProvider = jest.fn(() => toRenewableToken({}))
          const authenticationProvider = createAuthenticationProvider(authTokenProvider)
          const connection = mockConnection({
            supportsReAuth,
            connect: jest.fn(() => Promise.reject(error)),
            authToken: { scheme: 'bearer', credentials: 'other' }
          })

          await expect(authenticationProvider.authenticate({ connection, auth })).rejects.toThrow(error)
        })

        it.each([
          [true, true],
          [false, false],
          [undefined, false],
          [null, false]
        ])('should redirect `waitReAuth=%s` as `%s` to the connection.connect()', async (waitReAuth, expectedWaitForReAuth) => {
          const auth = { scheme: 'bearer', credentials: 'my token' }
          const authTokenProvider = jest.fn(() => toRenewableToken({}))
          const authenticationProvider = createAuthenticationProvider(authTokenProvider)
          const connection = mockConnection({ supportsReAuth, authToken: { scheme: 'bearer', credentials: 'other' } })

          await authenticationProvider.authenticate({ connection, auth, waitReAuth })

          expect(connection.connect).toHaveBeenCalledWith(USER_AGENT, auth, expectedWaitForReAuth)
        })

        it('should not call connect when skipReAuth=true', async () => {
          const auth = { scheme: 'bearer', credentials: 'my token' }
          const authTokenProvider = jest.fn(() => toRenewableToken({}))
          const authenticationProvider = createAuthenticationProvider(authTokenProvider)
          const connection = mockConnection({ supportsReAuth, authToken: { scheme: 'bearer', credentials: 'other' } })

          await authenticationProvider.authenticate({ connection, auth, skipReAuth: true })

          expect(connection.connect).not.toBeCalled()
        })
      })

      describe.each([false])('and connection is authenticated with different token (supportsReAuth=%s)', (supportsReAuth) => {
        it('should not call connection connect with the supplied auth', async () => {
          const auth = { scheme: 'bearer', credentials: 'my token' }
          const authTokenProvider = jest.fn(() => toRenewableToken({}))
          const authenticationProvider = createAuthenticationProvider(authTokenProvider)
          const connection = mockConnection({ supportsReAuth, authToken: { ...auth, credentials: 'other' } })

          await authenticationProvider.authenticate({ connection, auth })

          expect(connection.connect).not.toHaveBeenCalledWith(USER_AGENT, auth)
        })

        it('should not call connection connect with the supplied auth and forceReAuth=true', async () => {
          const auth = { scheme: 'bearer', credentials: 'my token' }
          const authTokenProvider = jest.fn(() => toRenewableToken({}))
          const authenticationProvider = createAuthenticationProvider(authTokenProvider)
          const connection = mockConnection({ supportsReAuth, authToken: { ...auth, credentials: 'other' } })

          await authenticationProvider.authenticate({ connection, auth, forceReAuth: true })

          expect(connection.connect).not.toHaveBeenCalledWith(USER_AGENT, auth)
        })

        it('should return the connection', async () => {
          const auth = { scheme: 'bearer', credentials: 'my token' }
          const authTokenProvider = jest.fn(() => toRenewableToken({}))
          const authenticationProvider = createAuthenticationProvider(authTokenProvider)
          const connection = mockConnection({ supportsReAuth, authToken: { ...auth, credentials: 'other' } })

          await expect(authenticationProvider.authenticate({ connection, auth })).resolves.toBe(connection)
        })

        it('should not refresh the token', async () => {
          const auth = { scheme: 'bearer', credentials: 'my token' }
          const authTokenProvider = jest.fn(() => toRenewableToken({}))
          const authenticationProvider = createAuthenticationProvider(authTokenProvider)
          const connection = mockConnection({ supportsReAuth, authToken: { ...auth, credentials: 'other' } })

          await authenticationProvider.authenticate({ connection, auth })

          expect(authTokenProvider).not.toHaveBeenCalled()
        })
      })
    })
  })

  describe('.handleError()', () => {
    it.each(
      shouldNotScheduleRefreshScenarios()
    )('should not schedule a refresh when %s', (_, createScenario) => {
      const {
        connection,
        code,
        authTokenProvider,
        authenticationProvider
      } = createScenario()

      authenticationProvider.handleError({ code, connection })

      expect(authTokenProvider).not.toHaveBeenCalled()
    })

    it.each(
      errorCodeTriggerRefreshAuth()
    )('should schedule refresh when auth are the same, valid error code (%s) and no refresh schedule', async (code) => {
      const authToken = { scheme: 'bearer', credentials: 'token' }
      const newTokenPromiseState = {}
      const newTokenPromise = new Promise((resolve) => { newTokenPromiseState.resolve = resolve })
      const authTokenProvider = jest.fn(() => newTokenPromise)
      const renewableAuthToken = toRenewableToken(authToken)
      const connection = mockConnection({
        authToken: { ...authToken }
      })
      const authenticationProvider = createAuthenticationProvider(authTokenProvider, {
        renewableAuthToken
      })

      authenticationProvider.handleError({ code, connection })

      expect(authTokenProvider).toHaveBeenCalled()

      // Test implementation details
      expect(authenticationProvider._authTokenManager._currentAuthData).toEqual(undefined)

      const newRenewableToken = toRenewableToken({ scheme: 'bearer', credentials: 'token2' })
      newTokenPromiseState.resolve(newRenewableToken)

      await newTokenPromise

      expect(authenticationProvider._authTokenManager._currentAuthData).toBe(newRenewableToken)
    })

    function shouldNotScheduleRefreshScenarios () {
      return [
        ...nonValidCodesScenarios(),
        ...validCodesWithDifferentAuthScenarios(),
        ...nonValidCodesWithDifferentAuthScenarios(),
        ...validCodesWithSameAuthButWithRescheduleInPlaceScenarios()
      ]

      function nonValidCodesScenarios () {
        return [
          'Neo.ClientError.Security.AuthorizationExpired',
          'Neo.ClientError.General.ForbiddenOnReadOnlyDatabase',
          'Neo.Made.Up.Error'
        ].flatMap(code => [
          [
              `connection and provider has same auth token and error code does not trigger re-fresh (code=${code})`, () => {
                const authToken = { scheme: 'bearer', credentials: 'token' }
                const authTokenProvider = jest.fn(() => {})
                return {
                  connection: mockConnection({
                    authToken: { ...authToken }
                  }),
                  code,
                  authTokenProvider,
                  authenticationProvider: createAuthenticationProvider(authTokenProvider, {
                    renewableAuthToken: toRenewableToken(authToken)
                  })
                }
              }
          ]
        ])
      }

      function validCodesWithDifferentAuthScenarios () {
        return errorCodeTriggerRefreshAuth().flatMap(code => [
          [
            `connection and provider has different auth token and error code does trigger re-fresh (code=${code})`,
            () => {
              const authToken = { scheme: 'bearer', credentials: 'token' }
              const authTokenProvider = jest.fn(() => {})
              return {
                connection: mockConnection({
                  authToken: { ...authToken, credentials: 'token2' }
                }),
                code,
                authTokenProvider,
                authenticationProvider: createAuthenticationProvider(authTokenProvider, {
                  renewableAuthToken: toRenewableToken(authToken)
                })
              }
            }
          ]

        ])
      }

      function nonValidCodesWithDifferentAuthScenarios () {
        return [
          'Neo.ClientError.Security.AuthorizationExpired',
          'Neo.ClientError.General.ForbiddenOnReadOnlyDatabase',
          'Neo.Made.Up.Error'
        ].flatMap(code => [
          [
            `connection and provider has different auth token and error code does not trigger re-fresh (code=${code})`,
            () => {
              const authToken = { scheme: 'bearer', credentials: 'token' }
              const authTokenProvider = jest.fn(() => {})
              return {
                connection: mockConnection({
                  authToken: { ...authToken, credentials: 'token2' }
                }),
                code,
                authTokenProvider,
                authenticationProvider: createAuthenticationProvider(authTokenProvider, {
                  renewableAuthToken: toRenewableToken(authToken)
                })
              }
            }
          ]

        ])
      }

      function validCodesWithSameAuthButWithRescheduleInPlaceScenarios () {
        return errorCodeTriggerRefreshAuth().flatMap(code => [
          [
              `connection and provider has same auth token and error code does trigger re-fresh (code=${code}), but refresh already schedule`, () => {
                const authToken = { scheme: 'bearer', credentials: 'token' }
                const authTokenProvider = jest.fn(() => {})
                return {
                  connection: mockConnection({
                    authToken: { ...authToken }
                  }),
                  code,
                  authTokenProvider,
                  authenticationProvider: createAuthenticationProvider(authTokenProvider, {
                    renewableAuthToken: toRenewableToken(authToken),
                    refreshObserver: refreshObserverMock()
                  })
                }
              }
          ]
        ])
      }
    }
  })

  function createAuthenticationProvider (authTokenProvider, mocks) {
    const authTokenManager = expirationBasedAuthTokenManager({ tokenProvider: authTokenProvider })
    const provider = new AuthenticationProvider({
      authTokenManager,
      userAgent: USER_AGENT
    })

    if (mocks) {
      authTokenManager._currentAuthData = mocks.renewableAuthToken
      authTokenManager._refreshObservable = mocks.refreshObserver
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

  function toRenewableToken (token, expiration) {
    return {
      token,
      expiration
    }
  }

  function toExpiredRenewableToken (token) {
    return toRenewableToken(token, new Date(new Date().getTime() - 1))
  }

  function errorCodeTriggerRefreshAuth () {
    return [
      'Neo.ClientError.Security.Unauthorized',
      'Neo.ClientError.Security.TokenExpired'
    ]
  }

  function refreshObserverMock () {
    const subscribers = []

    return {
      subscribe: (sub) => subscribers.push(sub),
      onCompleted: (data) => subscribers.forEach(sub => sub.onCompleted(data)),
      onError: (e) => subscribers.forEach(sub => sub.onError(e))
    }
  }
})
