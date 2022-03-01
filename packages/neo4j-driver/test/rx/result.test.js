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

import RxResult from '../../src/result-rx'
import { newError, Record, Result, ResultSummary } from 'neo4j-driver-core'
import { Observable } from 'rxjs'
import { toArray, take, tap } from 'rxjs/operators'

describe('#unit RxResult', () => {
  describe('.records()', () => {
    it('should be able the consume the full stream', async () => {
      const fetchSize = 3
      const stream = new ResultStreamObserverMock()
      const result = new Result(
        Promise.resolve(stream),
        'query',
        undefined,
        undefined,
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
      const queue = [rawRecord3, rawRecord4, rawRecord5, rawRecord6]

      const simuatedStream = simulateStream(queue, stream, fetchSize, 2)

      spyOn(stream, 'resume').and.callFake(
        simuatedStream.resume.bind(simuatedStream)
      )

      spyOn(stream, 'pause').and.callFake(
        simuatedStream.pause.bind(simuatedStream)
      )

      stream.onKeys(keys)
      stream.onNext(rawRecord1)
      stream.onNext(rawRecord2)

      const rxResult = new RxResult(
        new Observable(observer => {
          observer.next(result)
          observer.complete({})
        })
      )

      const records = await rxResult
        .records()
        .pipe(toArray())
        .toPromise()

      expect(records).toEqual([
        new Record(keys, rawRecord1),
        new Record(keys, rawRecord2),
        new Record(keys, rawRecord3),
        new Record(keys, rawRecord4),
        new Record(keys, rawRecord5),
        new Record(keys, rawRecord6)
      ])
    })

    it('should be able to take one', async () => {
      const fetchSize = 3
      const stream = new ResultStreamObserverMock()
      const result = new Result(
        Promise.resolve(stream),
        'query',
        undefined,
        undefined,
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
      const queue = [rawRecord3, rawRecord4, rawRecord5, rawRecord6]

      const simuatedStream = simulateStream(queue, stream, fetchSize, 2)

      spyOn(stream, 'resume').and.callFake(
        simuatedStream.resume.bind(simuatedStream)
      )

      spyOn(stream, 'pause').and.callFake(
        simuatedStream.pause.bind(simuatedStream)
      )

      stream.onKeys(keys)
      stream.onNext(rawRecord1)
      stream.onNext(rawRecord2)

      const rxResult = new RxResult(
        new Observable(observer => {
          observer.next(result)
          observer.complete({})
        })
      )

      const record = await rxResult
        .records()
        .pipe(take(1))
        .toPromise()

      expect(record).toEqual(new Record(keys, rawRecord1))
    })

    it('should be able to pause the stream', async () => {
      const fetchSize = 3
      const stream = new ResultStreamObserverMock()
      const result = new Result(
        Promise.resolve(stream),
        'query',
        undefined,
        undefined,
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
      const queue = [rawRecord3, rawRecord4, rawRecord5, rawRecord6]

      const simuatedStream = simulateStream(queue, stream, fetchSize, 1)

      const resume = spyOn(stream, 'resume').and.callFake(
        simuatedStream.resume.bind(simuatedStream)
      )

      const pause = spyOn(stream, 'pause').and.callFake(
        simuatedStream.pause.bind(simuatedStream)
      )

      stream.onKeys(keys)
      stream.onNext(rawRecord1)
      stream.onNext(rawRecord2)

      const rxResult = new RxResult(
        new Observable(observer => {
          observer.next(result)
          observer.complete({})
        })
      )

      const record = await rxResult
        .records()
        .pipe(
          tap(() => rxResult.pause()),
          take(1)
        )
        .toPromise()

      expect(record).toEqual(new Record(keys, rawRecord1))

      await new Promise(resolve => setTimeout(resolve, 1000))

      expect(resume.calls.mostRecent().invocationOrder).toBeLessThan(
        pause.calls.mostRecent().invocationOrder
      )
    })

    it('should be able to resume the stream', async () => {
      const fetchSize = 3
      const stream = new ResultStreamObserverMock()
      const result = new Result(
        Promise.resolve(stream),
        'query',
        undefined,
        undefined,
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
      const queue = [rawRecord3, rawRecord4, rawRecord5, rawRecord6]

      const simuatedStream = simulateStream(queue, stream, fetchSize, 1)

      const resume = spyOn(stream, 'resume').and.callFake(
        simuatedStream.resume.bind(simuatedStream)
      )

      const pause = spyOn(stream, 'pause').and.callFake(
        simuatedStream.pause.bind(simuatedStream)
      )

      stream.onKeys(keys)
      stream.onNext(rawRecord1)
      stream.onNext(rawRecord2)

      const rxResult = new RxResult(
        new Observable(observer => {
          observer.next(result)
          observer.complete({})
        })
      )

      const record = await rxResult
        .records()
        .pipe(
          tap(() => rxResult.pause()),
          take(1)
        )
        .toPromise()

      expect(record).toEqual(new Record(keys, rawRecord1))

      await waitFor(1000)

      expect(resume.calls.mostRecent().invocationOrder).toBeLessThan(
        pause.calls.mostRecent().invocationOrder
      )

      await rxResult.resume()

      await waitFor(1000)

      expect(resume.calls.mostRecent().invocationOrder).toBeGreaterThan(
        pause.calls.mostRecent().invocationOrder
      )
    })

    it('should be able to maual control the stream', async () => {
      const fetchSize = 3
      const stream = new ResultStreamObserverMock()
      const result = new Result(
        Promise.resolve(stream),
        'query',
        undefined,
        undefined,
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
      const queue = [rawRecord3, rawRecord4, rawRecord5, rawRecord6]

      const simuatedStream = simulateStream(queue, stream, fetchSize, 1)

      const resume = spyOn(stream, 'resume').and.callFake(
        simuatedStream.resume.bind(simuatedStream)
      )

      const pause = spyOn(stream, 'pause').and.callFake(
        simuatedStream.pause.bind(simuatedStream)
      )

      stream.onKeys(keys)
      stream.onNext(rawRecord1)
      stream.onNext(rawRecord2)

      const rxResult = new RxResult(
        new Observable(observer => {
          observer.next(result)
          observer.complete({})
        })
      )

      const records = await new Promise(resolve => {
        const list = []
        rxResult.pause()
        rxResult
          .records()
          .pipe(take(2))
          .subscribe({
            next: async record => {
              list.push(record)
              await rxResult.push()
            },
            complete: () => resolve(list)
          })
      })

      expect(records).toEqual([
        new Record(keys, rawRecord1),
        new Record(keys, rawRecord2)
      ])

      await waitFor(1000)

      expect(resume.calls.mostRecent().invocationOrder).toBeLessThan(
        pause.calls.mostRecent().invocationOrder
      )
    })

    it('should be able to capture errors during the stream', async () => {
      const fetchSize = 3
      const stream = new ResultStreamObserverMock()
      const result = new Result(
        Promise.resolve(stream),
        'query',
        undefined,
        undefined,
        {
          low: fetchSize * 0.3, // Same as calculate in the session.ts
          high: fetchSize * 0.7
        }
      )
      const expectedError = newError('the error')

      stream.onError(expectedError)

      try {
        await new RxResult(
          new Observable(observer => {
            observer.next(result)
            observer.complete({})
          })
        )
          .records()
          .pipe(take(1))
          .toPromise()
        expect('should not reach here').toBe('')
      } catch (error) {
        expect(error).toEqual(expectedError)
      }
    })

    describe('and then result.consume()', () => {
      it('should be able to get a summary of a consumed stream', async () => {
        const fetchSize = 3
        const metadata = {
          resultConsumedAfter: 20,
          resultAvailableAfter: 124,
          extraInfo: 'extra'
        }
        const query = 'query'
        const parameters = { a: 1, b: 2 }
        const stream = new ResultStreamObserverMock()
        const result = new Result(
          Promise.resolve(stream),
          query,
          parameters,
          undefined,
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
        const queue = [rawRecord3, rawRecord4, rawRecord5, rawRecord6]

        const simuatedStream = simulateStream(
          queue,
          stream,
          fetchSize,
          2,
          metadata
        )

        spyOn(stream, 'resume').and.callFake(
          simuatedStream.resume.bind(simuatedStream)
        )

        spyOn(stream, 'pause').and.callFake(
          simuatedStream.pause.bind(simuatedStream)
        )

        stream.onKeys(keys)
        stream.onNext(rawRecord1)
        stream.onNext(rawRecord2)

        const rxResult = new RxResult(
          new Observable(observer => {
            observer.next(result)
            observer.complete({})
          })
        )

        await rxResult
          .records()
          .pipe(toArray())
          .toPromise()

        const summary = await rxResult.consume().toPromise()

        const expectedSummary = new ResultSummary(query, parameters, metadata)

        expect(summary).toEqual(expectedSummary)
      })

      it('should be able to get a summary of a partially consumed stream', async () => {
        const fetchSize = 3
        const metadata = {
          resultConsumedAfter: 20,
          resultAvailableAfter: 124,
          extraInfo: 'extra'
        }
        const query = 'query'
        const parameters = { a: 1, b: 2 }
        const stream = new ResultStreamObserverMock()
        const result = new Result(
          Promise.resolve(stream),
          query,
          parameters,
          undefined,
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
        const queue = [rawRecord3, rawRecord4, rawRecord5, rawRecord6]

        const simuatedStream = simulateStream(
          queue,
          stream,
          fetchSize,
          2,
          metadata
        )

        spyOn(stream, 'resume').and.callFake(
          simuatedStream.resume.bind(simuatedStream)
        )

        spyOn(stream, 'pause').and.callFake(
          simuatedStream.pause.bind(simuatedStream)
        )

        stream.onKeys(keys)
        stream.onNext(rawRecord1)
        stream.onNext(rawRecord2)

        const rxResult = new RxResult(
          new Observable(observer => {
            observer.next(result)
            observer.complete({})
          })
        )

        await rxResult
          .records()
          .pipe(take(1))
          .toPromise()

        const summary = await rxResult.consume().toPromise()

        const expectedSummary = new ResultSummary(query, parameters, metadata)

        expect(summary).toEqual(expectedSummary)
      })

      it('should get an error if the stream has failed', async () => {
        const fetchSize = 3
        const stream = new ResultStreamObserverMock()
        const result = new Result(
          Promise.resolve(stream),
          'query',
          undefined,
          undefined,
          {
            low: fetchSize * 0.3, // Same as calculate in the session.ts
            high: fetchSize * 0.7
          }
        )
        const expectedError = newError('the error')

        stream.onError(expectedError)

        const resultRx = new RxResult(
          new Observable(observer => {
            observer.next(result)
            observer.complete({})
          })
        )

        try {
          await resultRx
            .records()
            .pipe(take(1))
            .toPromise()
          expect('should not reach here').toBe('')
        } catch (error) {
          expect(error).toEqual(expectedError)
        }

        try {
          await resultRx
            .consume()
            .pipe(take(1))
            .toPromise()
          expect('should not reach here').toBe('')
        } catch (error) {
          expect(error).toEqual(expectedError)
        }
      })
    })
  })

  describe('.consume()', () => {
    it('should be able to get the summary', async () => {
      const fetchSize = 3
      const metadata = {
        resultConsumedAfter: 20,
        resultAvailableAfter: 124,
        extraInfo: 'extra'
      }
      const query = 'query'
      const parameters = { a: 1, b: 2 }
      const stream = new ResultStreamObserverMock()
      const result = new Result(
        Promise.resolve(stream),
        query,
        parameters,
        undefined,
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
      const queue = [rawRecord3, rawRecord4, rawRecord5, rawRecord6]

      const simuatedStream = simulateStream(
        queue,
        stream,
        fetchSize,
        2,
        metadata
      )

      spyOn(stream, 'resume').and.callFake(
        simuatedStream.resume.bind(simuatedStream)
      )

      spyOn(stream, 'pause').and.callFake(
        simuatedStream.pause.bind(simuatedStream)
      )

      stream.onKeys(keys)
      stream.onNext(rawRecord1)
      stream.onNext(rawRecord2)

      const rxResult = new RxResult(
        new Observable(observer => {
          observer.next(result)
          observer.complete({})
        })
      )

      const summary = await rxResult.consume().toPromise()

      const expectedSummary = new ResultSummary(query, parameters, metadata)

      expect(summary).toEqual(expectedSummary)
    })

    it('should cancel the observer for discarding elements', async () => {
      const fetchSize = 3
      const metadata = {
        resultConsumedAfter: 20,
        resultAvailableAfter: 124,
        extraInfo: 'extra'
      }
      const query = 'query'
      const parameters = { a: 1, b: 2 }
      const stream = new ResultStreamObserverMock()
      const result = new Result(
        Promise.resolve(stream),
        query,
        parameters,
        undefined,
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
      const queue = [rawRecord3, rawRecord4, rawRecord5, rawRecord6]

      const simuatedStream = simulateStream(
        queue,
        stream,
        fetchSize,
        2,
        metadata
      )

      spyOn(stream, 'resume').and.callFake(
        simuatedStream.resume.bind(simuatedStream)
      )

      spyOn(stream, 'pause').and.callFake(
        simuatedStream.pause.bind(simuatedStream)
      )

      const cancel = spyOn(stream, 'cancel').and.returnValue(undefined)

      stream.onKeys(keys)
      stream.onNext(rawRecord1)
      stream.onNext(rawRecord2)

      const rxResult = new RxResult(
        new Observable(observer => {
          observer.next(result)
          observer.complete({})
        })
      )

      await rxResult.consume().toPromise()

      expect(cancel).toHaveBeenCalled()
    })

    it('should get an error if the stream has failed', async () => {
      const fetchSize = 3
      const stream = new ResultStreamObserverMock()
      const result = new Result(
        Promise.resolve(stream),
        'query',
        undefined,
        undefined,
        {
          low: fetchSize * 0.3, // Same as calculate in the session.ts
          high: fetchSize * 0.7
        }
      )
      const expectedError = newError('the error')

      stream.onError(expectedError)

      const resultRx = new RxResult(
        new Observable(observer => {
          observer.next(result)
          observer.complete({})
        })
      )

      try {
        await resultRx
          .consume()
          .pipe(take(1))
          .toPromise()
        expect('should not reach here').toBe('')
      } catch (error) {
        expect(error).toEqual(expectedError)
      }
    })
  })
})

class ResultStreamObserverMock {
  constructor () {
    this._queuedRecords = []
    this._observers = []
  }

  cancel () {}

  prepareToHandleSingleResponse () {}

  markCompleted () {}

  subscribe (observer) {
    this._observers.push(observer)

    if (observer.onError && this._error) {
      observer.onError(this._error)
      return
    }

    if (observer.onKeys && this._fieldKeys) {
      observer.onKeys(this._fieldKeys)
    }

    if (observer.onNext) {
      this._queuedRecords.forEach(record => observer.onNext(record))
    }

    if (observer.onCompleted && this._meta) {
      observer.onCompleted(this._meta)
    }
  }

  onKeys (keys) {
    this._fieldKeys = keys
    this._observers.forEach(o => {
      if (o.onKeys) {
        o.onKeys(keys)
      }
    })
  }

  onNext (rawRecord) {
    const record = new Record(this._fieldKeys, rawRecord)
    const streamed = this._observers
      .filter(o => o.onNext)
      .map(o => o.onNext(record))
      .reduce(() => true, false)

    if (!streamed) {
      this._queuedRecords.push(record)
    }
  }

  onError (error) {
    this._error = error
    this._observers.filter(o => o.onError).forEach(o => o.onError(error))
  }

  onCompleted (meta) {
    this._meta = meta
    this._observers.filter(o => o.onCompleted).forEach(o => o.onCompleted(meta))
  }

  pause () {
    // do nothing
  }

  resume () {
    // do nothing
  }
}

function simulateStream (
  records,
  observer,
  fetchSize,
  timeout = 1,
  metadata = {}
) {
  const state = {
    paused: false,
    streaming: false,
    finished: false,
    consumed: 0
  }

  const streaming = () => {
    if (state.streaming || state.finished) {
      return
    }
    state.streaming = true
    state.consumed = 0

    const interval = setInterval(() => {
      state.streaming = state.consumed < fetchSize
      state.finished = records.length === 0

      if (state.finished) {
        observer.onCompleted(metadata)
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
}

function waitFor (ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
