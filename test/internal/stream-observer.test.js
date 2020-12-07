/**
 * Copyright (c) 2002-2020 "Neo4j,"
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

import FakeConnection from './fake-connection'
import {
  ResultStreamObserver,
  RouteObserver,
  ProcedureRouteObserver
} from '../../src/internal/stream-observers'
import RawRoutingTable from '../../src/internal/routing-table-raw'
import { newError } from '../../lib/error'
import { PROTOCOL_ERROR } from '../../src/error'
import Record from '../../src/record'

const NO_OP = () => {}

describe('#unit ResultStreamObserver', () => {
  it('remembers resolved connection', () => {
    const connection = new FakeConnection()
    const streamObserver = newStreamObserver(connection)

    expect(streamObserver._connection).toBe(connection)
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
      metaDataField2: 'value2'
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
      }
    }).onError(expectedError)

    expect(onErrorCalled).toEqual(true)
  })

  it('should call connection._handleProtocolError when a protocol error occurs', () => {
    const connection = new FakeConnection()
    const expectedError = newError('something wrong', PROTOCOL_ERROR)

    newRouteObserver({
      onError: null,
      connection
    }).onError(expectedError)

    expect(connection.protocolErrorsHandled).toEqual(1)
    expect(connection.seenProtocolErrors).toEqual([expectedError.message])
  })

  it('should call onError with a protocol error it receive a record', () => {
    let onErrorCalled = false
    const record = new Record(['a'], ['b'])
    const expectedError = newError(
      'Received RECORD when resetting: received record is: ' +
        JSON.stringify(record),
      PROTOCOL_ERROR
    )

    newRouteObserver({
      onError: error => {
        onErrorCalled = true
        expect(error).toEqual(expectedError)
      }
    }).onNext(record)

    expect(onErrorCalled).toEqual(true)
  })

  it('should call connection._handleProtocolError with a protocol error it receive a record', () => {
    const connection = new FakeConnection()
    const record = new Record(['a'], ['b'])
    const expectedErrorMessage =
      'Received RECORD when resetting: received record is: ' +
      JSON.stringify(record)

    newRouteObserver({
      onError: null,
      connection
    }).onNext(record)

    expect(connection.protocolErrorsHandled).toEqual(1)
    expect(connection.seenProtocolErrors).toEqual([expectedErrorMessage])
  })

  function newRouteObserver ({
    onCompleted = shouldNotBeCalled('onComplete'),
    onError = shouldNotBeCalled('onError'),
    connection = new FakeConnection()
  } = {}) {
    return new RouteObserver({ connection, onCompleted, onError })
  }

  function shouldNotBeCalled (methodName) {
    return () => fail(`${methodName} should not be called`)
  }
})

describe('#unit ProcedureRouteObserver', () => {
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
        JSON.stringify([]),
      PROTOCOL_ERROR
    )
    const observer = newRouteObserver({
      onError: error => {
        onErrorCalled = true
        expect(error).toEqual(expectedError)
      }
    })

    observer.onCompleted()

    expect(onErrorCalled).toEqual(true)
  })

  it('should call connection._handleProtocolError with a protocol error it receive 0 records', () => {
    const connection = new FakeConnection()
    const expectedErrorMessage =
      'Illegal response from router. Received 0 records but expected only one.\n' +
      JSON.stringify([])

    newRouteObserver({
      onError: null,
      connection
    }).onCompleted()

    expect(connection.protocolErrorsHandled).toEqual(1)
    expect(connection.seenProtocolErrors).toEqual([expectedErrorMessage])
  })

  it('should call onError with a protocol error it receive more than one record', () => {
    let onErrorCalled = false
    const record = new Record(['a'], ['b'])
    const expectedError = newError(
      'Illegal response from router. Received 2 records but expected only one.\n' +
        JSON.stringify([record, record]),
      PROTOCOL_ERROR
    )
    const observer = newRouteObserver({
      onError: error => {
        onErrorCalled = true
        expect(error).toEqual(expectedError)
      }
    })

    observer.onNext(record)
    observer.onNext(record)
    observer.onCompleted()

    expect(onErrorCalled).toEqual(true)
  })

  it('should call connection._handleProtocolError with a protocol error it receive 0 records', () => {
    const connection = new FakeConnection()
    const record = new Record(['a'], ['b'])
    const expectedErrorMessage =
      'Illegal response from router. Received 2 records but expected only one.\n' +
      JSON.stringify([record, record])

    const observer = newRouteObserver({
      onError: null,
      connection
    })

    observer.onNext(record)
    observer.onNext(record)
    observer.onCompleted()

    expect(connection.protocolErrorsHandled).toEqual(1)
    expect(connection.seenProtocolErrors).toEqual([expectedErrorMessage])
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
      }
    }).onError(expectedError)

    expect(onErrorCalled).toEqual(true)
  })

  it('should call connection._handleProtocolError when a protocol error occurs', () => {
    const connection = new FakeConnection()
    const expectedError = newError('something wrong', PROTOCOL_ERROR)

    newRouteObserver({
      onError: null,
      connection
    }).onError(expectedError)

    expect(connection.protocolErrorsHandled).toEqual(1)
    expect(connection.seenProtocolErrors).toEqual([expectedError.message])
  })

  function newRouteObserver ({
    onCompleted = shouldNotBeCalled('onComplete'),
    onError = shouldNotBeCalled('onError'),
    connection = new FakeConnection(),
    resultObserver = new FakeResultStreamObserver()
  } = {}) {
    return new ProcedureRouteObserver({
      resultObserver,
      connection,
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

function newStreamObserver (connection) {
  return new ResultStreamObserver({
    connection
  })
}

function newObserver (onNext = NO_OP, onError = NO_OP, onCompleted = NO_OP) {
  return {
    onNext: onNext,
    onError: onError,
    onCompleted: onCompleted
  }
}
