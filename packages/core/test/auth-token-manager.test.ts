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
import { auth } from '../src'
import AuthTokenManager, { AuthTokenAndExpiration, SecurityErrorCode, authTokenManagers } from '../src/auth-token-manager'
import { AuthToken } from '../src/types'

describe('authTokenManagers', () => {
  const SECURITY_ERROR_CODES = [
    'Neo.ClientError.Security.TokenExpired',
    'Neo.ClientError.Security.MadeUp',
    'Neo.ClientError.Security.AuthorizationExpired',
    'Neo.ClientError.Security.Unauthorized'
  ]

  describe('.basic()', () => {
    const BASIC_HANDLED_ERROR_CODES = Object.freeze(['Neo.ClientError.Security.Unauthorized'])
    const BASIC_NOT_HANDLED_ERROR_CODES = Object.freeze(SECURITY_ERROR_CODES.filter(code => !BASIC_HANDLED_ERROR_CODES.includes(code)))

    it.each([
      undefined,
      null,
      {},
      { tokenProvider: null },
      { tokenProvider: undefined },
      { tokenProvider: false },
      { tokenProvider: auth.basic('user', 'password') }
    ])('should throw when instantiate with wrong parameters (params=%o)', (param) => {
      // @ts-expect-error
      expect(() => authTokenManagers.basic(param)).toThrowError(TypeError)
    })

    it('should create an AuthTokenManager instance', () => {
      const basic: AuthTokenManager = authTokenManagers.basic({ tokenProvider: async () => auth.basic('user', 'password') })

      expect(basic).toBeDefined()
      expect(basic.getToken).toBeInstanceOf(Function)
      expect(basic.handleSecurityException).toBeInstanceOf(Function)
    })

    describe('.handleSecurityException()', () => {
      let basic: AuthTokenManager
      let tokenProvider: jest.Mock<Promise<AuthToken>>

      beforeEach(async () => {
        tokenProvider = jest.fn(async () => auth.basic('user', 'password'))
        basic = authTokenManagers.basic({ tokenProvider })
        // init auth token
        await basic.getToken()
        tokenProvider.mockReset()
      })

      describe.each(BASIC_HANDLED_ERROR_CODES)('when error code equals to "%s"', (code: SecurityErrorCode) => {
        describe('and same auth token', () => {
          const authToken = auth.basic('user', 'password')

          it('should call tokenProvider and return true', () => {
            const handled = basic.handleSecurityException(authToken, code)

            expect(handled).toBe(true)
            expect(tokenProvider).toHaveBeenCalled()
          })

          it('should call tokenProvider only if there is not an ongoing call', async () => {
            const promise = { resolve: (_: AuthToken) => { } }
            tokenProvider.mockReturnValue(new Promise<AuthToken>((resolve) => { promise.resolve = resolve }))

            expect(basic.handleSecurityException(authToken, code)).toBe(true)
            expect(tokenProvider).toHaveBeenCalled()

            await triggerEventLoop()

            expect(basic.handleSecurityException(authToken, code)).toBe(true)
            expect(tokenProvider).toHaveBeenCalledTimes(1)

            promise.resolve(authToken)
            await triggerEventLoop()

            expect(basic.handleSecurityException(authToken, code)).toBe(true)
            expect(tokenProvider).toHaveBeenCalledTimes(2)

            promise.resolve(authToken)
          })
        })

        describe('and different auth token', () => {
          const authToken = auth.basic('other_user', 'other_password')

          it('should return true and not call the provider', () => {
            const handled = basic.handleSecurityException(authToken, code)

            expect(handled).toBe(true)
            expect(tokenProvider).not.toHaveBeenCalled()
          })
        })
      })

      it.each(BASIC_NOT_HANDLED_ERROR_CODES)('should not handle "%s"', (code: SecurityErrorCode) => {
        const handled = basic.handleSecurityException(auth.basic('user', 'password'), code)

        expect(handled).toBe(false)
        expect(tokenProvider).not.toHaveBeenCalled()
      })
    })

    describe('.getToken()', () => {
      let basic: AuthTokenManager
      let tokenProvider: jest.Mock<Promise<AuthToken>>
      let authToken: AuthToken

      beforeEach(async () => {
        authToken = auth.basic('user', 'password')
        tokenProvider = jest.fn(async () => authToken)
        basic = authTokenManagers.basic({ tokenProvider })
      })

      it('should call tokenProvider once and return the provided token many times', async () => {
        await expect(basic.getToken()).resolves.toBe(authToken)

        expect(tokenProvider).toHaveBeenCalledTimes(1)

        await expect(basic.getToken()).resolves.toBe(authToken)
        await expect(basic.getToken()).resolves.toBe(authToken)

        expect(tokenProvider).toHaveBeenCalledTimes(1)
      })

      it.each(BASIC_HANDLED_ERROR_CODES)('should reflect the authToken refreshed by handleSecurityException(authToken, "%s")', async (code: SecurityErrorCode) => {
        const newAuthToken = auth.basic('other_user', 'other_password')
        await expect(basic.getToken()).resolves.toBe(authToken)

        expect(tokenProvider).toHaveBeenCalledTimes(1)

        tokenProvider.mockReturnValueOnce(Promise.resolve(newAuthToken))

        basic.handleSecurityException(authToken, code)
        expect(tokenProvider).toHaveBeenCalledTimes(2)

        await expect(basic.getToken()).resolves.toBe(newAuthToken)
        await expect(basic.getToken()).resolves.toBe(newAuthToken)

        expect(tokenProvider).toHaveBeenCalledTimes(2)
      })
    })
  })

  describe('.bearer()', () => {
    const BEARER_HANDLED_ERROR_CODES = Object.freeze(['Neo.ClientError.Security.Unauthorized', 'Neo.ClientError.Security.TokenExpired'])
    const BEARER_NOT_HANDLED_ERROR_CODES = Object.freeze(SECURITY_ERROR_CODES.filter(code => !BEARER_HANDLED_ERROR_CODES.includes(code)))

    it.each([
      undefined,
      null,
      {},
      { tokenProvider: null },
      { tokenProvider: undefined },
      { tokenProvider: false },
      { tokenProvider: auth.bearer('THE BEAR') }
    ])('should throw when instantiate with wrong parameters (params=%o)', (param) => {
      // @ts-expect-error
      expect(() => authTokenManagers.bearer(param)).toThrowError(TypeError)
    })

    it('should create an AuthTokenManager instance', () => {
      const bearer: AuthTokenManager = authTokenManagers.bearer({
        tokenProvider: async () => {
          return {
            token: auth.bearer('bearer my_bear')
          }
        }
      })

      expect(bearer).toBeDefined()
      expect(bearer.getToken).toBeInstanceOf(Function)
      expect(bearer.handleSecurityException).toBeInstanceOf(Function)
    })

    describe('.handleSecurityException()', () => {
      let bearer: AuthTokenManager
      let tokenProvider: jest.Mock<Promise<AuthTokenAndExpiration>>
      let authToken: AuthToken

      beforeEach(async () => {
        authToken = auth.bearer('bearer my_bear')
        tokenProvider = jest.fn(async () => ({ token: authToken }))
        bearer = authTokenManagers.bearer({ tokenProvider })
        // init auth token
        await bearer.getToken()
        tokenProvider.mockReset()
      })

      describe.each(BEARER_HANDLED_ERROR_CODES)('when error code equals to "%s"', (code: SecurityErrorCode) => {
        describe('and same auth token', () => {
          it('should call tokenProvider and return true', () => {
            const handled = bearer.handleSecurityException(authToken, code)

            expect(handled).toBe(true)
            expect(tokenProvider).toHaveBeenCalled()
          })

          it('should call tokenProvider only if there is not an ongoing call', async () => {
            const promise = { resolve: (_: AuthTokenAndExpiration) => { } }
            tokenProvider.mockReturnValue(new Promise<AuthTokenAndExpiration>((resolve) => { promise.resolve = resolve }))

            expect(bearer.handleSecurityException(authToken, code)).toBe(true)
            expect(tokenProvider).toHaveBeenCalled()

            await triggerEventLoop()

            expect(bearer.handleSecurityException(authToken, code)).toBe(true)
            expect(tokenProvider).toHaveBeenCalledTimes(1)

            promise.resolve({ token: authToken })
            await triggerEventLoop()

            expect(bearer.handleSecurityException(authToken, code)).toBe(true)
            expect(tokenProvider).toHaveBeenCalledTimes(2)

            promise.resolve({ token: authToken })
          })
        })

        describe('and different auth token', () => {
          const otherAuthToken = auth.bearer('bearer another_bear')

          it('should return true and not call the provider', () => {
            const handled = bearer.handleSecurityException(otherAuthToken, code)

            expect(handled).toBe(true)
            expect(tokenProvider).not.toHaveBeenCalled()
          })
        })
      })

      it.each(BEARER_NOT_HANDLED_ERROR_CODES)('should not handle "%s"', (code: SecurityErrorCode) => {
        const handled = bearer.handleSecurityException(authToken, code)

        expect(handled).toBe(false)
        expect(tokenProvider).not.toHaveBeenCalled()
      })
    })

    describe('.getToken()', () => {
      let bearer: AuthTokenManager
      let tokenProvider: jest.Mock<Promise<AuthTokenAndExpiration>>
      let authToken: AuthToken

      beforeEach(async () => {
        authToken = auth.bearer('bearer my_bear')
        tokenProvider = jest.fn(async () => ({ token: authToken }))
        bearer = authTokenManagers.bearer({ tokenProvider })
      })

      it('should call tokenProvider once and return the provided token many times', async () => {
        await expect(bearer.getToken()).resolves.toBe(authToken)

        expect(tokenProvider).toHaveBeenCalledTimes(1)

        await expect(bearer.getToken()).resolves.toBe(authToken)
        await expect(bearer.getToken()).resolves.toBe(authToken)

        expect(tokenProvider).toHaveBeenCalledTimes(1)
      })

      it.each(BEARER_HANDLED_ERROR_CODES)('should reflect the authToken refreshed by handleSecurityException(authToken, "%s")', async (code: SecurityErrorCode) => {
        const newAuthToken = auth.bearer('bearer another_bear')
        await expect(bearer.getToken()).resolves.toBe(authToken)

        expect(tokenProvider).toHaveBeenCalledTimes(1)

        tokenProvider.mockReturnValueOnce(Promise.resolve({ token: newAuthToken }))

        bearer.handleSecurityException(authToken, code)
        expect(tokenProvider).toHaveBeenCalledTimes(2)

        await expect(bearer.getToken()).resolves.toBe(newAuthToken)
        await expect(bearer.getToken()).resolves.toBe(newAuthToken)

        expect(tokenProvider).toHaveBeenCalledTimes(2)
      })
    })
  })
})

async function triggerEventLoop (): Promise<unknown> {
  return await new Promise(resolve => setTimeout(resolve, 0))
}
