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

import { bookmarkManager, newError, Result, Session, TransactionConfig } from '../../src'
import QueryExecutor from '../../src/internal/query-executor'
import ManagedTransaction from '../../src/transaction-managed'
import ResultStreamObserverMock from '../utils/result-stream-observer.mock'
import { Query } from '../../src/types'
import { TELEMETRY_APIS } from '../../src/internal/constants'

type ManagedTransactionWork<T> = (tx: ManagedTransaction) => Promise<T> | T

describe('QueryExecutor', () => {
  const aBookmarkManager = bookmarkManager()
  const aTransactionConfig: TransactionConfig = {
    timeout: 1234,
    metadata: {
      key: 'value'
    }
  }

  it.each([
    ['bookmarkManager set', { bookmarkManager: aBookmarkManager }, { bookmarkManager: aBookmarkManager }],
    ['bookmarkManager undefined', { bookmarkManager: undefined }, { bookmarkManager: undefined }],
    ['database set', { database: 'adb' }, { database: 'adb' }],
    ['database undefined', { database: undefined }, { database: undefined }],
    ['impersonatedUser set', { impersonatedUser: 'anUser' }, { impersonatedUser: 'anUser' }],
    ['impersonatedUser undefined', { impersonatedUser: undefined }, { impersonatedUser: undefined }],
    ['auth set', { auth: { scheme: 'none', credentials: '' } }, { auth: { scheme: 'none', credentials: '' } }],
    ['auth undefined', { auth: undefined }, { auth: undefined }]
  ])('should redirect % to the session creation', async (_, executorConfig, expectConfig) => {
    const { queryExecutor, createSession } = createExecutor()

    await queryExecutor.execute({
      routing: 'WRITE',
      resultTransformer: async (result: Result) => await Promise.resolve(),
      ...executorConfig
    }, 'query')

    expect(createSession).toBeCalledWith(expectConfig)
  })

  describe('when routing="READ"', () => {
    const baseConfig: {
      routing: 'READ'
      resultTransformer: (result: Result) => Promise<void>
    } = {
      routing: 'READ',
      resultTransformer: async (result: Result) => await Promise.resolve()
    }

    it('should close the session', async () => {
      const { queryExecutor, sessionsCreated } = createExecutor()

      await queryExecutor.execute(baseConfig, 'query')

      expect(sessionsCreated.length).toBe(1)
      const [{ spyOnClose }] = sessionsCreated
      expect(spyOnClose).toHaveBeenCalled()
    })

    it('should rethrow errors on closing the session', async () => {
      const error = newError('an error')

      const { queryExecutor } = createExecutor({
        mockSessionClose: spy => spy.mockRejectedValue(error)
      })

      await expect(queryExecutor.execute(baseConfig, 'query')).rejects.toThrow(error)
    })

    it('should call executeRead', async () => {
      const { queryExecutor, sessionsCreated } = createExecutor()

      await queryExecutor.execute(baseConfig, 'query')

      expect(sessionsCreated.length).toBe(1)
      const [{ spyOnExecuteRead }] = sessionsCreated
      expect(spyOnExecuteRead).toHaveBeenCalled()
    })

    it.each([
      [aTransactionConfig],
      [undefined],
      [null]
    ])('should call executeRead with transactionConfig=%s', async (transactionConfig: TransactionConfig) => {
      const { queryExecutor, sessionsCreated } = createExecutor()

      await queryExecutor.execute({ ...baseConfig, transactionConfig }, 'query')

      expect(sessionsCreated.length).toBe(1)
      const [{ spyOnExecuteRead }] = sessionsCreated
      expect(spyOnExecuteRead).toHaveBeenCalledWith(expect.any(Function), transactionConfig)
    })

    it('should configure the session with pipeline begin and correct api metrics', async () => {
      const { queryExecutor, sessionsCreated } = createExecutor()

      await queryExecutor.execute(baseConfig, 'query')

      expect(sessionsCreated.length).toBe(1)
      const [{ spyOnConfigureTransactionExecutor, spyOnExecuteRead }] = sessionsCreated

      expect(spyOnConfigureTransactionExecutor).toHaveBeenCalledTimes(1)
      expect(spyOnConfigureTransactionExecutor).toHaveBeenCalledWith(true, TELEMETRY_APIS.EXECUTE_QUERY)
      expect(spyOnExecuteRead.mock.invocationCallOrder[0]).toBeGreaterThan(
        spyOnConfigureTransactionExecutor.mock.invocationCallOrder[0]
      )
    })

    it('should call not call executeWrite', async () => {
      const { queryExecutor, sessionsCreated } = createExecutor()

      await queryExecutor.execute(baseConfig, 'query')

      expect(sessionsCreated.length).toBe(1)
      const [{ spyOnExecuteWrite }] = sessionsCreated
      expect(spyOnExecuteWrite).not.toHaveBeenCalled()
    })

    it('should call tx.run with query and params', async () => {
      const { managedTransaction, spyOnRun } = createManagedTransaction()
      const { queryExecutor } = createExecutor({
        mockSessionExecuteRead (spy) {
          spy.mockImplementation(async (transactionWork: ManagedTransactionWork<unknown>, transactionConfig?: TransactionConfig): Promise<unknown> => {
            return transactionWork(managedTransaction)
          })
        }
      })

      await queryExecutor.execute(baseConfig, 'query', { a: 'b' })

      expect(spyOnRun).toHaveBeenCalledTimes(1)
      expect(spyOnRun).toHaveBeenCalledWith('query', { a: 'b' })
    })

    it('should return the transformed result', async () => {
      const { managedTransaction, results } = createManagedTransaction()
      const { queryExecutor } = createExecutor({
        mockSessionExecuteRead (spy) {
          spy.mockImplementation(async (transactionWork: ManagedTransactionWork<unknown>, transactionConfig?: TransactionConfig): Promise<unknown> => {
            return transactionWork(managedTransaction)
          })
        }
      })
      const expectedExecutorResult = { c: 123 }

      const resultTransformer = jest.fn(async () => await Promise.resolve(expectedExecutorResult))

      const executorResult = await queryExecutor.execute({
        ...baseConfig,
        resultTransformer
      }, 'query', { a: 'b' })

      expect(executorResult).toEqual(expectedExecutorResult)

      expect(results.length).toEqual(1)
      const [result] = results
      expect(resultTransformer).toBeCalledTimes(1)
      expect(resultTransformer).toBeCalledWith(result)
    })

    it('should handle error during executeRead', async () => {
      const error = newError('expected error')
      const { queryExecutor, sessionsCreated } = createExecutor({
        mockSessionExecuteRead (spy) {
          spy.mockRejectedValue(error)
        }
      })

      await expect(queryExecutor.execute(baseConfig, 'query', { a: 'b' })).rejects.toThrow(error)

      expect(sessionsCreated.length).toEqual(1)
      const [{ spyOnClose }] = sessionsCreated
      expect(spyOnClose).toHaveBeenCalled()
    })

    it('should give precedence to errors during session close', async () => {
      const error = newError('non expected error')
      const closeError = newError('expected error')
      const { queryExecutor } = createExecutor({
        mockSessionExecuteRead (spy) {
          spy.mockRejectedValue(error)
        },
        mockSessionClose (spy) {
          spy.mockRejectedValue(closeError)
        }
      })

      try {
        await queryExecutor.execute(baseConfig, 'query', { a: 'b' })
        fail('code should be unreachable')
      } catch (errorGot) {
        expect(errorGot).toBe(closeError)
      }
    })
  })

  describe('when routing="WRITE"', () => {
    const baseConfig: {
      routing: 'WRITE'
      resultTransformer: (result: Result) => Promise<void>
    } = {
      routing: 'WRITE',
      resultTransformer: async (result: Result) => await Promise.resolve()
    }

    it('should close the session', async () => {
      const { queryExecutor, sessionsCreated } = createExecutor()

      await queryExecutor.execute(baseConfig, 'query')

      expect(sessionsCreated.length).toBe(1)
      const [{ spyOnClose }] = sessionsCreated
      expect(spyOnClose).toHaveBeenCalled()
    })

    it('should rethrow errors on closing the session', async () => {
      const error = newError('an error')

      const { queryExecutor } = createExecutor({
        mockSessionClose: spy => spy.mockRejectedValue(error)
      })

      await expect(queryExecutor.execute(baseConfig, 'query')).rejects.toThrow(error)
    })

    it('should call executeWrite', async () => {
      const { queryExecutor, sessionsCreated } = createExecutor()

      await queryExecutor.execute(baseConfig, 'query')

      expect(sessionsCreated.length).toBe(1)
      const [{ spyOnExecuteWrite }] = sessionsCreated
      expect(spyOnExecuteWrite).toHaveBeenCalled()
    })

    it.each([
      [aTransactionConfig],
      [undefined],
      [null]
    ])('should call executeWrite with transactionConfig=%s', async (transactionConfig: TransactionConfig) => {
      const { queryExecutor, sessionsCreated } = createExecutor()

      await queryExecutor.execute({ ...baseConfig, transactionConfig }, 'query')

      expect(sessionsCreated.length).toBe(1)
      const [{ spyOnExecuteWrite }] = sessionsCreated
      expect(spyOnExecuteWrite).toHaveBeenCalledWith(expect.any(Function), transactionConfig)
    })

    it('should configure the session with pipeline begin and api telemetry', async () => {
      const { queryExecutor, sessionsCreated } = createExecutor()

      await queryExecutor.execute(baseConfig, 'query')

      expect(sessionsCreated.length).toBe(1)
      const [{ spyOnConfigureTransactionExecutor, spyOnExecuteWrite }] = sessionsCreated

      expect(spyOnConfigureTransactionExecutor).toHaveBeenCalledTimes(1)
      expect(spyOnConfigureTransactionExecutor).toHaveBeenCalledWith(true, TELEMETRY_APIS.EXECUTE_QUERY)
      expect(spyOnExecuteWrite.mock.invocationCallOrder[0]).toBeGreaterThan(
        spyOnConfigureTransactionExecutor.mock.invocationCallOrder[0]
      )
    })

    it('should call not call executeRead', async () => {
      const { queryExecutor, sessionsCreated } = createExecutor()

      await queryExecutor.execute(baseConfig, 'query')

      expect(sessionsCreated.length).toBe(1)
      const [{ spyOnExecuteRead }] = sessionsCreated
      expect(spyOnExecuteRead).not.toHaveBeenCalled()
    })

    it('should call tx.run with query and params', async () => {
      const { managedTransaction, spyOnRun } = createManagedTransaction()
      const { queryExecutor } = createExecutor({
        mockSessionExecuteWrite (spy) {
          spy.mockImplementation(async (transactionWork: ManagedTransactionWork<unknown>, transactionConfig?: TransactionConfig): Promise<unknown> => {
            return transactionWork(managedTransaction)
          })
        }
      })

      await queryExecutor.execute(baseConfig, 'query', { a: 'b' })

      expect(spyOnRun).toHaveBeenCalledTimes(1)
      expect(spyOnRun).toHaveBeenCalledWith('query', { a: 'b' })
    })

    it('should return the transformed result', async () => {
      const { managedTransaction, results } = createManagedTransaction()
      const { queryExecutor } = createExecutor({
        mockSessionExecuteWrite (spy) {
          spy.mockImplementation(async (transactionWork: ManagedTransactionWork<unknown>, transactionConfig?: TransactionConfig): Promise<unknown> => {
            return transactionWork(managedTransaction)
          })
        }
      })
      const expectedExecutorResult = { c: 123 }

      const resultTransformer = jest.fn(async () => await Promise.resolve(expectedExecutorResult))

      const executorResult = await queryExecutor.execute({
        ...baseConfig,
        resultTransformer
      }, 'query', { a: 'b' })

      expect(executorResult).toEqual(expectedExecutorResult)

      expect(results.length).toEqual(1)
      const [result] = results
      expect(resultTransformer).toBeCalledTimes(1)
      expect(resultTransformer).toBeCalledWith(result)
    })

    it('should handle error during executeWrite', async () => {
      const error = newError('expected error')
      const { queryExecutor, sessionsCreated } = createExecutor({
        mockSessionExecuteWrite (spy) {
          spy.mockRejectedValue(error)
        }
      })

      await expect(queryExecutor.execute(baseConfig, 'query', { a: 'b' })).rejects.toThrow(error)

      expect(sessionsCreated.length).toEqual(1)
      const [{ spyOnClose }] = sessionsCreated
      expect(spyOnClose).toHaveBeenCalled()
    })

    it('should give precedence to errors during session close', async () => {
      const error = newError('non expected error')
      const closeError = newError('expected error')
      const { queryExecutor } = createExecutor({
        mockSessionExecuteWrite (spy) {
          spy.mockRejectedValue(error)
        },
        mockSessionClose (spy) {
          spy.mockRejectedValue(closeError)
        }
      })

      try {
        await queryExecutor.execute(baseConfig, 'query', { a: 'b' })
        fail('code should be not reachable')
      } catch (errorGot) {
        expect(errorGot).toBe(closeError)
      }
    })
  })

  function createExecutor ({
    mockSessionClose,
    mockSessionExecuteRead,
    mockSessionExecuteWrite
  }: {
    mockSessionClose?: (spy: jest.SpyInstance<Promise<void>>) => void
    mockSessionExecuteRead?: (spy: jest.SpyInstance<Promise<unknown>, [transactionWork: ManagedTransactionWork<unknown>, transactionConfig?: TransactionConfig | undefined]>) => void
    mockSessionExecuteWrite?: (spy: jest.SpyInstance<Promise<unknown>, [transactionWork: ManagedTransactionWork<unknown>, transactionConfig?: TransactionConfig | undefined]>) => void
  } = { }): {
      queryExecutor: QueryExecutor
      sessionsCreated: Array<{
        session: Session
        spyOnExecuteRead: jest.SpyInstance<any>
        spyOnExecuteWrite: jest.SpyInstance<any>
        spyOnClose: jest.SpyInstance<Promise<void>>
        spyOnConfigureTransactionExecutor: jest.SpyInstance<void>
      }>
      createSession: jest.Mock<Session, [args: any]>
    } {
    const _mockSessionClose = mockSessionClose ?? ((spy) => spy.mockResolvedValue())
    const _mockSessionExecuteRead = mockSessionExecuteRead ?? ((spy) => spy.mockResolvedValue({}))
    const _mockSessionExecuteWrite = mockSessionExecuteWrite ?? ((spy) => spy.mockResolvedValue({}))

    const sessionsCreated: Array<{
      session: Session
      spyOnExecuteRead: jest.SpyInstance<any>
      spyOnExecuteWrite: jest.SpyInstance<any>
      spyOnClose: jest.SpyInstance<Promise<void>>
      spyOnConfigureTransactionExecutor: jest.SpyInstance<void>
    }> = []
    const createSession = jest.fn((args) => {
      const session = new Session(args)
      const sessionCreated = {
        session,
        spyOnExecuteRead: jest.spyOn(session, 'executeRead'),
        spyOnExecuteWrite: jest.spyOn(session, 'executeWrite'),
        spyOnClose: jest.spyOn(session, 'close'),
        // @ts-expect-error
        spyOnConfigureTransactionExecutor: jest.spyOn(session, '_configureTransactionExecutor')
      }
      sessionsCreated.push(sessionCreated)
      _mockSessionExecuteRead(sessionCreated.spyOnExecuteRead)
      _mockSessionExecuteWrite(sessionCreated.spyOnExecuteWrite)
      _mockSessionClose(sessionCreated.spyOnClose)
      return session
    })
    const queryExecutor = new QueryExecutor(createSession)

    return {
      queryExecutor,
      sessionsCreated,
      createSession
    }
  }

  function createManagedTransaction (): {
    managedTransaction: ManagedTransaction
    spyOnRun: jest.SpyInstance<Result, [query: Query, parameters?: any]>
    resultObservers: ResultStreamObserverMock[]
    results: Result[]
  } {
    const resultObservers: ResultStreamObserverMock[] = []
    const results: Result[] = []

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const managedTransaction = {
      run: (query: string, parameters?: any): Result => {
        const resultObserver = new ResultStreamObserverMock()
        resultObservers.push(resultObserver)
        const result = new Result(
          Promise.resolve(resultObserver),
          query,
          parameters
        )
        results.push(result)
        return result
      }
    } as ManagedTransaction

    const spyOnRun = jest.spyOn(managedTransaction, 'run')

    return {
      managedTransaction,
      spyOnRun,
      resultObservers,
      results
    }
  }
})
