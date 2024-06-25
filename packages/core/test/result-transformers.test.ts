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

import { EagerResult, Integer, newError, Record, Result, ResultSummary } from '../src'
import resultTransformers from '../src/result-transformers'
import ResultStreamObserverMock from './utils/result-stream-observer.mock'

describe('resultTransformers', () => {
  describe.each([
    ['.eagerResultTransformer()', resultTransformers.eagerResultTransformer],
    ['.eager()', resultTransformers.eager]
  ])('%s', (_, transformerFactory) => {
    describe('with a valid result', () => {
      it('it should return an EagerResult', async () => {
        const resultStreamObserverMock = new ResultStreamObserverMock()
        const query = 'Query'
        const params = { a: 1 }
        const meta = { db: 'adb' }
        const result = new Result(Promise.resolve(resultStreamObserverMock), query, params)
        const keys = ['a', 'b']
        const rawRecord1 = [1, 2]
        const rawRecord2 = [3, 4]
        resultStreamObserverMock.onKeys(keys)
        resultStreamObserverMock.onNext(rawRecord1)
        resultStreamObserverMock.onNext(rawRecord2)
        resultStreamObserverMock.onCompleted(meta)

        const eagerResult: EagerResult = await transformerFactory()(result)

        expect(eagerResult.keys).toEqual(keys)
        expect(eagerResult.records).toEqual([
          new Record(keys, rawRecord1),
          new Record(keys, rawRecord2)
        ])
        expect(eagerResult.summary).toEqual(
          new ResultSummary(query, params, meta)
        )
      })

      it('it should return a type-safe EagerResult', async () => {
        interface Car {
          model: string
          year: number
        }
        const resultStreamObserverMock = new ResultStreamObserverMock()
        const query = 'Query'
        const params = { a: 1 }
        const meta = { db: 'adb' }
        const result = new Result(Promise.resolve(resultStreamObserverMock), query, params)
        const keys = ['model', 'year']
        const rawRecord1 = ['Beautiful Sedan', 1987]
        const rawRecord2 = ['Hot Hatch', 1995]

        resultStreamObserverMock.onKeys(keys)
        resultStreamObserverMock.onNext(rawRecord1)
        resultStreamObserverMock.onNext(rawRecord2)
        resultStreamObserverMock.onCompleted(meta)
        const eagerResult: EagerResult<Car> = await transformerFactory<Car>()(result)

        expect(eagerResult.keys).toEqual(keys)
        expect(eagerResult.records).toEqual([
          new Record(keys, rawRecord1),
          new Record(keys, rawRecord2)
        ])
        expect(eagerResult.summary).toEqual(
          new ResultSummary(query, params, meta)
        )

        const [car1, car2] = eagerResult.records.map(record => record.toObject())

        expect(car1.model).toEqual(rawRecord1[0])
        expect(car1.year).toEqual(rawRecord1[1])

        expect(car2.model).toEqual(rawRecord2[0])
        expect(car2.year).toEqual(rawRecord2[1])
      })
    })

    describe('when results fail', () => {
      it('should propagate the exception', async () => {
        const expectedError = newError('expected error')
        const result = new Result(Promise.reject(expectedError), 'query')

        await expect(transformerFactory()(result)).rejects.toThrow(expectedError)
      })
    })
  })

  describe.each([
    ['.mappedResultTransformer', resultTransformers.mappedResultTransformer],
    ['.mapped', resultTransformers.mapped]
  ])('%s', (_, transformerFactory) => {
    describe('with a valid result', () => {
      it('should map and collect the result', async () => {
        const {
          rawRecords,
          result,
          keys,
          meta,
          query,
          params
        } = scenario()

        const map = jest.fn((record) => record.get('a') as number)
        const collect = jest.fn((records: number[], summary: ResultSummary, keys: string[]) => ({
          as: records,
          db: summary.database.name,
          ks: keys
        }))

        const transform = transformerFactory({ map, collect })

        const { as, db, ks }: { as: number[], db: string | undefined | null, ks: string[] } = await transform(result)

        expect(as).toEqual(rawRecords.map(rec => rec[0]))
        expect(db).toEqual(meta.db)
        expect(ks).toEqual(keys)

        expect(map).toHaveBeenCalledTimes(rawRecords.length)

        for (const rawRecord of rawRecords) {
          expect(map).toHaveBeenCalledWith(new Record(keys, rawRecord))
        }

        expect(collect).toHaveBeenCalledTimes(1)
        expect(collect).toHaveBeenCalledWith(rawRecords.map(rec => rec[0]), new ResultSummary(query, params, meta), keys)
      })

      it('should map the records', async () => {
        const {
          rawRecords,
          result,
          keys,
          meta,
          query,
          params
        } = scenario()

        const map = jest.fn((record) => record.get('a') as number)

        const transform = transformerFactory({ map })

        const { records: as, summary, keys: receivedKeys }: { records: number[], summary: ResultSummary, keys: string[] } = await transform(result)

        expect(as).toEqual(rawRecords.map(rec => rec[0]))
        expect(summary).toEqual(new ResultSummary(query, params, meta))
        expect(receivedKeys).toEqual(keys)

        expect(map).toHaveBeenCalledTimes(rawRecords.length)

        for (const rawRecord of rawRecords) {
          expect(map).toHaveBeenCalledWith(new Record(keys, rawRecord))
        }
      })

      it('should collect the result', async () => {
        const {
          rawRecords,
          result,
          keys,
          meta,
          query,
          params
        } = scenario()

        const collect = jest.fn((records: Record[], summary: ResultSummary, keys: string[]) => ({
          recordsFetched: records.length,
          db: summary.database.name,
          ks: keys
        }))

        const transform = transformerFactory({ collect })

        const { recordsFetched, db, ks }: { recordsFetched: number, db: string | undefined | null, ks: string[] } = await transform(result)

        expect(recordsFetched).toEqual(rawRecords.length)
        expect(db).toEqual(meta.db)
        expect(ks).toEqual(keys)

        expect(collect).toHaveBeenCalledTimes(1)
        expect(collect).toHaveBeenCalledWith(rawRecords.map(rec => new Record(keys, rec)), new ResultSummary(query, params, meta), keys)
      })

      it('should skip the undefined records', async () => {
        const {
          rawRecords,
          result,
          keys
        } = scenario()
        let firstCall = true
        const map = jest.fn((record) => {
          if (firstCall) {
            firstCall = false
            return undefined
          }
          return record.get('a') as number
        })

        const transform = transformerFactory({ map })

        const { records: as }: { records: number[] } = await transform(result)

        const [,...tailRecords] = rawRecords
        expect(as).toEqual(tailRecords.map(record => record[keys.indexOf('a')]))
        expect(map).toHaveBeenCalledTimes(rawRecords.length)
        for (const rawRecord of rawRecords) {
          expect(map).toHaveBeenCalledWith(new Record(keys, rawRecord))
        }
      })

      it.each([
        undefined,
        null,
        {},
        { Map: () => {} },
        { Collect: () => {} }
      ])('should throw if miss-configured [config=%o]', (config) => {
        // @ts-expect-error
        expect(() => transformerFactory(config))
          .toThrow(newError('Requires a map or/and a collect functions.'))
      })

      // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
      function scenario () {
        const resultStreamObserverMock = new ResultStreamObserverMock()
        const query = 'Query'
        const params = { a: 1 }
        const meta = { db: 'adb' }
        const result = new Result(Promise.resolve(resultStreamObserverMock), query, params)
        const keys = ['a', 'b']
        const rawRecord1 = [1, 2]
        const rawRecord2 = [3, 4]
        resultStreamObserverMock.onKeys(keys)
        resultStreamObserverMock.onNext(rawRecord1)
        resultStreamObserverMock.onNext(rawRecord2)
        resultStreamObserverMock.onCompleted(meta)

        return {
          resultStreamObserverMock,
          result,
          meta,
          params,
          keys,
          query,
          rawRecords: [rawRecord1, rawRecord2]
        }
      }
    })

    describe('when results fail', () => {
      it('should propagate the exception', async () => {
        const expectedError = newError('expected error')
        const result = new Result(Promise.reject(expectedError), 'query')
        const transformer = transformerFactory({
          collect: (records) => records
        })

        await expect(transformer(result)).rejects.toThrow(expectedError)
      })
    })
  })

  describe('.summary()', () => {
    describe('with a valid result', () => {
      it('should return a ResultSummary', async () => {
        const resultStreamObserverMock = new ResultStreamObserverMock()
        const query = 'Query'
        const params = { a: 1 }
        const meta = { db: 'adb' }
        const result = new Result(Promise.resolve(resultStreamObserverMock), query, params)
        const keys = ['a', 'b']
        const rawRecord1 = [1, 2]
        const rawRecord2 = [3, 4]
        resultStreamObserverMock.onKeys(keys)
        resultStreamObserverMock.onNext(rawRecord1)
        resultStreamObserverMock.onNext(rawRecord2)
        resultStreamObserverMock.onCompleted(meta)

        const summary: ResultSummary = await resultTransformers.summary()(result)

        expect(summary).toEqual(
          new ResultSummary(query, params, meta)
        )
      })

      it('should cancel stream', async () => {
        const meta = { db: 'adb' }
        const resultStreamObserverMock = new ResultStreamObserverMock()
        const cancelSpy = jest.spyOn(resultStreamObserverMock, 'cancel')
        cancelSpy.mockImplementation(() => resultStreamObserverMock.onCompleted(meta))
        const query = 'Query'
        const params = { a: 1 }
        const result = new Result(Promise.resolve(resultStreamObserverMock), query, params)
        const keys = ['a', 'b']
        const rawRecord1 = [1, 2]
        const rawRecord2 = [3, 4]
        resultStreamObserverMock.onKeys(keys)
        resultStreamObserverMock.onNext(rawRecord1)
        resultStreamObserverMock.onNext(rawRecord2)

        const summary: ResultSummary = await resultTransformers.summary()(result)

        expect(cancelSpy).toHaveBeenCalledTimes(1)
        expect(summary).toEqual(
          new ResultSummary(query, params, meta)
        )
      })

      it('should return a ResultSummary<number>', async () => {
        const resultStreamObserverMock = new ResultStreamObserverMock()
        const query = 'Query'
        const params = { a: 1 }
        const meta = { db: 'adb' }
        const result = new Result(Promise.resolve(resultStreamObserverMock), query, params)
        const keys = ['model', 'year']
        const rawRecord1 = ['Beautiful Sedan', 1987]
        const rawRecord2 = ['Hot Hatch', 1995]

        resultStreamObserverMock.onKeys(keys)
        resultStreamObserverMock.onNext(rawRecord1)
        resultStreamObserverMock.onNext(rawRecord2)
        resultStreamObserverMock.onCompleted(meta)
        const summary = await resultTransformers.summary<number>()(result)

        const typeAssertionNumber: ResultSummary<number> = summary
        // @ts-expect-error
        const typeAssertionInteger: ResultSummary<Integer> = summary
        // @ts-expect-error
        const typeAssertionBigInt: ResultSummary<bigint> = summary

        expect(typeAssertionNumber).toEqual(
          new ResultSummary<Integer>(query, params, meta)
        )

        expect(typeAssertionInteger).toEqual(
          new ResultSummary<Integer>(query, params, meta)
        )

        expect(typeAssertionBigInt).toEqual(
          new ResultSummary<Integer>(query, params, meta)
        )
      })

      it('should return a ResultSummary<bigint>', async () => {
        const resultStreamObserverMock = new ResultStreamObserverMock()
        const query = 'Query'
        const params = { a: 1 }
        const meta = { db: 'adb' }
        const result = new Result(Promise.resolve(resultStreamObserverMock), query, params)
        const keys = ['model', 'year']
        const rawRecord1 = ['Beautiful Sedan', 1987]
        const rawRecord2 = ['Hot Hatch', 1995]

        resultStreamObserverMock.onKeys(keys)
        resultStreamObserverMock.onNext(rawRecord1)
        resultStreamObserverMock.onNext(rawRecord2)
        resultStreamObserverMock.onCompleted(meta)
        const summary = await resultTransformers.summary<bigint>()(result)

        const typeAssertionBigInt: ResultSummary<bigint> = summary
        // @ts-expect-error
        const typeAssertionNumber: ResultSummary<number> = summary
        // @ts-expect-error
        const typeAssertionInteger: ResultSummary<Integer> = summary

        expect(typeAssertionNumber).toEqual(
          new ResultSummary<Integer>(query, params, meta)
        )

        expect(typeAssertionInteger).toEqual(
          new ResultSummary<Integer>(query, params, meta)
        )

        expect(typeAssertionBigInt).toEqual(
          new ResultSummary<Integer>(query, params, meta)
        )
      })

      it('should return a ResultSummary<Integer>', async () => {
        const resultStreamObserverMock = new ResultStreamObserverMock()
        const query = 'Query'
        const params = { a: 1 }
        const meta = { db: 'adb' }
        const result = new Result(Promise.resolve(resultStreamObserverMock), query, params)
        const keys = ['model', 'year']
        const rawRecord1 = ['Beautiful Sedan', 1987]
        const rawRecord2 = ['Hot Hatch', 1995]

        resultStreamObserverMock.onKeys(keys)
        resultStreamObserverMock.onNext(rawRecord1)
        resultStreamObserverMock.onNext(rawRecord2)
        resultStreamObserverMock.onCompleted(meta)
        const summary = await resultTransformers.summary<Integer>()(result)

        const typeAssertionInteger: ResultSummary<Integer> = summary
        // @ts-expect-error
        const typeAssertionNumber: ResultSummary<number> = summary
        // @ts-expect-error
        const typeAssertionBigInt: ResultSummary<bigint> = summary

        expect(typeAssertionInteger).toEqual(
          new ResultSummary<Integer>(query, params, meta)
        )

        expect(typeAssertionNumber).toEqual(
          new ResultSummary<Integer>(query, params, meta)
        )

        expect(typeAssertionBigInt).toEqual(
          new ResultSummary<Integer>(query, params, meta)
        )
      })
    })

    describe('when results fail', () => {
      it('should propagate the exception', async () => {
        const expectedError = newError('expected error')
        const result = new Result(Promise.reject(expectedError), 'query')

        await expect(resultTransformers.summary()(result)).rejects.toThrow(expectedError)
      })
    })
  })

  describe('.first', () => {
    describe('with a valid result', () => {
      it('should return an single Record', async () => {
        const resultStreamObserverMock = new ResultStreamObserverMock()
        const query = 'Query'
        const params = { a: 1 }
        const meta = { db: 'adb' }
        const result = new Result(Promise.resolve(resultStreamObserverMock), query, params)
        const keys = ['a', 'b']
        const rawRecord1 = [1, 2]
        resultStreamObserverMock.onKeys(keys)
        resultStreamObserverMock.onNext(rawRecord1)
        resultStreamObserverMock.onCompleted(meta)

        const record = await resultTransformers.first()(result)

        expect(record).toEqual(new Record(keys, rawRecord1))
      })

      it('it should return an undefined when empty', async () => {
        const resultStreamObserverMock = new ResultStreamObserverMock()
        const query = 'Query'
        const params = { a: 1 }
        const meta = { db: 'adb' }
        const result = new Result(Promise.resolve(resultStreamObserverMock), query, params)
        const keys = ['a', 'b']
        resultStreamObserverMock.onKeys(keys)
        resultStreamObserverMock.onCompleted(meta)

        const record = await resultTransformers.first()(result)

        expect(record).toEqual(undefined)
      })

      it('should return a type-safe single Record', async () => {
        interface Car {
          model: string
          year: number
        }
        const resultStreamObserverMock = new ResultStreamObserverMock()
        const query = 'Query'
        const params = { a: 1 }
        const meta = { db: 'adb' }
        const result = new Result(Promise.resolve(resultStreamObserverMock), query, params)
        const keys = ['model', 'year']
        const rawRecord1 = ['Beautiful Sedan', 1987]

        resultStreamObserverMock.onKeys(keys)
        resultStreamObserverMock.onNext(rawRecord1)
        resultStreamObserverMock.onCompleted(meta)
        const record = await resultTransformers.first<Car>()(result)

        expect(record).toEqual(new Record(keys, rawRecord1))

        const car = record?.toObject()

        expect(car?.model).toEqual(rawRecord1[0])
        expect(car?.year).toEqual(rawRecord1[1])
      })

      it('should return an single Record', async () => {
        const meta = { db: 'adb' }
        const resultStreamObserverMock = new ResultStreamObserverMock()
        const cancelSpy = jest.spyOn(resultStreamObserverMock, 'cancel')
        cancelSpy.mockImplementation(() => resultStreamObserverMock.onCompleted(meta))

        const query = 'Query'
        const params = { a: 1 }
        const result = new Result(Promise.resolve(resultStreamObserverMock), query, params)
        const keys = ['a', 'b']
        const rawRecord1 = [1, 2]
        const rawRecord2 = [1, 2]
        resultStreamObserverMock.onKeys(keys)
        resultStreamObserverMock.onNext(rawRecord1)
        resultStreamObserverMock.onNext(rawRecord2)

        const record = await resultTransformers.first()(result)

        await new Promise(resolve => setTimeout(resolve, 100))
        expect(record).toEqual(new Record(keys, rawRecord1))
        expect(cancelSpy).toHaveBeenCalledTimes(1)
      })
    })

    describe('when results fail', () => {
      it('should propagate the exception', async () => {
        const expectedError = newError('expected error')
        const result = new Result(Promise.reject(expectedError), 'query')

        await expect(resultTransformers.first()(result)).rejects.toThrow(expectedError)
      })
    })
  })
})
