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
import { observer, connectionHolder } from '../src/internal'
import {
  Connection,
  newError,
  Record,
  ResultSummary
} from '../src'

import ResultStreamObserverMock from './utils/result-stream-observer.mock'
import Result from '../src/result'
import FakeConnection from './utils/connection.fake'
import { Logger } from '../src/internal/logger'

interface AB {
  a: number
  b: number
}

describe('Result', () => {
  const expectedError = newError('some error')

  describe('new Result(Promise.resolve(new ResultStreamObserverMock()), query, parameters, connectionHolder)', () => {
    let streamObserverMock: ResultStreamObserverMock
    let result: Result
    const watermarks = { high: 10, low: 3 }

    beforeEach(() => {
      streamObserverMock = new ResultStreamObserverMock()
      result = new Result(Promise.resolve(streamObserverMock), 'query', undefined, undefined, watermarks)
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

      it('should reject pre-existing errors', async () => {
        const expectedError = newError('some error')
        streamObserverMock.onError(expectedError)

        await expect(result.keys()).rejects.toBe(expectedError)
      })

      it('should reject already consumed pre-existing error', async () => {
        const expectedError = newError('some error')
        streamObserverMock.onError(expectedError)

        try {
          await result
        } catch (e) {
          // ignore
        }

        await expect(result.keys()).rejects.toBe(expectedError)
      })

      it('should resolve key pushed afterwards', done => {
        const expectedKeys = ['a', 'c']

        result.keys().then(keys => {
          expect(keys).toBe(expectedKeys)

          done()
        }).catch(done)
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
        let connectionHolderMock: connectionHolder.ConnectionHolder
        beforeEach(() => {
          connectionHolderMock = new connectionHolder.ConnectionHolder({ log: Logger.create({}) })
          result = new Result(
            Promise.resolve(streamObserverMock),
            query,
            params,
            connectionHolderMock
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

        it('should resolve pre-existing summary', async () => {
          const metadata = {
            resultConsumedAfter: 20,
            resultAvailableAfter: 124,
            extraInfo: 'extra'
          }
          const protocolVersion = 5.0

          const expectedSummary = new ResultSummary(
            expected.query,
            expected.parameters,
            metadata,
            protocolVersion
          )

          jest.spyOn(connectionHolderMock, 'getConnection')
            .mockImplementationOnce(async () => {
              const conn = new FakeConnection()
              conn.protocolVersion = protocolVersion
              return conn
            })

          jest.spyOn(connectionHolderMock, 'releaseConnection')
            .mockImplementationOnce(async () => null)

          const iterator = result[Symbol.asyncIterator]()
          const next = iterator.next()
          const summaryPromise = result.summary()

          streamObserverMock.onCompleted(metadata)

          const { value } = await next
          const summary = await summaryPromise

          expect(value).toEqual(expectedSummary)
          expect(summary).toEqual(expectedSummary)
        })

        it('should reject a pre-existing error', async () => {
          const expectedError = newError('the expected error')
          streamObserverMock.onError(expectedError)

          await expect(result.summary()).rejects.toThrow(expectedError)
        })

        it('should reject already consumed pre-existing error', async () => {
          const expectedError = newError('the expected error')
          streamObserverMock.onError(expectedError)

          try {
            await result
          } catch (_) {
            // ignore
          }

          await expect(result.summary()).rejects.toThrow(expectedError)
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
          onKeys (keys) {
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
          onNext (record) {
            receivedRecords.push(record)
          }
        })

        expect(receivedRecords).toEqual([
          new Record(keys, rawRecord1),
          new Record(keys, rawRecord2)
        ])
      })

      it('should redirect onNext to the client observer with type safety', async () => {
        const result = new Result<AB>(Promise.resolve(streamObserverMock), 'query')

        const keys = ['a', 'b']
        const rawRecord1 = [1, 2]
        const rawRecord2 = [3, 4]
        const receivedRecords: Array<[number, number]> = []

        streamObserverMock.onKeys(keys)
        streamObserverMock.onNext(rawRecord1)
        streamObserverMock.onNext(rawRecord2)

        await result.subscribe({
          onNext (record) {
            const a: number = record.get('a')
            const b: number = record.get('b')

            // @ts-expect-error
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const _: string = record.get('a')

            receivedRecords.push([a, b])
          }
        })

        expect(receivedRecords).toEqual([rawRecord1, rawRecord2])
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
            resolve =>
              result.subscribe({
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
          resolve =>
            result.subscribe({
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
          connectionHolderMock = new connectionHolder.ConnectionHolder({ log: Logger.create({}) })
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
            resolve =>
              result.subscribe({
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
            resolve =>
              result.subscribe({
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
            const connectionMock = new FakeConnection()
            // converting to accept undefined as number
            // this test is considering the situation where protocol version
            // is undefined, which should not happen during normal driver
            // operation.
            connectionMock.protocolVersion = version as unknown as number

            connectionHolderMock.getConnection = async (): Promise<Connection> => {
              return connectionMock
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
              resolve =>
                result.subscribe({
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

        result.catch(() => { }).finally(done)
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

        it('should resolve with summary and records type safety', async () => {
          const result = new Result<AB>(Promise.resolve(streamObserverMock), expected.query, expected.parameters)
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

          const { summary, records } = await result

          const rawRecords = records.map(record => {
            const a: number = record.get('a')
            const b: number = record.get('b')

            // @ts-expect-error
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const _: string = record.get('a')

            return [a, b]
          })

          expect(summary).toEqual(expectedSummary)
          expect(rawRecords).toEqual([rawRecord1, rawRecord2])
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
          connectionHolderMock = new connectionHolder.ConnectionHolder({ log: Logger.create({}) })
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
            const connectionMock = new FakeConnection()
            // converting to accept undefined as number
            // this test is considering the situation where protocol version
            // is undefined, which should not happen during normal driver
            // operation.
            connectionMock.protocolVersion = version as unknown as number

            connectionHolderMock.getConnection = async (): Promise<Connection> => {
              return await Promise.resolve(connectionMock)
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

    describe('asyncIterator', () => {
      it('should subscribe to the observer', async () => {
        const subscribe = jest.spyOn(streamObserverMock, 'subscribe')
        streamObserverMock.onCompleted({})

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for await (const _ of result) {
          // do nothing
        }

        expect(subscribe).toHaveBeenCalled()
      })

      it('should pause the stream and then resume the stream', async () => {
        const pause = jest.spyOn(streamObserverMock, 'pause')
        const resume = jest.spyOn(streamObserverMock, 'resume')
        streamObserverMock.onCompleted({})
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for await (const _ of result) {
          // do nothing
        }

        expect(pause).toHaveBeenCalledTimes(1)
        expect(resume).toHaveBeenCalledTimes(1)
        expect(pause.mock.invocationCallOrder[0])
          .toBeLessThan(resume.mock.invocationCallOrder[0])
      })

      it('should pause the stream before subscribe', async () => {
        const subscribe = jest.spyOn(streamObserverMock, 'subscribe')
        const pause = jest.spyOn(streamObserverMock, 'pause')
        streamObserverMock.onCompleted({})

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for await (const _ of result) {
          // do nothing
        }

        expect(pause.mock.invocationCallOrder[0])
          .toBeLessThan(subscribe.mock.invocationCallOrder[0])
      })

      it('should pause the stream if queue is bigger than high watermark', async () => {
        const pause = jest.spyOn(streamObserverMock, 'pause')
        const resume = jest.spyOn(streamObserverMock, 'resume')
        streamObserverMock.onKeys(['a'])

        for (let i = 0; i < watermarks.high + 3; i++) {
          streamObserverMock.onNext([i])
        }

        const it = result[Symbol.asyncIterator]()
        await it.next()

        expect(pause).toBeCalledTimes(1)
        expect(resume).toBeCalledTimes(0)
      })

      it('should pause the stream if queue is bigger than high watermark and not iteraction with the stream', async () => {
        const pause = jest.spyOn(streamObserverMock, 'pause')
        const resume = jest.spyOn(streamObserverMock, 'resume')
        streamObserverMock.onKeys(['a'])

        streamObserverMock.onNext([-1])

        const it = result[Symbol.asyncIterator]()
        await it.next()

        expect(pause).toBeCalledTimes(1)
        expect(resume).toBeCalledTimes(1)

        for (let i = 0; i <= watermarks.high + 1; i++) {
          streamObserverMock.onNext([i])
        }

        expect(pause).toBeCalledTimes(2)
        expect(resume).toBeCalledTimes(1)
      })

      it('should call resume if queue is smaller than low watermark', async () => {
        const resume = jest.spyOn(streamObserverMock, 'resume')
        streamObserverMock.onKeys(['a'])

        for (let i = 0; i < watermarks.low - 1; i++) {
          streamObserverMock.onNext([i])
        }

        const it = result[Symbol.asyncIterator]()
        await it.next()

        expect(resume).toBeCalledTimes(1)
      })

      it('should not pause after resume if queue is between lower and high if it never highter then high watermark', async () => {
        const pause = jest.spyOn(streamObserverMock, 'pause')
        const resume = jest.spyOn(streamObserverMock, 'resume')
        streamObserverMock.onKeys(['a'])

        for (let i = 0; i < watermarks.high - 1; i++) {
          streamObserverMock.onNext([i])
        }

        const it = result[Symbol.asyncIterator]()
        for (let i = 0; i < watermarks.high - watermarks.low; i++) {
          await it.next()
        }

        expect(pause).toBeCalledTimes(1)
        expect(pause.mock.invocationCallOrder[0])
          .toBeLessThan(resume.mock.invocationCallOrder[0])
      })

      it('should resume once if queue is between lower and high if it get highter then high watermark', async () => {
        const resume = jest.spyOn(streamObserverMock, 'resume')
        streamObserverMock.onKeys(['a'])

        for (let i = 0; i < watermarks.high; i++) {
          streamObserverMock.onNext([i])
        }

        const it = result[Symbol.asyncIterator]()
        for (let i = 0; i < watermarks.high - watermarks.low; i++) {
          await it.next()
        }

        expect(resume).toBeCalledTimes(1)
      })

      it('should recover from high watermark limit after went to low watermark', async () => {
        const resume = jest.spyOn(streamObserverMock, 'resume')
        streamObserverMock.onKeys(['a'])

        for (let i = 0; i < watermarks.high; i++) {
          streamObserverMock.onNext([i])
        }

        const it = result[Symbol.asyncIterator]()
        for (let i = 0; i < watermarks.high - watermarks.low; i++) {
          await it.next()
        }

        for (let i = 0; i < 2; i++) {
          await it.next()
        }

        expect(resume).toBeCalledTimes(1)
      })

      it('should iterate over record', async () => {
        const keys = ['a', 'b']
        const rawRecord1 = [1, 2]
        const rawRecord2 = [3, 4]

        streamObserverMock.onKeys(keys)
        streamObserverMock.onNext(rawRecord1)
        streamObserverMock.onNext(rawRecord2)

        streamObserverMock.onCompleted({})

        const records = []
        for await (const record of result) {
          records.push(record)
        }

        expect(records).toEqual([
          new Record(keys, rawRecord1),
          new Record(keys, rawRecord2)
        ])
      })

      it('should iterate over record with type safety', async () => {
        const result = new Result<AB>(Promise.resolve(streamObserverMock), 'query')

        const keys = ['a', 'b']
        const rawRecord1 = [1, 2]
        const rawRecord2 = [3, 4]

        streamObserverMock.onKeys(keys)
        streamObserverMock.onNext(rawRecord1)
        streamObserverMock.onNext(rawRecord2)

        streamObserverMock.onCompleted({})

        const receivedRawRecords = []
        for await (const record of result) {
          const a: number = record.get('a')
          const b: number = record.get('b')

          // @ts-expect-error
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const _: string = record.get('a')

          receivedRawRecords.push([a, b])
        }

        expect(receivedRawRecords).toEqual([rawRecord1, rawRecord2])
      })

      it('should return summary when it finishes', async () => {
        const keys = ['a', 'b']
        const rawRecord1 = [1, 2]
        const rawRecord2 = [3, 4]

        streamObserverMock.onKeys(keys)
        streamObserverMock.onNext(rawRecord1)
        streamObserverMock.onNext(rawRecord2)

        streamObserverMock.onCompleted({})

        const it = result[Symbol.asyncIterator]()
        await it.next()
        await it.next()
        const { value, done } = await it.next()

        expect(value).toEqual(new ResultSummary('query', {}, {}))
        expect(done).toEqual(true)
      })

      it('should return summary value when it gets called second time after finish', async () => {
        const keys = ['a', 'b']
        const rawRecord1 = [1, 2]
        const rawRecord2 = [3, 4]

        streamObserverMock.onKeys(keys)
        streamObserverMock.onNext(rawRecord1)
        streamObserverMock.onNext(rawRecord2)

        streamObserverMock.onCompleted({})

        const it = result[Symbol.asyncIterator]()
        await it.next()
        await it.next()
        await it.next()
        const { value, done } = await it.next()

        expect(value).toEqual(new ResultSummary('query', {}, {}))
        expect(done).toEqual(true)
      })

      it('should end full batch', async () => {
        const fetchSize = 3
        const observer = new ResultStreamObserverMock()
        const res = new Result(
          Promise.resolve(observer),
          'query', undefined, undefined,
          {
            low: fetchSize * 0.3, // Same as calculate in the session.ts
            high: fetchSize * 0.7
          }
        )

        const keys = ['a', 'b']
        const rawRecord1 = [1, 2]
        const rawRecord2 = [3, 4]
        const rawRecord3 = [5, 6]
        const rawRecord4 = [7, 8]
        const rawRecord5 = [9, 10]
        const rawRecord6 = [11, 12]
        const queue: any[][] = [
          rawRecord3,
          rawRecord4,
          rawRecord5,
          rawRecord6
        ]

        const simuatedStream = simulateStream(queue, observer, fetchSize, 2)

        jest.spyOn(observer, 'resume')
          .mockImplementation(simuatedStream.resume.bind(simuatedStream))

        jest.spyOn(observer, 'pause')
          .mockImplementation(simuatedStream.pause.bind(simuatedStream))

        observer.onKeys(keys)
        observer.onNext(rawRecord1)
        observer.onNext(rawRecord2)

        const records = []

        for await (const record of res) {
          records.push(record)
          await new Promise(resolve => setTimeout(resolve, 0.1))
        }

        expect(records).toEqual([
          new Record(keys, rawRecord1),
          new Record(keys, rawRecord2),
          new Record(keys, rawRecord3),
          new Record(keys, rawRecord4),
          new Record(keys, rawRecord5),
          new Record(keys, rawRecord6)
        ])
      })

      it.each([
        ['success', async (stream: any) => stream.onCompleted({})],
        ['error', async (stream: any) => stream.onError(new Error('error'))]
      ])('should thrown on iterating over an consumed result [%s]', async (_, completeStream) => {
        await completeStream(streamObserverMock)

        await result.summary().catch(() => {})

        try {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          for await (const _ of result) {
            expect('not to iterate over consumed result').toBe(true)
          }
          expect('not to finish iteration over consumed result').toBe(true)
        } catch (e) {
          expect(e).toEqual(newError('Result is already consumed'))
        }

        expect('not to finish iteration over consumed result')
      })

      describe('.return()', () => {
        it('should finished the operator when it get called', async () => {
          const keys = ['a', 'b']
          const rawRecord1 = [1, 2]
          const rawRecord2 = [3, 4]
          const summary = new ResultSummary('query', {}, {})

          streamObserverMock.onKeys(keys)
          streamObserverMock.onNext(rawRecord1)
          streamObserverMock.onNext(rawRecord2)

          const it = result[Symbol.asyncIterator]()
          await it.next()
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          const summaryPromise = it.return!(summary)

          streamObserverMock.onCompleted({})

          const { value, done } = await summaryPromise
          expect(value).toBe(summary)
          expect(done).toEqual(true)
        })

        it('should return resultant summary when it get called without params', async () => {
          const keys = ['a', 'b']
          const rawRecord1 = [1, 2]
          const rawRecord2 = [3, 4]
          const summary = new ResultSummary('query', {}, {})

          streamObserverMock.onKeys(keys)
          streamObserverMock.onNext(rawRecord1)
          streamObserverMock.onNext(rawRecord2)

          const it = result[Symbol.asyncIterator]()
          await it.next()
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          const summaryPromise = it.return!()

          streamObserverMock.onCompleted({})

          const { value, done } = await summaryPromise
          expect(value).toEqual(summary)
          expect(done).toEqual(true)
        })

        it('should return value in the next call', async () => {
          const keys = ['a', 'b']
          const rawRecord1 = [1, 2]
          const rawRecord2 = [3, 4]

          streamObserverMock.onKeys(keys)
          streamObserverMock.onNext(rawRecord1)
          streamObserverMock.onNext(rawRecord2)
          streamObserverMock.onCompleted({})

          const it = result[Symbol.asyncIterator]()

          await it.next()
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          await it.return!(new ResultSummary('query', {}, {}))

          const { value, done } = await it.next()

          expect(value).toEqual(new ResultSummary('query', {}, {}))
          expect(done).toEqual(true)
        })

        it('should subscribe to the observer when it is the first api called', async () => {
          const subscribe = jest.spyOn(streamObserverMock, 'subscribe')
          streamObserverMock.onCompleted({})

          const it = result[Symbol.asyncIterator]()

          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          await it.return!(new ResultSummary('query', {}, {}))

          await it.next()

          expect(subscribe).toBeCalled()
        })

        it('should not canceld stream when it is the first api called', async () => {
          const cancel = jest.spyOn(streamObserverMock, 'cancel')
          streamObserverMock.onCompleted({})

          const it = result[Symbol.asyncIterator]()

          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          await it.return!(new ResultSummary('query', {}, {}))

          await it.next()

          expect(cancel).not.toBeCalled()
        })

        it('should not cancel stream when the stream is already initialized ', async () => {
          const cancel = jest.spyOn(streamObserverMock, 'cancel')
          const keys = ['a', 'b']
          const rawRecord1 = [1, 2]
          const rawRecord2 = [3, 4]

          streamObserverMock.onKeys(keys)
          streamObserverMock.onNext(rawRecord1)
          streamObserverMock.onNext(rawRecord2)
          streamObserverMock.onCompleted({})

          const it = result[Symbol.asyncIterator]()

          await it.next()
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          await it.return!(new ResultSummary('query', {}, {}))

          expect(cancel).toBeCalled()
        })

        it('should prevent following next requests to subscribe to the stream', async () => {
          const subscribe = jest.spyOn(streamObserverMock, 'subscribe')
          streamObserverMock.onCompleted({})

          const it = result[Symbol.asyncIterator]()

          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          await it.return!(new ResultSummary('query', {}, {}))
          await it.next()

          expect(subscribe).toBeCalledTimes(1)
        })

        it('should prevent following peek requests to subscribe to the stream', async () => {
          const subscribe = jest.spyOn(streamObserverMock, 'subscribe')
          streamObserverMock.onCompleted({})

          const it = result[Symbol.asyncIterator]()

          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          await it.return!(new ResultSummary('query', {}, {}))
          await it.peek()

          expect(subscribe).toBeCalledTimes(1)
        })
      })

      describe('.peek()', () => {
        it('should pause the stream and then resume the stream', async () => {
          const pause = jest.spyOn(streamObserverMock, 'pause')
          const resume = jest.spyOn(streamObserverMock, 'resume')
          streamObserverMock.onCompleted({})

          const it = result[Symbol.asyncIterator]()
          await it.peek()

          expect(pause).toHaveBeenCalledTimes(1)
          expect(resume).toHaveBeenCalledTimes(1)
          expect(pause.mock.invocationCallOrder[0])
            .toBeLessThan(resume.mock.invocationCallOrder[0])
        })

        it('should pause the stream before subscribe', async () => {
          const subscribe = jest.spyOn(streamObserverMock, 'subscribe')
          const pause = jest.spyOn(streamObserverMock, 'pause')
          streamObserverMock.onCompleted({})

          const it = result[Symbol.asyncIterator]()
          await it.peek()

          expect(pause.mock.invocationCallOrder[0])
            .toBeLessThan(subscribe.mock.invocationCallOrder[0])
        })

        it('should pause the stream if queue is bigger than high watermark', async () => {
          const pause = jest.spyOn(streamObserverMock, 'pause')
          streamObserverMock.onKeys(['a'])

          for (let i = 0; i <= watermarks.high; i++) {
            streamObserverMock.onNext([i])
          }

          const it = result[Symbol.asyncIterator]()
          await it.peek()

          expect(pause).toBeCalledTimes(1)
        })

        it('should call resume if queue is smaller than low watermark', async () => {
          const resume = jest.spyOn(streamObserverMock, 'resume')
          streamObserverMock.onKeys(['a'])

          for (let i = 0; i < watermarks.low - 1; i++) {
            streamObserverMock.onNext([i])
          }

          const it = result[Symbol.asyncIterator]()
          await it.peek()

          expect(resume).toBeCalledTimes(1)
        })

        it('should return the first record', async () => {
          const keys = ['a', 'b']
          const rawRecord1 = [1, 2]
          const rawRecord2 = [3, 4]

          streamObserverMock.onKeys(keys)
          streamObserverMock.onNext(rawRecord1)
          streamObserverMock.onNext(rawRecord2)

          streamObserverMock.onCompleted({})

          const it = result[Symbol.asyncIterator]()
          const { value: record } = await it.peek()

          expect(record).toEqual(new Record(keys, rawRecord1))
        })

        it('should not move the cursor ', async () => {
          const keys = ['a', 'b']
          const rawRecord1 = [1, 2]
          const rawRecord2 = [3, 4]

          streamObserverMock.onKeys(keys)
          streamObserverMock.onNext(rawRecord1)
          streamObserverMock.onNext(rawRecord2)

          streamObserverMock.onCompleted({})

          const it = result[Symbol.asyncIterator]()
          const { value: record } = await it.peek()
          const { value: nextRecord } = await it.next()

          expect(record).toEqual(new Record(keys, rawRecord1))
          expect(record).toEqual(nextRecord)
        })

        it('should not move the cursor when buffer is empty ', async () => {
          const keys = ['a', 'b']
          const rawRecord1 = [1, 2]
          const rawRecord2 = [3, 4]

          streamObserverMock.onKeys(keys)

          setTimeout(() => {
            streamObserverMock.onNext(rawRecord1)
            streamObserverMock.onNext(rawRecord2)

            streamObserverMock.onCompleted({})
          }, 100)

          const it = result[Symbol.asyncIterator]()
          const { value: record } = await it.peek()
          const { value: nextRecord } = await it.next()

          expect(record).toEqual(new Record(keys, rawRecord1))
          expect(record).toEqual(nextRecord)
        })

        it('should not move the cursor when buffer is empty next element is error ', async () => {
          const keys = ['a', 'b']

          streamObserverMock.onKeys(keys)

          setTimeout(() => {
            streamObserverMock.onError(expectedError)
          }, 100)

          const it = result[Symbol.asyncIterator]()
          let peekError: Error | null = null
          let nextError: Error | null = null

          try {
            await it.peek()
          } catch (e) {
            peekError = e
          }

          try {
            await it.next()
          } catch (e) {
            nextError = e
          }

          expect(peekError).toEqual(expectedError)
          expect(peekError).toEqual(nextError)
        })
      })

      describe('onError', () => {
        it('should throws an exception while iterate over records', async () => {
          const keys = ['a', 'b']
          const rawRecord1 = [1, 2]
          const rawRecord2 = [3, 4]
          const expectedError = new Error('test')
          let observedError: Error | undefined

          streamObserverMock.onKeys(keys)
          streamObserverMock.onNext(rawRecord1)
          streamObserverMock.onNext(rawRecord2)

          const records = []

          try {
            for await (const record of result) {
              records.push(record)
              streamObserverMock.onError(expectedError)
            }
          } catch (err) {
            observedError = err
          }

          expect(observedError).toEqual(expectedError)
        })

        it('should resolve the already received records', async () => {
          const keys = ['a', 'b']
          const rawRecord1 = [1, 2]
          const rawRecord2 = [3, 4]
          const expectedError = new Error('test')

          streamObserverMock.onKeys(keys)
          streamObserverMock.onNext(rawRecord1)
          streamObserverMock.onNext(rawRecord2)

          const records = []

          try {
            for await (const record of result) {
              records.push(record)
              streamObserverMock.onError(expectedError)
            }
          } catch (err) {
            // do nothing
          }

          expect(records).toEqual([
            new Record(keys, rawRecord1),
            new Record(keys, rawRecord2)
          ])
        })

        it('should throws it when it is the event after onKeys', async () => {
          const keys = ['a', 'b']
          const expectedError = new Error('test')
          let observedError: Error | undefined

          streamObserverMock.onKeys(keys)
          streamObserverMock.onError(expectedError)

          const records = []

          try {
            for await (const record of result) {
              records.push(record)
            }
          } catch (err) {
            observedError = err
          }

          expect(observedError).toEqual(expectedError)
        })

        it('should throws it when it is the first and unique event', async () => {
          const expectedError = new Error('test')
          let observedError: Error | undefined

          streamObserverMock.onError(expectedError)

          const records = []

          try {
            for await (const record of result) {
              records.push(record)
            }
          } catch (err) {
            observedError = err
          }

          expect(observedError).toEqual(expectedError)
        })
      })
    })

    describe('.isOpen()', () => {
      it('should return true when the stream is open', async () => {
        await result._subscribe({})

        expect(result.isOpen()).toBe(true)
      })

      it('should return false when the stream is closed', async () => {
        streamObserverMock.onCompleted({})

        await new Promise((resolve) => result.subscribe({
          onCompleted: resolve,
          onError: resolve
        }))

        expect(result.isOpen()).toBe(false)
      })

      it('should return false when the stream failed', async () => {
        streamObserverMock.onError(new Error('test'))

        await result._subscribe({}).catch(() => {})

        expect(result.isOpen()).toBe(false)
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

    describe('asyncIterator', () => {
      it('should be resolved with an empty array of records', async () => {
        const records = []

        for await (const record of result) {
          records.push(record)
        }

        expect(records).toStrictEqual([])
      })

      it('should be resolved with expected result summary', async () => {
        const it = result[Symbol.asyncIterator]()
        const next = await it.next()

        expect(next.done).toBe(true)
        expect(next.value).toStrictEqual(expectedResultSummary)
      })

      describe('.peek()', () => {
        it('should be resolved with expected result summary', async () => {
          const it = result[Symbol.asyncIterator]()
          const next = await it.peek()

          expect(next.done).toBe(true)
          expect(next.value).toStrictEqual(expectedResultSummary)
        })
      })
    })

    describe('isOpen()', () => {
      it('should be true', () => {
        expect(result.isOpen()).toBe(true)
      })

      it('should be false after any interaction with the stream', async () => {
        const it = result[Symbol.asyncIterator]()
        await it.next()

        expect(result.isOpen()).toBe(false)
      })
    })
  })

  describe.each([
    [
      'Promise.resolve(new observer.FailedObserver({ error: expectedError }))',
      async () => await Promise.resolve(new observer.FailedObserver({ error: expectedError }))
    ],
    ['Promise.reject(expectedError)', async () => await Promise.reject(expectedError)]
  ])('new Result(%s, "query") ', (_, getPromise) => {
    let result: Result

    beforeEach(() => {
      result = new Result(getPromise(), 'query')
    })

    describe('.keys()', () => {
      shouldReturnRejectedPromiseWithTheExpectedError(async () => await result.keys())
    })

    describe('.summary()', () => {
      shouldReturnRejectedPromiseWithTheExpectedError(async () => await result.summary())
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

    describe('asyncIterator', () => {
      shouldReturnRejectedPromiseWithTheExpectedError(async () => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for await (const _ of result) {
          // do nothing
        }
      })

      describe('.peek()', () => {
        shouldReturnRejectedPromiseWithTheExpectedError(async () => {
          const it = result[Symbol.asyncIterator]()
          await it.peek()
        })
      })
    })

    describe('.isOpen()', () => {
      it('should be true', async () => {
        expect(result.isOpen()).toBe(true)

        // consume the stream to avoid unhaddled errors
        try {
          await result.summary()
        } catch (error) {
        }
      })

      it('should be false after any interactio with the stream', async () => {
        const it = result[Symbol.asyncIterator]()

        try {
          await it.next()
        } catch (error) {
          // this's fine
        }

        expect(result.isOpen()).toBe(false)
      })
    })

    function shouldReturnRejectedPromiseWithTheExpectedError<T> (
      supplier: () => Promise<T>
    ): void {
      it('should return rejected promise with the expected error', async () =>
        await expect(supplier()).rejects.toBe(expectedError))
    }
  })
})

function simulateStream (
  records: any[][],
  observer: ResultStreamObserverMock,
  fetchSize: number,
  timeout: number = 1): {
    resume: () => void
    pause: () => void
  } {
  const state = {
    paused: false,
    streaming: false,
    finished: false,
    consumed: 0
  }

  const streaming = (): void => {
    if (state.streaming || state.finished) {
      return
    }
    state.streaming = true
    state.consumed = 0

    const interval = setInterval(() => {
      state.streaming = state.consumed < fetchSize
      state.finished = records.length === 0

      if (state.finished) {
        observer.onCompleted({})
        clearInterval(interval)
        return
      }

      if (!state.streaming) {
        clearInterval(interval)
        if (!state.paused) {
          streaming()
        }
        return
      }

      const record = records.shift()
      if (record !== undefined) {
        observer.onNext(record)
      }
      state.consumed++
    }, timeout)
  }

  return {
    pause: () => {
      state.paused = true
    },
    resume: () => {
      state.paused = false
      streaming()
    }
  }

  /*
  return () => {

    return true
  }
  */
}
