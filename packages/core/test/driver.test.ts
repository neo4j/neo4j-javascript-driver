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
import { bookmarkManager, ConnectionProvider, EagerResult, newError, NotificationFilter, Result, ResultSummary, ServerInfo, Session } from '../src'
import Driver, { QueryConfig, READ, routing } from '../src/driver'
import { Bookmarks } from '../src/internal/bookmarks'
import { Logger } from '../src/internal/logger'
import QueryExecutor from '../src/internal/query-executor'
import { ConfiguredCustomResolver } from '../src/internal/resolver'
import { LogLevel } from '../src/types'
import resultTransformers from '../src/result-transformers'
import Record, { Dict } from '../src/record'
import { validNotificationFilters } from './utils/notification-filters.fixtures'

describe('Driver', () => {
  let driver: Driver | null
  let connectionProvider: ConnectionProvider
  let createSession: any
  let createQueryExecutor: any
  let queryExecutor: QueryExecutor
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
    createQueryExecutor = jest.fn((createSession) => {
      queryExecutor = new QueryExecutor(createSession)
      return queryExecutor
    })
    driver = new Driver(
      META_INFO,
      CONFIG,
      mockCreateConnectonProvider(connectionProvider),
      createSession,
      createQueryExecutor
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

    it('should create the session with auth', () => {
      const auth = {
        scheme: 'basic',
        principal: 'the imposter',
        credentials: 'super safe password'
      }

      const session = driver?.session({ auth })

      expect(session).not.toBeUndefined()
      expect(createSession).toHaveBeenCalledWith(expectedSessionParams({ auth }))
    })

    it('should create the session without auth', () => {
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
      it.each(
        validNotificationFilters()
      )('should send valid "notificationFilters" to the session', async (notificationFilter?: NotificationFilter) => {
        const driver = new Driver(
          META_INFO,
          { ...CONFIG },
          mockCreateConnectonProvider(connectionProvider),
          createSession
        )

        const session = driver.session({ notificationFilter })

        try {
          expect(createSession).toBeCalledWith(expect.objectContaining({
            notificationFilter
          }))
        } finally {
          await session.close()
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
    ['Promise.resolve(true)', Promise.resolve(true)],
    ['Promise.resolve(false)', Promise.resolve(false)],
    [
      "Promise.reject(newError('something went wrong'))",
      Promise.reject(newError('something went wrong'))
    ]
  ])('.supportsSessionAuth() => %s', (_, expectedPromise) => {
    connectionProvider.supportsSessionAuth = jest.fn(() => expectedPromise)

    const promise: Promise<boolean> | undefined = driver?.supportsSessionAuth()

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

  describe('.executeQuery()', () => {
    describe('when config is not defined', () => {
      it('should call executor with default params', async () => {
        const query = 'Query'
        const params = {}
        const spiedExecute = jest.spyOn(queryExecutor, 'execute')
        const expected: EagerResult = {
          keys: ['a'],
          records: [],
          summary: new ResultSummary(query, params, {}, 5.0)
        }
        spiedExecute.mockResolvedValue(expected)

        const eagerResult: EagerResult | undefined = await driver?.executeQuery(query, params)

        expect(eagerResult).toEqual(expected)
        expect(spiedExecute).toBeCalledWith({
          resultTransformer: resultTransformers.eagerResultTransformer(),
          bookmarkManager: driver?.executeQueryBookmarkManager,
          routing: routing.WRITE,
          database: undefined,
          impersonatedUser: undefined
        }, query, params)
      })

      it('should be able to destruct the result in records, keys and summary', async () => {
        const query = 'Query'
        const params = {}
        const spiedExecute = jest.spyOn(queryExecutor, 'execute')
        const expected: EagerResult = {
          keys: ['a'],
          records: [],
          summary: new ResultSummary(query, params, {}, 5.0)
        }
        spiedExecute.mockResolvedValue(expected)

        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const { records, keys, summary } = await driver!.executeQuery(query, params)

        expect(records).toEqual(expected.records)
        expect(keys).toEqual(expected.keys)
        expect(summary).toEqual(expected.summary)
        expect(spiedExecute).toBeCalledWith({
          resultTransformer: resultTransformers.eagerResultTransformer(),
          bookmarkManager: driver?.executeQueryBookmarkManager,
          routing: routing.WRITE,
          database: undefined,
          impersonatedUser: undefined
        }, query, params)
      })

      it('should be able get type-safe Records', async () => {
        interface Person {
          name: string
          age: number
        }

        const query = 'Query'
        const params = {}
        const spiedExecute = jest.spyOn(queryExecutor, 'execute')
        const expected: EagerResult = {
          keys: ['name', 'age'],
          records: [
            new Record(['name', 'age'], ['A Person', 25])
          ],
          summary: new ResultSummary(query, params, {}, 5.0)
        }
        spiedExecute.mockResolvedValue(expected)

        const eagerResult: EagerResult<Person> | undefined = await driver?.executeQuery(query, params)

        const [aPerson] = eagerResult?.records ?? []

        expect(aPerson).toBeDefined()
        if (aPerson != null) {
          expect(aPerson.get('name')).toEqual('A Person')
          expect(aPerson.get('age')).toEqual(25)
        } else {
          fail('aPerson should not be null')
        }

        const aObject: Person = aPerson.toObject()

        expect(aObject.name).toBe('A Person')
        expect(aObject.age).toBe(25)
      })
    })

    describe('when config is defined', () => {
      const theBookmarkManager = bookmarkManager()
      async function aTransformer (result: Result): Promise<string> {
        const summary = await result.summary()
        return summary.database.name ?? 'no-db-set'
      }

      it.each([
        ['empty config', 'the query', {}, {}, extendsDefaultWith({})],
        ['config.routing=WRITE', 'another query $s', { s: 'str' }, { routing: routing.WRITE }, extendsDefaultWith({ routing: routing.WRITE })],
        ['config.routing=READ', 'create num $d', { d: 1 }, { routing: routing.READ }, extendsDefaultWith({ routing: routing.READ })],
        ['config.database="dbname"', 'q', {}, { database: 'dbname' }, extendsDefaultWith({ database: 'dbname' })],
        ['config.impersonatedUser="the_user"', 'q', {}, { impersonatedUser: 'the_user' }, extendsDefaultWith({ impersonatedUser: 'the_user' })],
        ['config.bookmarkManager=null', 'q', {}, { bookmarkManager: null }, extendsDefaultWith({ bookmarkManager: undefined })],
        ['config.bookmarkManager set to non-null/empty', 'q', {}, { bookmarkManager: theBookmarkManager }, extendsDefaultWith({ bookmarkManager: theBookmarkManager })],
        ['config.resultTransformer set', 'q', {}, { resultTransformer: aTransformer }, extendsDefaultWith({ resultTransformer: aTransformer })]
      ])('should handle the params for %s', async (_, query, params, config, buildExpectedConfig) => {
        const spiedExecute = jest.spyOn(queryExecutor, 'execute')

        spiedExecute.mockResolvedValue(null)

        await driver?.executeQuery(query, params, config)

        expect(spiedExecute).toBeCalledWith(buildExpectedConfig(), query, params)
      })

      it('should handle correct type mapping for a custom result transformer', async () => {
        async function customResultMapper (result: Result): Promise<string> {
          return 'myMock'
        }
        const query = 'Query'
        const params = {}
        const spiedExecute = jest.spyOn(queryExecutor, 'execute')

        const expected: string = 'myMock'
        spiedExecute.mockResolvedValue(expected)

        const output: string | undefined = await driver?.executeQuery(query, params, {
          resultTransformer: customResultMapper
        })

        expect(output).toEqual(expected)
      })

      it('should explicity handle correct type mapping for a custom result transformer', async () => {
        async function customResultMapper (result: Result): Promise<string> {
          return 'myMock'
        }
        const query = 'Query'
        const params = {}
        const spiedExecute = jest.spyOn(queryExecutor, 'execute')

        const expected: string = 'myMock'
        spiedExecute.mockResolvedValue(expected)

        const output: string | undefined = await driver?.executeQuery<string>(query, params, {
          resultTransformer: customResultMapper
        })

        expect(output).toEqual(expected)
      })

      it('should validate the routing configuration', async () => {
        const expectedError = newError('Illegal query routing config: "GO FIGURE"')

        const query = 'Query'
        const params = {}

        const output = driver?.executeQuery<string>(query, params, {
          // @ts-expect-error
          routing: 'GO FIGURE'
        })

        await expect(output).rejects.toThrow(expectedError)
      })

      function extendsDefaultWith<T = EagerResult<Dict>> (config: QueryConfig<T>) {
        return () => {
          const defaultConfig = {
            resultTransformer: resultTransformers.eagerResultTransformer(),
            bookmarkManager: driver?.executeQueryBookmarkManager,
            routing: routing.WRITE,
            database: undefined,
            impersonatedUser: undefined
          }
          return {
            ...defaultConfig,
            ...config
          }
        }
      }
    })

    describe('when executor failed', () => {
      it('should return the failure', async () => {
        const query = 'Query'
        const params = {}
        const spiedExecute = jest.spyOn(queryExecutor, 'execute')
        const failure = newError('something was wrong')
        spiedExecute.mockRejectedValue(failure)

        await expect(driver?.executeQuery(query, params)).rejects.toThrow(failure)
      })
    })
  })

  describe('constructor', () => {
    describe('when set config.notificationFilters', () => {
      it.each(
        validNotificationFilters()
      )('should send valid "notificationFilters" to the connection provider', async (notificationFilter?: NotificationFilter) => {
        const createConnectionProviderMock = jest.fn(mockCreateConnectonProvider(connectionProvider))
        const driver = new Driver(
          META_INFO,
          { notificationFilter },
          createConnectionProviderMock,
          createSession
        )

        driver._getOrCreateConnectionProvider()

        expect(createConnectionProviderMock).toHaveBeenCalledWith(
          expect.any(Number),
          expect.objectContaining({ notificationFilter }),
          expect.any(Object),
          expect.any(Object)
        )

        await driver.close()
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
