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
/* eslint-disable @typescript-eslint/promise-function-async */
import { bookmarkManager, ConnectionProvider, newError, NotificationFilter, notificationFilter, ServerInfo, Session } from '../src'
import Driver, { READ } from '../src/driver'
import { Bookmarks } from '../src/internal/bookmarks'
import { Logger } from '../src/internal/logger'
import { ConfiguredCustomResolver } from '../src/internal/resolver'
import { LogLevel } from '../src/types'

describe('Driver', () => {
  let driver: Driver | null
  let connectionProvider: ConnectionProvider
  let createSession: any
  const META_INFO = {
    routing: false,
    typename: '',
    address: 'localhost'
  }
  const CONFIG = {}

  beforeEach(() => {
    connectionProvider = new ConnectionProvider()
    connectionProvider.close = jest.fn(() => Promise.resolve())
    createSession = jest.fn(args => new Session(args))
    driver = new Driver(
      META_INFO,
      CONFIG,
      mockCreateConnectonProvider(connectionProvider),
      createSession
    )
  })

  afterEach(async () => {
    if (driver != null) {
      await driver.close()
      driver = null
    }
  })

  describe('.session()', () => {
    it('should create the session with impersonated user', () => {
      const impersonatedUser = 'the impostor'

      const session = driver?.session({ impersonatedUser })

      expect(session).not.toBeUndefined()
      expect(createSession).toHaveBeenCalledWith(expectedSessionParams({ impersonatedUser }))
    })

    it('should create the session without impersonated user', () => {
      const session = driver?.session()

      expect(session).not.toBeUndefined()
      expect(createSession).toHaveBeenCalledWith(expectedSessionParams())
    })

    it.each([
      [undefined, Bookmarks.empty()],
      [null, Bookmarks.empty()],
      ['bookmark', new Bookmarks('bookmark')],
      [['bookmark'], new Bookmarks(['bookmark'])],
      [['bookmark1', 'bookmark2'], new Bookmarks(['bookmark1', 'bookmark2'])]
    ])('should create session using param bookmarks', (bookmarks, expectedBookmarks) => {
      // @ts-expect-error
      const session = driver?.session({ bookmarks })

      expect(session?.lastBookmarks()).toEqual(expectedBookmarks.values())
    })

    describe('when bookmark manager configured', () => {
      it('should create session with bookmark manager when no bookmark set', async () => {
        const manager = bookmarkManager()
        const driver = new Driver(
          META_INFO,
          { ...CONFIG },
          mockCreateConnectonProvider(connectionProvider),
          createSession
        )

        const session = driver.session({ bookmarkManager: manager })

        try {
          expect(createSession).toBeCalledWith(expect.objectContaining({
            bookmarkManager: manager,
            bookmarks: Bookmarks.empty()
          }))
        } finally {
          await session.close()
          await driver.close()
        }
      })

      it.each([
        [[], Bookmarks.empty()],
        ['bookmark', new Bookmarks('bookmark')],
        [['bookmark'], new Bookmarks(['bookmark'])],
        [['bookmark1', 'bookmark2'], new Bookmarks(['bookmark1', 'bookmark2'])]
      ])('should create session with bookmark manager when bookmark set', async (bookmarks, expectedBookmarks) => {
        const manager = bookmarkManager()
        const driver = new Driver(
          META_INFO,
          { ...CONFIG },
          mockCreateConnectonProvider(connectionProvider),
          createSession
        )

        const session = driver.session({ bookmarks, bookmarkManager: manager })

        try {
          expect(createSession).toBeCalledWith(expect.objectContaining({
            bookmarkManager: manager,
            bookmarks: expectedBookmarks
          }))
        } finally {
          await session.close()
          await driver.close()
        }
      })

      it('should create session without bookmark manager when no bookmark manager is set', async () => {
        const driver = new Driver(
          META_INFO,
          { ...CONFIG },
          mockCreateConnectonProvider(connectionProvider),
          createSession
        )

        const session = driver.session()

        try {
          expect(createSession).toBeCalledWith(expect.objectContaining({
            bookmarkManager: undefined,
            bookmarks: Bookmarks.empty()
          }))
        } finally {
          await session.close()
          await driver.close()
        }
      })
    })

    describe('when set config.notificationFilters', () => {
      it.each([
        [],
        undefined,
        notificationFilter.disabled(),
        notificationFilter.serverDefault(),
        [notificationFilter.ALL.ALL, notificationFilter.INFORMATION.GENERIC],
        ['WARNING.QUERY', 'INFORMATION.GENERIC']
      ])('should send valid "notificationFilters" to the session', async (notificationFilters?: NotificationFilter[]) => {
        const driver = new Driver(
          META_INFO,
          { ...CONFIG },
          mockCreateConnectonProvider(connectionProvider),
          createSession
        )

        const session = driver.session({ notificationFilters })

        try {
          expect(createSession).toBeCalledWith(expect.objectContaining({
            notificationFilters
          }))
        } finally {
          await session.close()
          await driver.close()
        }
      })

      it.each([
        notificationFilter.ALL.DEPRECATION,
        'WARNING.QUERY',
        'INFO',
        1234,
        { 'WARNING.QUERY': notificationFilter.WARNING.QUERY },
        () => [notificationFilter.ALL.DEPRECATION]
      ])('should thrown when "notificationFilters" is not an array', async (notificationFilters?: any) => {
        const driver = new Driver(
          META_INFO,
          { ...CONFIG },
          mockCreateConnectonProvider(connectionProvider),
          createSession
        )

        try {
          expect(() => driver.session({ notificationFilters })).toThrow(new TypeError('Expect "notificationFilters" to be instance of Array<NotificationFilter>.'))
        } finally {
          await driver.close()
        }
      })

      it('should throw when "NONE" is configured with other filters', async () => {
        const driver = new Driver(
          META_INFO,
          { ...CONFIG },
          mockCreateConnectonProvider(connectionProvider),
          createSession
        )

        try {
          expect(() => driver.session({ notificationFilters: ['NONE', 'ALL.DEPRECATION'] }))
            .toThrow(new Error('Expect "notificationFilters" to not have "NONE" configured along with other filters.'))
        } finally {
          await driver.close()
        }
      })

      it('should throw when "SERVER_DEFAULT" is configured with other filters', async () => {
        const driver = new Driver(
          META_INFO,
          { ...CONFIG },
          mockCreateConnectonProvider(connectionProvider),
          createSession
        )

        try {
          expect(() => driver.session({ notificationFilters: ['SERVER_DEFAULT', 'ALL.DEPRECATION'] }))
            .toThrow(new Error('Expect "notificationFilters" to not have "SERVER_DEFAULT" configured along with other filters.'))
        } finally {
          await driver.close()
        }
      })

      it('should throw when invalid filters are configured', async () => {
        const driver = new Driver(
          META_INFO,
          { ...CONFIG },
          mockCreateConnectonProvider(connectionProvider),
          createSession
        )

        try {
          // @ts-expect-error
          expect(() => driver.session({ notificationFilters: ['ALL.DEPRECATION', 'ABC', 123] }))
            .toThrow(new Error('Invalid "notificationFilters". Invalid values: "ABC", 123'))
        } finally {
          await driver.close()
        }
      })
    })
  })

  it.each([
    ['Promise.resolve(true)', Promise.resolve(true)],
    ['Promise.resolve(false)', Promise.resolve(false)],
    [
      "Promise.reject(newError('something went wrong'))",
      Promise.reject(newError('something went wrong'))
    ]
  ])('.supportsMultiDb() => %s', (_, expectedPromise) => {
    connectionProvider.supportsMultiDb = jest.fn(() => expectedPromise)

    const promise: Promise<boolean> | undefined = driver?.supportsMultiDb()

    expect(promise).toBe(expectedPromise)

    promise?.catch(_ => 'Do nothing').finally(() => {})
  })

  it.each([
    ['Promise.resolve(true)', Promise.resolve(true)],
    ['Promise.resolve(false)', Promise.resolve(false)],
    [
      "Promise.reject(newError('something went wrong'))",
      Promise.reject(newError('something went wrong'))
    ]
  ])('.supportsTransactionConfig() => %s', (_, expectedPromise) => {
    connectionProvider.supportsTransactionConfig = jest.fn(
      () => expectedPromise
    )

    const promise: Promise<boolean> | undefined = driver?.supportsTransactionConfig()

    expect(promise).toBe(expectedPromise)

    promise?.catch(_ => 'Do nothing').finally(() => {})
  })

  it.each([
    ['Promise.resolve(true)', Promise.resolve(true)],
    ['Promise.resolve(false)', Promise.resolve(false)],
    [
      "Promise.reject(newError('something went wrong'))",
      Promise.reject(newError('something went wrong'))
    ]
  ])('.supportsUserImpersonation() => %s', (_, expectedPromise) => {
    connectionProvider.supportsUserImpersonation = jest.fn(
      () => expectedPromise
    )

    const promise: Promise<boolean> | undefined = driver?.supportsUserImpersonation()

    expect(promise).toBe(expectedPromise)

    promise?.catch(_ => 'Do nothing').finally(() => {})
  })

  it.each([
    [{ encrypted: true }, true],
    [{ encrypted: false }, false],
    [{}, false],
    [{ encrypted: 'ENCRYPTION_ON' }, true],
    [{ encrypted: 'ENCRYPTION_OFF' }, false]
  ])('.isEncrypted()', (config, expectedValue) => {
    const connectionProvider = new ConnectionProvider()
    connectionProvider.close = jest.fn(() => Promise.resolve())
    // @ts-expect-error
    const driver = new Driver(META_INFO, config, mockCreateConnectonProvider(connectionProvider))

    expect(driver.isEncrypted()).toEqual(expectedValue)
  })

  it.each([
    [{ connectionTimeout: 30000, connectionAcquisitionTimeout: 60000 }, true],
    [{ connectionTimeout: null, connectionAcquisitionTimeout: 60000 }, true],
    [{ connectionTimeout: 30000, connectionAcquisitionTimeout: null }, true],
    [{ connectionTimeout: null, connectionAcquisitionTimeout: null }, true],
    [{ connectionAcquisitionTimeout: 60000 }, true],
    [{ connectionTimeout: 30000 }, true],
    [{}, true],
    [{ connectionTimeout: 30000, connectionAcquisitionTimeout: 20000 }, false],
    [{ connectionAcquisitionTimeout: 20000 }, false],
    [{ connectionTimeout: 70000 }, false],
    // No connection timeouts should be considered valid, since it means
    // the user doesn't case about the connection timeout at all.
    [{ connectionTimeout: 0, connectionAcquisitionTimeout: 2000 }, true],
    [{ connectionTimeout: -1, connectionAcquisitionTimeout: 2000 }, true]
  ])('should emit warning if `connectionAcquisitionTimeout` and `connectionTimeout` are conflicting. [%o} ', async (config, valid) => {
    const logging = {
      level: 'warn' as LogLevel,
      logger: jest.fn()
    }

    const driver = new Driver(META_INFO, { ...config, logging }, mockCreateConnectonProvider(new ConnectionProvider()), createSession)

    if (valid) {
      expect(logging.logger).not.toHaveBeenCalled()
    } else {
      expect(logging.logger).toHaveBeenCalledWith(
        'warn',
        'Configuration for "connectionAcquisitionTimeout" should be greater than ' +
        'or equal to "connectionTimeout". Otherwise, the connection acquisition ' +
        'timeout will take precedence for over the connection timeout in scenarios ' +
        'where a new connection is created while it is acquired'
      )
    }

    await driver.close()
  })

  it.each([
    [undefined, 'Promise.resolve(ServerInfo>)', Promise.resolve(new ServerInfo())],
    [undefined, 'Promise.reject(Error)', Promise.reject(newError('something went wrong'))],
    [{}, 'Promise.resolve(ServerInfo>)', Promise.resolve(new ServerInfo())],
    [{}, 'Promise.reject(Error)', Promise.reject(newError('something went wrong'))],
    [{ database: undefined }, 'Promise.resolve(ServerInfo>)', Promise.resolve(new ServerInfo())],
    [{ database: undefined }, 'Promise.reject(Error)', Promise.reject(newError('something went wrong'))],
    [{ database: 'db' }, 'Promise.resolve(ServerInfo>)', Promise.resolve(new ServerInfo())],
    [{ database: 'db' }, 'Promise.reject(Error)', Promise.reject(newError('something went wrong'))]
  ])('.verifyConnectivity(%o) => %s', (input: { database?: string } | undefined, _, expectedPromise) => {
    connectionProvider.verifyConnectivityAndGetServerInfo = jest.fn(() => expectedPromise)

    const promise: Promise<ServerInfo> | undefined = driver?.verifyConnectivity(input)

    expect(promise).toBe(expectedPromise)
    expect(connectionProvider.verifyConnectivityAndGetServerInfo)
      .toBeCalledWith({ database: input?.database ?? '', accessMode: READ })

    promise?.catch(_ => 'Do nothing').finally(() => { })
  })

  it.each([
    [undefined, 'Promise.resolve(ServerInfo>)', Promise.resolve(new ServerInfo())],
    [undefined, 'Promise.reject(Error)', Promise.reject(newError('something went wrong'))],
    [{}, 'Promise.resolve(ServerInfo>)', Promise.resolve(new ServerInfo())],
    [{}, 'Promise.reject(Error)', Promise.reject(newError('something went wrong'))],
    [{ database: undefined }, 'Promise.resolve(ServerInfo>)', Promise.resolve(new ServerInfo())],
    [{ database: undefined }, 'Promise.reject(Error)', Promise.reject(newError('something went wrong'))],
    [{ database: 'db' }, 'Promise.resolve(ServerInfo>)', Promise.resolve(new ServerInfo())],
    [{ database: 'db' }, 'Promise.reject(Error)', Promise.reject(newError('something went wrong'))]
  ])('.getServerInfo(%o) => %s', (input: { database?: string } | undefined, _, expectedPromise) => {
    connectionProvider.verifyConnectivityAndGetServerInfo = jest.fn(() => expectedPromise)

    const promise: Promise<ServerInfo> | undefined = driver?.getServerInfo(input)

    expect(promise).toBe(expectedPromise)
    expect(connectionProvider.verifyConnectivityAndGetServerInfo)
      .toBeCalledWith({ database: input?.database ?? '', accessMode: READ })

    promise?.catch(_ => 'Do nothing').finally(() => { })
  })

  describe('constructor', () => {
    describe('when set config.notificationFilters', () => {
      it.each([
        [],
        undefined,
        notificationFilter.disabled(),
        notificationFilter.serverDefault(),
        [notificationFilter.ALL.ALL, notificationFilter.INFORMATION.GENERIC],
        ['WARNING.QUERY', 'INFORMATION.GENERIC']
      ])('should send valid "notificationFilters" to the connection provider', async (notificationFilters?: NotificationFilter[]) => {
        const createConnectionProviderMock = jest.fn(mockCreateConnectonProvider(connectionProvider))
        const driver = new Driver(
          META_INFO,
          { notificationFilters },
          createConnectionProviderMock,
          createSession
        )

        driver._getOrCreateConnectionProvider()

        expect(createConnectionProviderMock).toHaveBeenCalledWith(
          expect.any(Number),
          expect.objectContaining({ notificationFilters }),
          expect.any(Object),
          expect.any(Object)
        )

        await driver.close()
      })

      it.each([
        notificationFilter.ALL.DEPRECATION,
        'WARNING.QUERY',
        'INFO',
        1234,
        { 'WARNING.QUERY': notificationFilter.WARNING.QUERY },
        () => [notificationFilter.ALL.DEPRECATION]
      ])('should thrown when "notificationFilters" is not an array', async (notificationFilters?: any) => {
        const createConnectionProviderMock = mockCreateConnectonProvider(connectionProvider)

        expect(() => new Driver(
          META_INFO,
          { notificationFilters },
          createConnectionProviderMock,
          createSession
        )).toThrow(new TypeError('Expect "notificationFilters" to be instance of Array<NotificationFilter>.'))
      })

      it('should throw when "NONE" is configured with other filters', async () => {
        const createConnectionProviderMock = mockCreateConnectonProvider(connectionProvider)

        expect(() => new Driver(
          META_INFO,
          { notificationFilters: ['NONE', 'ALL.DEPRECATION'] },
          createConnectionProviderMock,
          createSession
        )).toThrow(new Error('Expect "notificationFilters" to not have "NONE" configured along with other filters.'))
      })

      it('should throw when "SERVER_DEFAULT" is configured with other filters', async () => {
        const createConnectionProviderMock = mockCreateConnectonProvider(connectionProvider)

        expect(() => new Driver(
          META_INFO,
          { notificationFilters: ['ALL.DEPRECATION', 'SERVER_DEFAULT'] },
          createConnectionProviderMock,
          createSession
        )).toThrow(new Error('Expect "notificationFilters" to not have "SERVER_DEFAULT" configured along with other filters.'))
      })

      it('should throw when invalid filters are configured', async () => {
        const createConnectionProviderMock = mockCreateConnectonProvider(connectionProvider)

        expect(() => new Driver(
          META_INFO,
          // @ts-expect-error
          { notificationFilters: ['ALL.DEPRECATION', 'ABC', 123] },
          createConnectionProviderMock,
          createSession
        )).toThrow(new Error('Invalid "notificationFilters". Invalid values: "ABC", 123'))
      })
    })
  })

  function mockCreateConnectonProvider (connectionProvider: ConnectionProvider) {
    return (
      id: number,
      config: Object,
      log: Logger,
      hostNameResolver: ConfiguredCustomResolver
    ) => connectionProvider
  }

  function expectedSessionParams (extra: any = {}): any {
    return {
      bookmarks: Bookmarks.empty(),
      config: {
        connectionAcquisitionTimeout: 60000,
        fetchSize: 1000,
        maxConnectionLifetime: 3600000,
        maxConnectionPoolSize: 100,
        connectionTimeout: 30000
      },
      connectionProvider,
      database: '',
      fetchSize: 1000,
      mode: 'WRITE',
      reactive: false,
      impersonatedUser: undefined,
      ...extra
    }
  }
})
