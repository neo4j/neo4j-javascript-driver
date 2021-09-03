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
import { observer, connectionHolder } from '../src/internal'
import {
  Connection,
  newError,
  Record,
  ResultObserver,
  ResultSummary
} from '../src'

import Result from '../src/result'

describe('Result', () => {
  const expectedError = newError('some error')

  describe('new Result(Promise.resolve(new ResultStreamObserverMock()), query, parameters, connectionHolder)', () => {
    let streamObserverMock: ResultStreamObserverMock
    let result: Result

    beforeEach(() => {
      streamObserverMock = new ResultStreamObserverMock()
      result = new Result(Promise.resolve(streamObserverMock), 'query')
    })

    describe('.keys()', () => {
      it('should call subscribe with correct observer', async () => {
        const subscribe = jest.spyOn(streamObserverMock, 'subscribe')
        streamObserverMock.onKeys([])

        await result.keys()

        expect(subscribe).toHaveBeenCalled()
      })

      it('should resolve pre-existing keys', async () => {
        const expectedKeys = ['a', 'b', 'c']
        streamObserverMock.onKeys(expectedKeys)

        const keys = await result.keys()

        expect(keys).toBe(expectedKeys)
      })

      it('should resolve key pushed afterwards', done => {
        const expectedKeys = ['a', 'c']

        result.keys().then(keys => {
          expect(keys).toBe(expectedKeys)

          done()
        })
        streamObserverMock.onKeys(expectedKeys)
      })

      it('should reject with the expected error', async () => {
        const expectedError = newError('the expected error')
        streamObserverMock.onError(expectedError)

        await expect(result.keys()).rejects.toThrow(expectedError)
      })
    })

    describe('.summary()', () => {
      it('should call subscribe with the correct observer', async () => {
        const subscribe = jest.spyOn(streamObserverMock, 'subscribe')
        streamObserverMock.onCompleted({})

        await result.summary()

        expect(subscribe).toHaveBeenCalled()
      })

      it('should cancel observer records consumption', async () => {
        const cancel = jest.spyOn(streamObserverMock, 'cancel')
        streamObserverMock.onCompleted({})

        await result.summary()

        expect(cancel).toHaveBeenCalled()
      })

      it('should cancel observer before subscribe to it', async () => {
        const subscribe = jest.spyOn(streamObserverMock, 'subscribe')
        const cancel = jest.spyOn(streamObserverMock, 'cancel')
        streamObserverMock.onCompleted({})

        await result.summary()

        expect(cancel.mock.invocationCallOrder[0]).toBeLessThan(
          subscribe.mock.invocationCallOrder[0]
        )
      })

      it('should reject with the expected error', async () => {
        const expectedError = newError('the expected error')
        streamObserverMock.onError(expectedError)

        await expect(result.summary()).rejects.toThrow(expectedError)
      })

      describe.each([
        ['query', {}, { query: 'query', parameters: {} }],
        ['query', { a: 1 }, { query: 'query', parameters: { a: 1 } }],
        [{ text: 'query' }, { a: 1 }, { query: 'query', parameters: {} }],
        [
          { text: 'query', parameters: { b: 2 } },
          { a: 1 },
          { query: 'query', parameters: { b: 2 } }
        ]
      ])('when query=%s and parameters=%s', (query, params, expected) => {
        beforeEach(() => {
          result = new Result(
            Promise.resolve(streamObserverMock),
            query,
            params
          )
        })

        it('should resolve pre-existing summary', async () => {
          const metadata = {
            resultConsumedAfter: 20,
            resultAvailableAfter: 124,
            extraInfo: 'extra'
          }

          const expectedSummary = new ResultSummary(
            expected.query,
            expected.parameters,
            metadata
          )

          streamObserverMock.onCompleted(metadata)

          const summary = await result.summary()

          expect(summary).toEqual(expectedSummary)
        })

        it('should resolve summary pushe afterwards', done => {
          const metadata = {
            resultConsumedAfter: 20,
            resultAvailableAfter: 124,
            extraInfo: 'extra'
          }

          const expectedSummary = new ResultSummary(
            expected.query,
            expected.parameters,
            metadata
          )

          expect(result.summary())
            .resolves.toEqual(expectedSummary)
            .finally(done)

          streamObserverMock.onCompleted(metadata)
        })
      })
    })

    describe('.subscribe()', () => {
      it('should subscribe to the observer', async () => {
        const subscribe = jest.spyOn(streamObserverMock, 'subscribe')

        await result.subscribe({})

        expect(subscribe).toHaveBeenCalled()
      })

      it('should redirect onKeys to the client observer', async () => {
        const expectedKeys = ['a', 'b']

        streamObserverMock.onKeys(expectedKeys)

        let receivedKeys: string[] = []

        await result.subscribe({
          onKeys(keys) {
            receivedKeys = keys
          }
        })

        expect(receivedKeys).toEqual(expectedKeys)
      })

      it('should redirect onNext to the client observer', async () => {
        const keys = ['a', 'b']
        const rawRecord1 = [1, 2]
        const rawRecord2 = [3, 4]
        const receivedRecords: Record[] = []

        streamObserverMock.onKeys(['a', 'b'])
        streamObserverMock.onNext(rawRecord1)
        streamObserverMock.onNext(rawRecord2)

        await result.subscribe({
          onNext(record) {
            receivedRecords.push(record)
          }
        })

        expect(receivedRecords).toEqual([
          new Record(keys, rawRecord1),
          new Record(keys, rawRecord2)
        ])
      })

      describe.each([
        ['query', {}, { query: 'query', parameters: {} }],
        ['query', { a: 1 }, { query: 'query', parameters: { a: 1 } }],
        [{ text: 'query' }, { a: 1 }, { query: 'query', parameters: {} }],
        [
          { text: 'query', parameters: { b: 2 } },
          { a: 1 },
          { query: 'query', parameters: { b: 2 } }
        ]
      ])('when query=%s and parameters=%s', (query, params, expected) => {
        beforeEach(() => {
          result = new Result(
            Promise.resolve(streamObserverMock),
            query,
            params
          )
        })

        it('should call onComplete with the result summary', async () => {
          const metadata = {
            resultConsumedAfter: 20,
            resultAvailableAfter: 124,
            extraInfo: 'extra'
          }
          const expectedSummary = new ResultSummary(
            expected.query,
            expected.parameters,
            metadata
          )

          streamObserverMock.onCompleted(metadata)

          const promiseSummary = new Promise(
            async resolve =>
              await result.subscribe({
                onCompleted: resolve
              })
          )

          const receivedSummary = await promiseSummary

          expect(receivedSummary).toEqual(expectedSummary)
        })
      })

      it('should call onError with the occurred error and new stacktrace', async () => {
        const error = newError('the error')
        const originalStacktrace = error.stack
        streamObserverMock.onError(error)

        const promiseError = new Promise<Error>(
          async resolve =>
            await result.subscribe({
              onError: resolve
            })
        )

        const receivedError = await promiseError

        expect(receivedError.message).toEqual(error.message)
        expect(receivedError.name).toEqual(error.name)
        expect(receivedError.stack).not.toEqual(originalStacktrace)
      })

      describe('when the connection holder is not empty', () => {
        let connectionHolderMock: connectionHolder.ConnectionHolder

        beforeEach(() => {
          connectionHolderMock = new connectionHolder.ConnectionHolder({})
          result = new Result(
            Promise.resolve(streamObserverMock),
            'query',
            {},
            connectionHolderMock
          )
        })

        it('should release connection onError', async () => {
          const releaseConnection = jest.spyOn(
            connectionHolderMock,
            'releaseConnection'
          )
          const error = newError('the error')
          streamObserverMock.onError(error)

          const promiseError = new Promise<Error>(
            async resolve =>
              await result.subscribe({
                onError: resolve
              })
          )

          const receivedError = await promiseError

          expect(receivedError).toBeDefined()
          expect(releaseConnection).toHaveBeenCalled()
        })

        it('should release connection onCompleted', async () => {
          const releaseConnection = jest.spyOn(
            connectionHolderMock,
            'releaseConnection'
          )
          const metadata = {
            resultConsumedAfter: 20,
            resultAvailableAfter: 124,
            extraInfo: 'extra'
          }
          const expectedSummary = new ResultSummary('query', {}, metadata)

          streamObserverMock.onCompleted(metadata)

          const promiseSummary = new Promise(
            async resolve =>
              await result.subscribe({
                onCompleted: resolve
              })
          )

          const receivedSummary = await promiseSummary

          expect(receivedSummary).toEqual(expectedSummary)
          expect(releaseConnection).toHaveBeenCalled()
        })

        it.each([123, undefined])(
          'should enrich summary with the protocol version onCompleted',
          async version => {
            const connectionMock = {
              protocol: () => {
                return { version }
              }
            }

            connectionHolderMock.getConnection = (): Promise<Connection> => {
              return Promise.resolve(asConnection(connectionMock))
            }
            const metadata = {
              resultConsumedAfter: 20,
              resultAvailableAfter: 124,
              extraInfo: 'extra'
            }
            const expectedSummary = new ResultSummary(
              'query',
              {},
              metadata,
              version
            )

            streamObserverMock.onCompleted(metadata)

            const promiseSummary = new Promise(
              async resolve =>
                await result.subscribe({
                  onCompleted: resolve
                })
            )

            const receivedSummary = await promiseSummary

            expect(receivedSummary).toEqual(expectedSummary)
          }
        )
      })
    })

    describe('Promise', () => {
      it('should subscribe to the observer', async () => {
        const subscribe = jest.spyOn(streamObserverMock, 'subscribe')
        streamObserverMock.onCompleted({})

        await result

        expect(subscribe).toHaveBeenCalled()
      })

      it('should call finally on complete', done => {
        streamObserverMock.onCompleted({})

        result.finally(done)
      })

      it('should call finally on error', done => {
        streamObserverMock.onError(expectedError)

        result.catch(() => {}).finally(done)
      })

      describe.each([
        ['query', {}, { query: 'query', parameters: {} }],
        ['query', { a: 1 }, { query: 'query', parameters: { a: 1 } }],
        [{ text: 'query' }, { a: 1 }, { query: 'query', parameters: {} }],
        [
          { text: 'query', parameters: { b: 2 } },
          { a: 1 },
          { query: 'query', parameters: { b: 2 } }
        ]
      ])('when query=%s and parameters=%s', (query, params, expected) => {
        beforeEach(() => {
          result = new Result(
            Promise.resolve(streamObserverMock),
            query,
            params
          )
        })

        it('should resolve with summary and records', async () => {
          const metadata = {
            resultConsumedAfter: 20,
            resultAvailableAfter: 124,
            extraInfo: 'extra'
          }
          const expectedSummary = new ResultSummary(
            expected.query,
            expected.parameters,
            metadata
          )
          const keys = ['a', 'b']
          const rawRecord1 = [1, 2]
          const rawRecord2 = [3, 4]

          streamObserverMock.onKeys(keys)
          streamObserverMock.onNext(rawRecord1)
          streamObserverMock.onNext(rawRecord2)

          streamObserverMock.onCompleted(metadata)

          const queryResult = await result

          expect(queryResult.summary).toEqual(expectedSummary)
          expect(queryResult.records).toEqual([
            new Record(keys, rawRecord1),
            new Record(keys, rawRecord2)
          ])
        })
      })

      it('should reject promise with the occurred error and new stacktrace', done => {
        const error = newError('the error')
        const originalStacktrace = error.stack
        streamObserverMock.onError(error)

        result.catch(receivedError => {
          expect(receivedError.message).toEqual(error.message)
          expect(receivedError.name).toEqual(error.name)
          expect(receivedError.stack).not.toEqual(originalStacktrace)
          done()
        })
      })

      describe('when the connection holder is not empty', () => {
        let connectionHolderMock: connectionHolder.ConnectionHolder

        beforeEach(() => {
          connectionHolderMock = new connectionHolder.ConnectionHolder({})
          result = new Result(
            Promise.resolve(streamObserverMock),
            'query',
            {},
            connectionHolderMock
          )
        })

        it('should release connection on error', async () => {
          const releaseConnection = jest.spyOn(
            connectionHolderMock,
            'releaseConnection'
          )
          const error = newError('the error')
          streamObserverMock.onError(error)

          const promiseError = result.catch(error => error)

          const receivedError = await promiseError

          expect(receivedError).toBeDefined()
          expect(releaseConnection).toHaveBeenCalled()
        })

        it('should release connection on completed', async () => {
          const releaseConnection = jest.spyOn(
            connectionHolderMock,
            'releaseConnection'
          )
          const metadata = {
            resultConsumedAfter: 20,
            resultAvailableAfter: 124,
            extraInfo: 'extra'
          }
          const expectedSummary = new ResultSummary('query', {}, metadata)

          streamObserverMock.onCompleted(metadata)

          const { summary: receivedSummary } = await result

          expect(receivedSummary).toEqual(expectedSummary)
          expect(releaseConnection).toHaveBeenCalled()
        })

        it.each([123, undefined])(
          'should enrich summary with the protocol version on completed',
          async version => {
            const connectionMock = {
              protocol: () => {
                return { version }
              }
            }

            connectionHolderMock.getConnection = (): Promise<Connection> => {
              return Promise.resolve(asConnection(connectionMock))
            }
            const metadata = {
              resultConsumedAfter: 20,
              resultAvailableAfter: 124,
              extraInfo: 'extra'
            }
            const expectedSummary = new ResultSummary(
              'query',
              {},
              metadata,
              version
            )

            streamObserverMock.onCompleted(metadata)

            const { summary: receivedSummary } = await result

            expect(receivedSummary).toEqual(expectedSummary)
          }
        )
      })
    })
  })

  describe.each([
    [
      'Promise.resolve(new observer.CompletedObserver())',
      Promise.resolve(new observer.CompletedObserver())
    ]
  ])('new Result(%s, "query")', (_, promise) => {
    let result: Result
    const expectedResultSummary = new ResultSummary('query', {}, {})

    beforeEach(() => {
      result = new Result(promise, 'query')
    })

    describe('.keys()', () => {
      it('should be resolved with an empty array of keys', async () => {
        const keys = await result.keys()

        expect(keys).toStrictEqual([])
      })
    })

    describe('.summary()', () => {
      it('should be resolved with an empty summary object', async () => {
        const summary = await result.summary()

        expect(summary).toStrictEqual(expectedResultSummary)
      })
    })

    describe('.subscribe(observer)', () => {
      it('should invoke onCompleted with the expected result summary', done => {
        result.subscribe({
          onCompleted: summary => {
            expect(summary).toStrictEqual(expectedResultSummary)
            done()
          }
        })
      })

      it('should invoke onKeys with an empty list of keys', done => {
        result.subscribe({
          onKeys: keys => {
            expect(keys).toStrictEqual([])
            done()
          }
        })
      })

      it('should not invoke onError', done => {
        result.subscribe({
          onCompleted: () => done(),
          onError: () => done.fail('should not invoke onError')
        })
      })

      it('should not invoke onNext', done => {
        result.subscribe({
          onCompleted: () => done(),
          onNext: () => done.fail('should not invoke onNext')
        })
      })
    })

    describe('Promise', () => {
      it('should be resolved with an empty array of records', async () => {
        const { records } = await result

        expect(records).toStrictEqual([])
      })

      it('should be resolved with expected result summary', async () => {
        const { summary } = await result

        expect(summary).toStrictEqual(expectedResultSummary)
      })

      it('should be resolved with no other field then summary and record', async () => {
        const queryResult = await result

        expect(Object.keys(queryResult).sort()).toEqual(['records', 'summary'])
      })
    })
  })

  describe.each([
    [
      'Promise.resolve(new observer.FailedObserver({ error: expectedError }))',
      Promise.resolve(new observer.FailedObserver({ error: expectedError }))
    ],
    ['Promise.reject(expectedError)', Promise.reject(expectedError)]
  ])('new Result(%s, "query") ', (_, promise) => {
    let result: Result

    beforeEach(() => {
      result = new Result(promise, 'query')
    })

    describe('.keys()', () => {
      shouldReturnRejectedPromiseWithTheExpectedError(() => result.keys())
    })

    describe('.summary()', () => {
      shouldReturnRejectedPromiseWithTheExpectedError(() => result.summary())
    })

    describe('Promise', () => {
      shouldReturnRejectedPromiseWithTheExpectedError(() => result)
    })

    describe('.subscribe(observer)', () => {
      it('should only call on error', done => {
        result.subscribe({
          onCompleted: () => {
            done.fail('onCompleted should not be called')
          },
          onKeys: () => {
            done.fail('onKeys should not be called')
          },
          onNext: () => {
            done.fail('onNext should not be called')
          },
          onError: error => {
            expect(error).toBe(expectedError)
            done()
          }
        })
      })
    })

    function shouldReturnRejectedPromiseWithTheExpectedError<T>(
      supplier: () => Promise<T>
    ) {
      it('should return rejected promise with the expected error', () =>
        expect(supplier()).rejects.toBe(expectedError))
    }
  })
})

class ResultStreamObserverMock implements observer.ResultStreamObserver {
  private _queuedRecords: Record[]
  private _fieldKeys?: string[]
  private _observers: ResultObserver[]
  private _error?: Error
  private _meta?: any

  constructor() {
    this._queuedRecords = []
    this._observers = []
  }

  cancel(): void {}

  prepareToHandleSingleResponse(): void {}

  markCompleted(): void {}

  subscribe(observer: ResultObserver): void {
    this._observers.push(observer)

    if (observer.onError && this._error) {
      observer.onError!(this._error)
      return
    }

    if (observer.onKeys && this._fieldKeys) {
      observer.onKeys!(this._fieldKeys)
    }

    if (observer.onNext) {
      this._queuedRecords.forEach(record => observer.onNext!(record))
    }

    if (observer.onCompleted && this._meta) {
      observer.onCompleted!(this._meta)
    }
  }

  onKeys(keys: string[]) {
    this._fieldKeys = keys
    this._observers.forEach(o => {
      if (o.onKeys) {
        o.onKeys!(keys)
      }
    })
  }

  onNext(rawRecord: any[]) {
    const record = new Record(this._fieldKeys!, rawRecord)
    const streamed = this._observers
      .filter(o => o.onNext)
      .map(o => o.onNext!(record))
      .reduce(() => true, false)

    if (!streamed) {
      this._queuedRecords.push(record)
    }
  }

  onError(error: Error) {
    this._error = error
    this._observers.filter(o => o.onError).forEach(o => o.onError!(error))
  }

  onCompleted(meta: any) {
    this._meta = meta
    this._observers
      .filter(o => o.onCompleted)
      .forEach(o => o.onCompleted!(meta))
  }
}

function asConnection(value: any): Connection {
  return value
}
