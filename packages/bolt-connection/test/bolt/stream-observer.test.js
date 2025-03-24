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

import {
  ResultStreamObserver,
  RouteObserver,
  ProcedureRouteObserver
} from '../../src/bolt/stream-observers'
import { RawRoutingTable } from '../../src/bolt'
import { error, newError, Record, json } from 'neo4j-driver-core'

const { PROTOCOL_ERROR } = error

const NO_OP = () => {}

describe('#unit ResultStreamObserver', () => {
  it('remembers resolved server', () => {
    const server = { address: '192.168.0.1' }
    const streamObserver = newStreamObserver(server)

    expect(streamObserver._server).toBe(server)
  })

  it('remembers subscriber', () => {
    const streamObserver = newStreamObserver()
    const subscriber = newObserver()

    streamObserver.subscribe(subscriber)

    expect(streamObserver._observers).toContain(subscriber)
  })

  it('passes received records to the subscriber', () => {
    const streamObserver = newStreamObserver()
    const receivedRecords = []
    const observer = newObserver(record => {
      receivedRecords.push(record)
    })

    streamObserver.subscribe(observer)
    streamObserver.onCompleted({ fields: ['A', 'B', 'C'] })

    streamObserver.onNext([1, 2, 3])
    streamObserver.onNext([11, 22, 33])
    streamObserver.onNext([111, 222, 333])

    expect(receivedRecords.length).toEqual(3)
    expect(receivedRecords[0].toObject()).toEqual({ A: 1, B: 2, C: 3 })
    expect(receivedRecords[1].toObject()).toEqual({ A: 11, B: 22, C: 33 })
    expect(receivedRecords[2].toObject()).toEqual({ A: 111, B: 222, C: 333 })
  })

  it('queues received record when no subscriber', () => {
    const streamObserver = newStreamObserver()

    streamObserver.onCompleted({ fields: ['A', 'B', 'C'] })

    streamObserver.onNext([1111, 2222, 3333])
    streamObserver.onNext([111, 222, 333])
    streamObserver.onNext([11, 22, 33])
    streamObserver.onNext([1, 2, 3])

    const queuedRecords = streamObserver._queuedRecords

    expect(queuedRecords.length).toEqual(4)
    expect(queuedRecords[0].toObject()).toEqual({ A: 1111, B: 2222, C: 3333 })
    expect(queuedRecords[1].toObject()).toEqual({ A: 111, B: 222, C: 333 })
    expect(queuedRecords[2].toObject()).toEqual({ A: 11, B: 22, C: 33 })
    expect(queuedRecords[3].toObject()).toEqual({ A: 1, B: 2, C: 3 })
  })

  it('passes received error the subscriber', () => {
    const streamObserver = newStreamObserver()
    const error = new Error('Invalid Cypher query')

    let receivedError = null
    const observer = newObserver(NO_OP, error => {
      receivedError = error
    })

    streamObserver.subscribe(observer)
    streamObserver.onError(error)

    expect(receivedError).toBe(error)
  })

  it('passes existing error to a new subscriber', () => {
    const streamObserver = newStreamObserver()
    const error = new Error('Invalid Cypher query')

    streamObserver.onError(error)

    streamObserver.subscribe(
      newObserver(NO_OP, receivedError => {
        expect(receivedError).toBe(error)
      })
    )
  })

  it('passes queued records to a new subscriber', () => {
    const streamObserver = newStreamObserver()

    streamObserver.onCompleted({ fields: ['A', 'B', 'C'] })

    streamObserver.onNext([1, 2, 3])
    streamObserver.onNext([11, 22, 33])
    streamObserver.onNext([111, 222, 333])

    const receivedRecords = []
    streamObserver.subscribe(
      newObserver(record => {
        receivedRecords.push(record)
      })
    )

    expect(receivedRecords.length).toEqual(3)
    expect(receivedRecords[0].toObject()).toEqual({ A: 1, B: 2, C: 3 })
    expect(receivedRecords[1].toObject()).toEqual({ A: 11, B: 22, C: 33 })
    expect(receivedRecords[2].toObject()).toEqual({ A: 111, B: 222, C: 333 })
  })

  it('passes existing metadata to a new subscriber', () => {
    const streamObserver = newStreamObserver()

    streamObserver.onCompleted({ fields: ['Foo', 'Bar', 'Baz', 'Qux'] })
    streamObserver.onCompleted({
      metaDataField1: 'value1',
      metaDataField2: 'value2'
    })

    let receivedMetaData = null
    streamObserver.subscribe(
      newObserver(NO_OP, NO_OP, metaData => {
        receivedMetaData = metaData
      })
    )

    expect(receivedMetaData).toEqual({
      metaDataField1: 'value1',
      metaDataField2: 'value2',
      stream_summary: {
        have_records_streamed: false,
        has_keys: true,
        pulled: true
      }
    })
  })

  it('invokes subscribed observer only once of error', () => {
    const errors = []
    const streamObserver = new ResultStreamObserver()
    streamObserver.subscribe({
      onError: error => errors.push(error)
    })

    const error1 = new Error('Hello')
    const error2 = new Error('World')

    streamObserver.onError(error1)
    streamObserver.onError(error2)

    expect(errors).toEqual([error1])
  })

  it('should be able to handle a single response', done => {
    const streamObserver = new ResultStreamObserver()
    streamObserver.prepareToHandleSingleResponse()

    streamObserver.subscribe({
      onCompleted: metadata => {
        expect(metadata.key).toEqual(42)
        done()
      }
    })

    streamObserver.onCompleted({ key: 42 })
  })

  it('should mark as completed', done => {
    const streamObserver = new ResultStreamObserver()
    streamObserver.markCompleted()

    streamObserver.subscribe({
      onCompleted: metadata => {
        expect(metadata).toEqual({})
        done()
      }
    })
  })

  it('should inform all the pre-existing events of a success stream to the subscriber', () => {
    const streamObserver = new ResultStreamObserver()
    const received = {
      onCompleted: [],
      onError: [],
      onNext: [],
      onKeys: []
    }
    const observer = {
      onCompleted: metadata => received.onCompleted.push(metadata),
      onError: error => received.onError.push(error),
      onNext: record => received.onNext.push(record),
      onKeys: keys => received.onKeys.push(keys)
    }

    streamObserver.onCompleted({ fields: ['A', 'B', 'C'] })

    streamObserver.onNext([1, 2, 3])
    streamObserver.onNext([11, 22, 33])
    streamObserver.onNext([111, 222, 333])

    streamObserver.onCompleted({ key: 42, has_more: false })

    streamObserver.subscribe(observer)

    expect(received.onNext.length).toEqual(3)
    expect(received.onNext[0].toObject()).toEqual({ A: 1, B: 2, C: 3 })
    expect(received.onNext[1].toObject()).toEqual({ A: 11, B: 22, C: 33 })
    expect(received.onNext[2].toObject()).toEqual({ A: 111, B: 222, C: 333 })
    expect(received.onKeys).toEqual([['A', 'B', 'C']])
    expect(received.onCompleted).toEqual([{
      key: 42,
      has_more: false,
      stream_summary: {
        has_keys: true,
        have_records_streamed: true,
        pulled: true
      }
    }])
    expect(received.onError).toEqual([])
  })

  it('should inform all the pre-existing events of a success stream to the subscriber in the correct order', () => {
    const streamObserver = new ResultStreamObserver()
    const received = []
    const observer = {
      onCompleted: metadata => received.push(metadata),
      onError: error => received.push(error),
      onNext: record => received.push(record),
      onKeys: keys => received.push(keys)
    }

    streamObserver.onCompleted({ fields: ['A', 'B', 'C'] })

    streamObserver.onNext([1, 2, 3])
    streamObserver.onNext([11, 22, 33])
    streamObserver.onNext([111, 222, 333])

    streamObserver.onCompleted({ key: 42, has_more: false })

    streamObserver.subscribe(observer)

    expect(received.length).toEqual(5)
    expect(received[0]).toEqual(['A', 'B', 'C'])
    expect(received[1].toObject()).toEqual({ A: 1, B: 2, C: 3 })
    expect(received[2].toObject()).toEqual({ A: 11, B: 22, C: 33 })
    expect(received[3].toObject()).toEqual({ A: 111, B: 222, C: 333 })
    expect(received[4]).toEqual({
      key: 42,
      has_more: false,
      stream_summary: {
        has_keys: true,
        have_records_streamed: true,
        pulled: true
      }
    })
  })

  it('should inform all the pre-existing events of an error stream to the subscriber', () => {
    const streamObserver = new ResultStreamObserver()
    const received = {
      onCompleted: [],
      onError: [],
      onNext: [],
      onKeys: []
    }
    const observer = {
      onCompleted: metadata => received.onCompleted.push(metadata),
      onError: error => received.onError.push(error),
      onNext: record => received.onNext.push(record),
      onKeys: keys => received.onKeys.push(keys)
    }

    streamObserver.onCompleted({ fields: ['A', 'B', 'C'] })

    streamObserver.onNext([1, 2, 3])
    streamObserver.onNext([11, 22, 33])
    streamObserver.onNext([111, 222, 333])

    streamObserver.onError(newError('something is on the way'))

    streamObserver.subscribe(observer)

    expect(received.onNext.length).toEqual(3)
    expect(received.onNext[0].toObject()).toEqual({ A: 1, B: 2, C: 3 })
    expect(received.onNext[1].toObject()).toEqual({ A: 11, B: 22, C: 33 })
    expect(received.onNext[2].toObject()).toEqual({ A: 111, B: 222, C: 333 })
    expect(received.onKeys).toEqual([['A', 'B', 'C']])
    expect(received.onCompleted).toEqual([])
    expect(received.onError).toEqual([newError('something is on the way')])
  })

  it('should inform all the pre-existing events of an error stream stream to the subscriber in the correct order', () => {
    const streamObserver = new ResultStreamObserver()
    const received = []
    const observer = {
      onCompleted: metadata => received.push(metadata),
      onError: error => received.push(error),
      onNext: record => received.push(record),
      onKeys: keys => received.push(keys)
    }

    streamObserver.onCompleted({ fields: ['A', 'B', 'C'] })

    streamObserver.onNext([1, 2, 3])
    streamObserver.onNext([11, 22, 33])
    streamObserver.onNext([111, 222, 333])

    streamObserver.onError(newError('something is on the way'))

    streamObserver.subscribe(observer)

    expect(received.length).toEqual(5)
    expect(received[0]).toEqual(['A', 'B', 'C'])
    expect(received[1].toObject()).toEqual({ A: 1, B: 2, C: 3 })
    expect(received[2].toObject()).toEqual({ A: 11, B: 22, C: 33 })
    expect(received[3].toObject()).toEqual({ A: 111, B: 222, C: 333 })
    expect(received[4]).toEqual(newError('something is on the way'))
  })

  describe('when is not paused (default)', () => {
    it('should ask for more records when the stream is completed and has more', () => {
      // Setup
      const queryId = 123
      const fetchSize = 2000

      const more = jest.fn()
      const streamObserver = new ResultStreamObserver({
        moreFunction: more,
        fetchSize: 2000
      })

      // action
      streamObserver.onCompleted({ fields: ['A', 'B', 'C'], qid: queryId })

      streamObserver.subscribe(newObserver())

      streamObserver.onNext([1, 2, 3])
      streamObserver.onNext([11, 22, 33])
      streamObserver.onCompleted({ has_more: true })

      streamObserver.onNext([111, 222, 333])
      streamObserver.onCompleted({ has_more: false })

      // verification
      expect(more).toBeCalledTimes(1)
      expect(more).toBeCalledWith(queryId, fetchSize, streamObserver)
    })
  })

  describe('when is paused', () => {
    it('should not ask for more records when the stream is completed and has more', () => {
      // Setup
      const queryId = 123

      const more = jest.fn()
      const streamObserver = new ResultStreamObserver({
        moreFunction: more,
        fetchSize: 2000
      })

      streamObserver.pause()

      // action
      streamObserver.onCompleted({ fields: ['A', 'B', 'C'], qid: queryId })

      streamObserver.subscribe(newObserver())

      streamObserver.onNext([1, 2, 3])
      streamObserver.onNext([11, 22, 33])
      streamObserver.onCompleted({ has_more: true })

      // verification
      expect(more).toBeCalledTimes(0)
    })

    describe('resume()', () => {
      it('should ask for more records when the stream is completed and has more', () => {
        // Setup
        const queryId = 123
        const fetchSize = 2000

        const more = jest.fn()
        const streamObserver = new ResultStreamObserver({
          moreFunction: more,
          fetchSize
        })

        streamObserver.pause()

        // Scenario
        streamObserver.onCompleted({ fields: ['A', 'B', 'C'], qid: queryId })

        streamObserver.subscribe(newObserver())

        streamObserver.onNext([1, 2, 3])
        streamObserver.onNext([11, 22, 33])
        streamObserver.onCompleted({ has_more: true })

        // Action
        streamObserver.resume()

        // verification
        expect(more).toBeCalledTimes(1)
        expect(more).toBeCalledWith(queryId, fetchSize, streamObserver)
      })

      it('should ask for more records when the stream is a new reactive stream', () => {
        // Setup
        const queryId = 123
        const fetchSize = 2000

        const more = jest.fn()
        const streamObserver = new ResultStreamObserver({
          moreFunction: more,
          fetchSize,
          reactive: true
        })
        streamObserver.pause()

        // Scenario
        streamObserver.onCompleted({ fields: ['A', 'B', 'C'], qid: queryId })

        // Action
        streamObserver.resume()

        // verification
        expect(more).toBeCalledTimes(1)
        expect(more).toBeCalledWith(queryId, fetchSize, streamObserver)
      })

      it('should ask for more records when the stream is a new reactive stream and not run success come yet', () => {
        // Setup
        const fetchSize = 2000

        const more = jest.fn()
        const streamObserver = new ResultStreamObserver({
          moreFunction: more,
          fetchSize,
          reactive: true
        })
        streamObserver.pause()

        // Action
        streamObserver.resume()

        // verification
        expect(more).toBeCalledTimes(1)
        expect(more).toBeCalledWith(null, fetchSize, streamObserver)
      })

      it('should not ask for more records when the stream is a new stream', () => {
        // Setup
        const queryId = 123
        const fetchSize = 2000

        const more = jest.fn()
        const streamObserver = new ResultStreamObserver({
          moreFunction: more,
          fetchSize,
          reactive: false
        })
        streamObserver.pause()

        // Scenario
        streamObserver.onCompleted({ fields: ['A', 'B', 'C'], qid: queryId })

        // Action
        streamObserver.resume()

        // verification
        expect(more).toBeCalledTimes(0)
      })

      it('should not ask for more records when the stream is a new stream', () => {
        // Setup
        const queryId = 123
        const fetchSize = 2000

        const more = jest.fn()
        const streamObserver = new ResultStreamObserver({
          moreFunction: more,
          fetchSize
        })

        streamObserver.pause()

        // Scenario
        streamObserver.onCompleted({ fields: ['A', 'B', 'C'], qid: queryId })

        // Action
        streamObserver.resume()

        // verification
        expect(more).toBeCalledTimes(0)
      })

      it('should not ask for more records when it is streaming', () => {
        // Setup
        const queryId = 123
        const fetchSize = 2000

        const more = jest.fn()
        const streamObserver = new ResultStreamObserver({
          moreFunction: more,
          fetchSize
        })

        streamObserver.pause()

        // Scenario
        streamObserver.onCompleted({ fields: ['A', 'B', 'C'], qid: queryId })

        streamObserver.subscribe(newObserver())

        streamObserver.onNext([1, 2, 3])
        streamObserver.onNext([11, 22, 33])
        streamObserver.onCompleted({ has_more: true })

        streamObserver.resume() // should actual call

        streamObserver.onNext([111, 222, 333])

        // Action
        streamObserver.resume()

        // verification
        expect(more).toBeCalledTimes(1)
      })

      it('should not ask for more records when result is completed', () => {
        // Setup
        const queryId = 123
        const fetchSize = 2000

        const more = jest.fn()
        const streamObserver = new ResultStreamObserver({
          moreFunction: more,
          fetchSize
        })

        streamObserver.pause()

        // Scenario
        streamObserver.onCompleted({ fields: ['A', 'B', 'C'], qid: queryId })

        streamObserver.subscribe(newObserver())

        streamObserver.onNext([1, 2, 3])
        streamObserver.onNext([11, 22, 33])
        streamObserver.onCompleted({ has_more: false })

        // Action
        streamObserver.resume()

        // verification
        expect(more).toBeCalledTimes(0)
      })

      it('should resume the stream consumption until the end', () => {
        // Setup
        const queryId = 123
        const fetchSize = 2000

        const more = jest.fn()
        const streamObserver = new ResultStreamObserver({
          moreFunction: more,
          fetchSize
        })

        streamObserver.pause()

        // Scenario
        streamObserver.onCompleted({ fields: ['A', 'B', 'C'], qid: queryId })

        streamObserver.subscribe(newObserver())

        streamObserver.onNext([1, 2, 3])
        streamObserver.onNext([11, 22, 33])
        streamObserver.onCompleted({ has_more: true })

        // Action
        streamObserver.resume()

        // Streaming until the end
        streamObserver.onNext([1, 2, 3])
        streamObserver.onNext([11, 22, 33])
        streamObserver.onCompleted({ has_more: true })
        streamObserver.onNext([1, 2, 3])
        streamObserver.onNext([11, 22, 33])
        streamObserver.onCompleted({ has_more: true })
        streamObserver.onNext([1, 2, 3])
        streamObserver.onNext([11, 22, 33])
        streamObserver.onCompleted({ has_more: false })

        // verification
        expect(more).toBeCalledTimes(3)
      })

      it('should not ask for more records when stream failed', () => {
        // Setup
        const queryId = 123
        const fetchSize = 2000

        const more = jest.fn()
        const streamObserver = new ResultStreamObserver({
          moreFunction: more,
          fetchSize
        })

        streamObserver.pause()

        // Scenario
        streamObserver.onCompleted({ fields: ['A', 'B', 'C'], qid: queryId })

        streamObserver.subscribe(newObserver())

        streamObserver.onNext([1, 2, 3])
        streamObserver.onError(new Error('error'))

        // Action
        streamObserver.resume()

        // verification
        expect(more).toBeCalledTimes(0)
      })
    })
  })

  describe('metadata validation', () => {
    it.each([
      ['wr'],
      ['read'],
      ['read/write'],
      ['write/read'],
      ['write'],
      ['undefined'],
      ['null'],
      ['banana']
    ])('should trigger onError when the type is \'%s\'', (type) => {
      const streamObserver = newStreamObserver()
      const expectedError = newError(
        `Server returned invalid query type. Expected one of [undefined, null, "r", "w", "rw", "s"] but got '${type}'`,
        PROTOCOL_ERROR)

      streamObserver.onCompleted({ fields: ['A', 'B', 'C'] })
      streamObserver.onCompleted({ type })

      streamObserver.subscribe(
        newObserver(NO_OP, receivedError => {
          expect(receivedError).toEqual(expectedError)
        }, () => {
          fail('Should not succeed')
        })
      )
    })

    it.each([
      ['r'],
      ['w'],
      ['rw'],
      ['s'],
      [null],
      [undefined]
    ])('should trigger onComplete when the type is \'%s\'', (type) => {
      const streamObserver = newStreamObserver()

      streamObserver.onCompleted({ fields: ['A', 'B', 'C'] })
      streamObserver.onCompleted({ type })

      streamObserver.subscribe(
        newObserver(NO_OP, () => {
          fail('should not fail')
        }, meta => {
          expect(meta.type).toBe(type)
        })
      )
    })
  })

  describe('metadata.stream_summary', () => {
    it('should notify stream without keys, pulled or record received', async () => {
      const streamObserver = new ResultStreamObserver({ reactive: true, discardFunction: jest.fn() })
      const received = []
      const observer = {
        onCompleted: metadata => received.push(metadata),
        onError: error => received.push(error),
        onNext: record => received.push(record),
        onKeys: keys => received.push(keys)
      }

      streamObserver.subscribe(observer)

      streamObserver.cancel()
      streamObserver.onCompleted({ fields: [] })

      await new Promise((resolve, reject) => {
        setImmediate(() => {
          try {
            streamObserver.onCompleted({ key: 42, has_more: false })
            resolve()
          } catch (e) {
            reject(e)
          }
        })
      })

      expect(received[received.length - 1]).toEqual({
        key: 42,
        has_more: false,
        stream_summary: {
          has_keys: false,
          have_records_streamed: false,
          pulled: false
        }
      })
    })

    it('should notify stream keys, but without pulled or record received', async () => {
      const streamObserver = new ResultStreamObserver({ reactive: true, discardFunction: jest.fn() })
      const received = []
      const observer = {
        onCompleted: metadata => received.push(metadata),
        onError: error => received.push(error),
        onNext: record => received.push(record),
        onKeys: keys => received.push(keys)
      }

      streamObserver.subscribe(observer)

      streamObserver.cancel()
      streamObserver.onCompleted({ fields: ['A'] })

      await new Promise((resolve, reject) => {
        setImmediate(() => {
          try {
            streamObserver.onCompleted({ key: 42, has_more: false })
            resolve()
          } catch (e) {
            reject(e)
          }
        })
      })

      expect(received[received.length - 1]).toEqual({
        key: 42,
        has_more: false,
        stream_summary: {
          has_keys: true,
          have_records_streamed: false,
          pulled: false
        }
      })
    })

    it('should notify stream pulled, but without keys or record received', async () => {
      const streamObserver = new ResultStreamObserver({ reactive: false })
      const received = []
      const observer = {
        onCompleted: metadata => received.push(metadata),
        onError: error => received.push(error),
        onNext: record => received.push(record),
        onKeys: keys => received.push(keys)
      }

      streamObserver.subscribe(observer)

      streamObserver.onCompleted({ fields: [] })

      await new Promise((resolve, reject) => {
        setImmediate(() => {
          try {
            streamObserver.onCompleted({ key: 42, has_more: false })
            resolve()
          } catch (e) {
            reject(e)
          }
        })
      })

      expect(received[received.length - 1]).toEqual({
        key: 42,
        has_more: false,
        stream_summary: {
          has_keys: false,
          have_records_streamed: false,
          pulled: true
        }
      })
    })

    it('should notify stream pulled and keys received, but no record received', async () => {
      const streamObserver = new ResultStreamObserver({ reactive: false })
      const received = []
      const observer = {
        onCompleted: metadata => received.push(metadata),
        onError: error => received.push(error),
        onNext: record => received.push(record),
        onKeys: keys => received.push(keys)
      }

      streamObserver.subscribe(observer)

      streamObserver.onCompleted({ fields: ['A'] })

      await new Promise((resolve, reject) => {
        setImmediate(() => {
          try {
            streamObserver.onCompleted({ key: 42, has_more: false })
            resolve()
          } catch (e) {
            reject(e)
          }
        })
      })

      expect(received[received.length - 1]).toEqual({
        key: 42,
        has_more: false,
        stream_summary: {
          has_keys: true,
          have_records_streamed: false,
          pulled: true
        }
      })
    })

    it('should notify stream pulled, keys received and record received', async () => {
      const streamObserver = new ResultStreamObserver({ reactive: false })
      const received = []
      const observer = {
        onCompleted: metadata => received.push(metadata),
        onError: error => received.push(error),
        onNext: record => received.push(record),
        onKeys: keys => received.push(keys)
      }

      streamObserver.subscribe(observer)

      streamObserver.onCompleted({ fields: ['A'] })
      streamObserver.onNext([1])

      await new Promise((resolve, reject) => {
        setImmediate(() => {
          try {
            streamObserver.onCompleted({ key: 42, has_more: false })
            resolve()
          } catch (e) {
            reject(e)
          }
        })
      })

      expect(received[received.length - 1]).toEqual({
        key: 42,
        has_more: false,
        stream_summary: {
          has_keys: true,
          have_records_streamed: true,
          pulled: true
        }
      })
    })
  })
})

describe('#unit RouteObserver', () => {
  it('should call onCompleted with the metadata', () => {
    let onCompleteCalled = false
    const expectedMetadata = { someMeta: '134' }

    newRouteObserver({
      onCompleted: metadata => {
        onCompleteCalled = true
        expect(metadata).toEqual(
          RawRoutingTable.ofMessageResponse(expectedMetadata)
        )
      }
    }).onCompleted(expectedMetadata)

    expect(onCompleteCalled).toEqual(true)
  })

  it('should call onError with the error', () => {
    let onErrorCalled = false
    const expectedError = newError('something wrong')

    newRouteObserver({
      onError: metadata => {
        onErrorCalled = true
        expect(metadata).toBe(expectedError)
      }
    }).onError(expectedError)

    expect(onErrorCalled).toEqual(true)
  })

  it('should call onError with a protocol error', () => {
    let onErrorCalled = false
    const expectedError = newError('something wrong', PROTOCOL_ERROR)

    newRouteObserver({
      onError: metadata => {
        onErrorCalled = true
        expect(metadata).toBe(expectedError)
      },
      onProtocolError: () => {}
    }).onError(expectedError)

    expect(onErrorCalled).toEqual(true)
  })

  it('should call onProtocolError when a protocol error occurs', () => {
    let onProtocolErrorCalled = false

    const expectedError = newError('something wrong', PROTOCOL_ERROR)

    newRouteObserver({
      onError: null,
      onProtocolError: message => {
        onProtocolErrorCalled = true
        expect(message).toEqual(expectedError.message)
      }
    }).onError(expectedError)

    expect(onProtocolErrorCalled).toEqual(true)
  })

  it('should call onError with a protocol error it receive a record', () => {
    let onErrorCalled = false
    const record = new Record(['a'], ['b'])
    const expectedError = newError(
      'Received RECORD when resetting: received record is: ' +
        json.stringify(record),
      PROTOCOL_ERROR
    )

    newRouteObserver({
      onError: error => {
        onErrorCalled = true
        expect(error).toEqual(expectedError)
      },
      onProtocolError: () => {}
    }).onNext(record)

    expect(onErrorCalled).toEqual(true)
  })

  it('should call onProtocolError with a protocol error it receive a record', () => {
    let onProtocolErrorCalled = false
    const record = new Record(['a'], ['b'])
    const expectedErrorMessage =
      'Received RECORD when resetting: received record is: ' +
      json.stringify(record)

    newRouteObserver({
      onError: null,
      onProtocolError: message => {
        onProtocolErrorCalled = true
        expect(message).toEqual(expectedErrorMessage)
      }
    }).onNext(record)

    expect(onProtocolErrorCalled).toEqual(true)
  })

  function newRouteObserver ({
    onCompleted = shouldNotBeCalled('onComplete'),
    onError = shouldNotBeCalled('onError'),
    onProtocolError = shouldNotBeCalled('onProtocolError')
  } = {}) {
    return new RouteObserver({ onCompleted, onError, onProtocolError })
  }

  function shouldNotBeCalled (methodName) {
    return () => fail(`${methodName} should not be called`)
  }
})

describe('#unit ProcedureRouteObserver', () => {
  it('should call resultObserver.subscribe on the constructor', () => {
    const resultObserver = new FakeResultStreamObserver()
    const observer = newRouteObserver({ resultObserver })

    expect(resultObserver.subscribedObservers.length).toEqual(1)
    expect(resultObserver.subscribedObservers[0]).toEqual(observer)
  })

  it('should call onCompleted with the RawRoutingTable of Record if it has 1 records', () => {
    let onCompleteCalled = false
    const record = new Record(['a'], ['b'])
    const observer = newRouteObserver({
      onCompleted: metadata => {
        onCompleteCalled = true
        expect(metadata).toEqual(RawRoutingTable.ofRecord(record))
      }
    })

    observer.onNext(record)
    observer.onCompleted()

    expect(onCompleteCalled).toEqual(true)
  })

  it('should call onError with a protocol error it receive 0 records', () => {
    let onErrorCalled = false
    const expectedError = newError(
      'Illegal response from router. Received 0 records but expected only one.\n' +
        json.stringify([]),
      PROTOCOL_ERROR
    )
    const observer = newRouteObserver({
      onError: error => {
        onErrorCalled = true
        expect(error).toEqual(expectedError)
      },
      onProtocolError: () => {}
    })

    observer.onCompleted()

    expect(onErrorCalled).toEqual(true)
  })

  it('should call onProtocolError with a protocol error it receive 0 records', () => {
    let onProtocolErrorCalled = false
    const expectedErrorMessage =
      'Illegal response from router. Received 0 records but expected only one.\n' +
      json.stringify([])

    newRouteObserver({
      onError: null,
      onProtocolError: message => {
        onProtocolErrorCalled = true
        expect(message).toEqual(expectedErrorMessage)
      }
    }).onCompleted()

    expect(onProtocolErrorCalled).toEqual(true)
  })

  it('should call onError with a protocol error it receive more than one record', () => {
    let onErrorCalled = false
    const record = new Record(['a'], ['b'])
    const expectedError = newError(
      'Illegal response from router. Received 2 records but expected only one.\n' +
        json.stringify([record, record]),
      PROTOCOL_ERROR
    )
    const observer = newRouteObserver({
      onError: error => {
        onErrorCalled = true
        expect(error).toEqual(expectedError)
      },
      onProtocolError: () => {}
    })

    observer.onNext(record)
    observer.onNext(record)
    observer.onCompleted()

    expect(onErrorCalled).toEqual(true)
  })

  it('should call onProtocolError with a protocol error it receive 0 records', () => {
    let onProtocolErrorCalled = false
    const record = new Record(['a'], ['b'])
    const expectedErrorMessage =
      'Illegal response from router. Received 2 records but expected only one.\n' +
      json.stringify([record, record])

    const observer = newRouteObserver({
      onError: null,
      onProtocolError: message => {
        onProtocolErrorCalled = true
        expect(message).toEqual(expectedErrorMessage)
      }
    })

    observer.onNext(record)
    observer.onNext(record)
    observer.onCompleted()

    expect(onProtocolErrorCalled).toEqual(true)
  })

  it('should call onError with the error', () => {
    let onErrorCalled = false
    const expectedError = newError('something wrong')

    newRouteObserver({
      onError: metadata => {
        onErrorCalled = true
        expect(metadata).toBe(expectedError)
      }
    }).onError(expectedError)

    expect(onErrorCalled).toEqual(true)
  })

  it('should call onError with a protocol error', () => {
    let onErrorCalled = false
    const expectedError = newError('something wrong', PROTOCOL_ERROR)

    newRouteObserver({
      onError: metadata => {
        onErrorCalled = true
        expect(metadata).toBe(expectedError)
      },
      onProtocolError: null
    }).onError(expectedError)

    expect(onErrorCalled).toEqual(true)
  })

  it('should call onProtocolError when a protocol error occurs', () => {
    let onProtocolErrorCalled = false
    const expectedError = newError('something wrong', PROTOCOL_ERROR)

    newRouteObserver({
      onError: null,
      onProtocolError: message => {
        onProtocolErrorCalled = true
        expect(message).toEqual(expectedError.message)
      }
    }).onError(expectedError)

    expect(onProtocolErrorCalled).toEqual(true)
  })

  function newRouteObserver ({
    onCompleted = shouldNotBeCalled('onComplete'),
    onError = shouldNotBeCalled('onError'),
    onProtocolError = shouldNotBeCalled('onProtocolError'),
    resultObserver = new FakeResultStreamObserver()
  } = {}) {
    return new ProcedureRouteObserver({
      resultObserver,
      onProtocolError,
      onCompleted,
      onError
    })
  }

  function shouldNotBeCalled (methodName) {
    return () => fail(`${methodName} should not be called`)
  }

  class FakeResultStreamObserver {
    constructor () {
      this.subscribedObservers = []
    }

    subscribe (observer) {
      this.subscribedObservers.push(observer)
    }
  }
})

function newStreamObserver (server) {
  return new ResultStreamObserver({
    server
  })
}

function newObserver (onNext = NO_OP, onError = NO_OP, onCompleted = NO_OP) {
  return {
    onNext,
    onError,
    onCompleted
  }
}
