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
import { newError, error, Integer, Record, json, internal } from 'neo4j-driver-core'
import RawRoutingTable from './routing-table-raw'

const {
  constants: { FETCH_ALL },
} = internal
const { PROTOCOL_ERROR } = error
class StreamObserver {
  onNext (rawRecord) {}

  onError (error) {}

  onCompleted (meta) {}
}

/**
 * Handles a RUN/PULL_ALL, or RUN/DISCARD_ALL requests, maps the responses
 * in a way that a user-provided observer can see these as a clean Stream
 * of records.
 * This class will queue up incoming messages until a user-provided observer
 * for the incoming stream is registered. Thus, we keep fields around
 * for tracking head/records/tail. These are only used if there is no
 * observer registered.
 * @access private
 */
class ResultStreamObserver extends StreamObserver {
  /**
   *
   * @param {Object} param
   * @param {Object} param.server
   * @param {boolean} param.reactive
   * @param {function(stmtId: number|Integer, n: number|Integer, observer: StreamObserver)} param.moreFunction -
   * @param {function(stmtId: number|Integer, observer: StreamObserver)} param.discardFunction -
   * @param {number|Integer} param.fetchSize -
   * @param {function(err: Error): Promise|void} param.beforeError -
   * @param {function(err: Error): Promise|void} param.afterError -
   * @param {function(keys: string[]): Promise|void} param.beforeKeys -
   * @param {function(keys: string[]): Promise|void} param.afterKeys -
   * @param {function(metadata: Object): Promise|void} param.beforeComplete -
   * @param {function(metadata: Object): Promise|void} param.afterComplete -
   */
  constructor ({
    reactive = false,
    moreFunction,
    discardFunction,
    fetchSize = FETCH_ALL,
    beforeError,
    afterError,
    beforeKeys,
    afterKeys,
    beforeComplete,
    afterComplete,
    server
  } = {}) {
    super()

    this._fieldKeys = null
    this._fieldLookup = null
    this._head = null
    this._queuedRecords = []
    this._tail = null
    this._error = null
    this._observers = []
    this._meta = {}
    this._server = server

    this._beforeError = beforeError
    this._afterError = afterError
    this._beforeKeys = beforeKeys
    this._afterKeys = afterKeys
    this._beforeComplete = beforeComplete
    this._afterComplete = afterComplete

    this._queryId = null
    this._moreFunction = moreFunction
    this._discardFunction = discardFunction
    this._discard = false
    this._fetchSize = fetchSize
    this._setState(reactive ? _states.READY : _states.READY_STREAMING)
    this._setupAuoPull(fetchSize)
  }

  /**
   * Will be called on every record that comes in and transform a raw record
   * to a Object. If user-provided observer is present, pass transformed record
   * to it's onNext method, otherwise, push to record que.
   * @param {Array} rawRecord - An array with the raw record
   */
  onNext (rawRecord) {
    const record = new Record(this._fieldKeys, rawRecord, this._fieldLookup)
    if (this._observers.some(o => o.onNext)) {
      this._observers.forEach(o => {
        if (o.onNext) {
          o.onNext(record)
        }
      })
    } else {
      this._queuedRecords.push(record)
      if (this._queuedRecords.length > this._highRecordWatermark) {
        this._autoPull = false
      }
    }
  }

  onCompleted (meta) {
    this._state.onSuccess(this, meta)
  }

  /**
   * Will be called on errors.
   * If user-provided observer is present, pass the error
   * to it's onError method, otherwise set instance variable _error.
   * @param {Object} error - An error object
   */
  onError (error) {
    this._state.onError(this, error)
  }

  /**
   * Cancel pending record stream
   */
  cancel () {
    this._discard = true
  }

  /**
   * Stream observer defaults to handling responses for two messages: RUN + PULL_ALL or RUN + DISCARD_ALL.
   * Response for RUN initializes query keys. Response for PULL_ALL / DISCARD_ALL exposes the result stream.
   *
   * However, some operations can be represented as a single message which receives full metadata in a single response.
   * For example, operations to begin, commit and rollback an explicit transaction use two messages in Bolt V1 but a single message in Bolt V3.
   * Messages are `RUN "BEGIN" {}` + `PULL_ALL` in Bolt V1 and `BEGIN` in Bolt V3.
   *
   * This function prepares the observer to only handle a single response message.
   */
  prepareToHandleSingleResponse () {
    this._head = []
    this._fieldKeys = []
    this._setState(_states.STREAMING)
  }

  /**
   * Mark this observer as if it has completed with no metadata.
   */
  markCompleted () {
    this._head = []
    this._fieldKeys = []
    this._tail = {}
    this._setState(_states.SUCCEEDED)
  }

  /**
   * Subscribe to events with provided observer.
   * @param {Object} observer - Observer object
   * @param {function(keys: String[])} observer.onKeys - Handle stream header, field keys.
   * @param {function(record: Object)} observer.onNext - Handle records, one by one.
   * @param {function(metadata: Object)} observer.onCompleted - Handle stream tail, the metadata.
   * @param {function(error: Object)} observer.onError - Handle errors, should always be provided.
   */
  subscribe (observer) {
    if (this._error) {
      observer.onError(this._error)
      return
    }
    if (this._head && observer.onKeys) {
      observer.onKeys(this._head)
    }
    if (this._queuedRecords.length > 0 && observer.onNext) {
      for (let i = 0; i < this._queuedRecords.length; i++) {
        observer.onNext(this._queuedRecords[i])
        if (this._queuedRecords.length - i - 1 <= this._lowRecordWatermark) {
          this._autoPull = true
          if (this._state === _states.READY) {
            this._handleStreaming()
          }
        }
      }
    }
    if (this._tail && observer.onCompleted) {
      observer.onCompleted(this._tail)
    }
    this._observers.push(observer)

    if (this._state === _states.READY) {
      this._handleStreaming()
    }
  }

  _handleHasMore (meta) {
    // We've consumed current batch and server notified us that there're more
    // records to stream. Let's invoke more or discard function based on whether
    // the user wants to discard streaming or not
    this._setState(_states.READY) // we've done streaming
    this._handleStreaming()
    delete meta.has_more
  }

  _handlePullSuccess (meta) {
    this._setState(_states.SUCCEEDED)
    const completionMetadata = Object.assign(
      this._server ? { server: this._server } : {},
      this._meta,
      meta
    )

    let beforeHandlerResult = null
    if (this._beforeComplete) {
      beforeHandlerResult = this._beforeComplete(completionMetadata)
    }

    const continuation = () => {
      // End of stream
      this._tail = completionMetadata

      if (this._observers.some(o => o.onCompleted)) {
        this._observers.forEach(o => {
          if (o.onCompleted) {
            o.onCompleted(completionMetadata)
          }
        })
      }

      if (this._afterComplete) {
        this._afterComplete(completionMetadata)
      }
    }

    if (beforeHandlerResult) {
      Promise.resolve(beforeHandlerResult).then(() => continuation())
    } else {
      continuation()
    }
  }

  _handleRunSuccess (meta, afterSuccess) {
    if (this._fieldKeys === null) {
      // Stream header, build a name->index field lookup table
      // to be used by records. This is an optimization to make it
      // faster to look up fields in a record by name, rather than by index.
      // Since the records we get back via Bolt are just arrays of values.
      this._fieldKeys = []
      this._fieldLookup = {}
      if (meta.fields && meta.fields.length > 0) {
        this._fieldKeys = meta.fields
        for (let i = 0; i < meta.fields.length; i++) {
          this._fieldLookup[meta.fields[i]] = i
        }

        // remove fields key from metadata object
        delete meta.fields
      }

      // Extract server generated query id for use in requestMore and discard
      // functions
      if (meta.qid !== null && meta.qid !== undefined) {
        this._queryId = meta.qid

        // remove qid from metadata object
        delete meta.qid
      }

      this._storeMetadataForCompletion(meta)

      let beforeHandlerResult = null
      if (this._beforeKeys) {
        beforeHandlerResult = this._beforeKeys(this._fieldKeys)
      }

      const continuation = () => {
        this._head = this._fieldKeys

        if (this._observers.some(o => o.onKeys)) {
          this._observers.forEach(o => {
            if (o.onKeys) {
              o.onKeys(this._fieldKeys)
            }
          })
        }

        if (this._afterKeys) {
          this._afterKeys(this._fieldKeys)
        }

        afterSuccess()
      }

      if (beforeHandlerResult) {
        Promise.resolve(beforeHandlerResult).then(() => continuation())
      } else {
        continuation()
      }
    }
  }

  _handleError (error) {
    this._setState(_states.FAILED)
    this._error = error

    let beforeHandlerResult = null
    if (this._beforeError) {
      beforeHandlerResult = this._beforeError(error)
    }

    const continuation = () => {
      if (this._observers.some(o => o.onError)) {
        this._observers.forEach(o => {
          if (o.onError) {
            o.onError(error)
          }
        })
      }

      if (this._afterError) {
        this._afterError(error)
      }
    }

    if (beforeHandlerResult) {
      Promise.resolve(beforeHandlerResult).then(() => continuation())
    } else {
      continuation()
    }
  }

  _handleStreaming () {
    if (this._head && this._observers.some(o => o.onNext || o.onCompleted)) {
      if (this._discard) {
        this._discardFunction(this._queryId, this)
        this._setState(_states.STREAMING)
      } else if (this._autoPull) {
        this._moreFunction(this._queryId, this._fetchSize, this)
        this._setState(_states.STREAMING)
      }
    }
  }

  _storeMetadataForCompletion (meta) {
    const keys = Object.keys(meta)
    let index = keys.length
    let key = ''

    while (index--) {
      key = keys[index]
      this._meta[key] = meta[key]
    }
  }

  _setState (state) {
    this._state = state
  }

  _setupAuoPull (fetchSize) {
    this._autoPull = true
    if (fetchSize === FETCH_ALL) {
      this._lowRecordWatermark = Number.MAX_VALUE // we shall always lower than this number to enable auto pull
      this._highRecordWatermark = Number.MAX_VALUE // we shall never reach this number to disable auto pull
    } else {
      this._lowRecordWatermark = 0.3 * fetchSize
      this._highRecordWatermark = 0.7 * fetchSize
    }
  }
}

class LoginObserver extends StreamObserver {
  /**
   *
   * @param {Object} param -
   * @param {function(err: Error)} param.onError
   * @param {function(metadata)} param.onCompleted
   */
  constructor ({ onError, onCompleted } = {}) {
    super()
    this._onError = onError
    this._onCompleted = onCompleted
  }

  onNext (record) {
    this.onError(
      newError('Received RECORD when initializing ' + json.stringify(record))
    )
  }

  onError (error) {
    if (this._onError) {
      this._onError(error)
    }
  }

  onCompleted (metadata) {
    if (this._onCompleted) {
      this._onCompleted(metadata)
    }
  }
}

class ResetObserver extends StreamObserver {
  /**
   *
   * @param {Object} param -
   * @param {function(err: String)} param.onProtocolError
   * @param {function(err: Error)} param.onError
   * @param {function(metadata)} param.onComplete
   */
  constructor ({ onProtocolError, onError, onComplete } = {}) {
    super()

    this._onProtocolError = onProtocolError
    this._onError = onError
    this._onComplete = onComplete
  }

  onNext (record) {
    this.onError(
      newError(
        'Received RECORD when resetting: received record is: ' +
          json.stringify(record),
        PROTOCOL_ERROR
      )
    )
  }

  onError (error) {
    if (error.code === PROTOCOL_ERROR && this._onProtocolError) {
      this._onProtocolError(error.message)
    }

    if (this._onError) {
      this._onError(error)
    }
  }

  onCompleted (metadata) {
    if (this._onComplete) {
      this._onComplete(metadata)
    }
  }
}

class FailedObserver extends ResultStreamObserver {
  constructor ({ error, onError }) {
    super({ beforeError: onError })

    this.onError(error)
  }
}

class CompletedObserver extends ResultStreamObserver {
  constructor () {
    super()
    super.markCompleted()
  }
}

class ProcedureRouteObserver extends StreamObserver {
  constructor ({ resultObserver, onProtocolError, onError, onCompleted }) {
    super()

    this._resultObserver = resultObserver
    this._onError = onError
    this._onCompleted = onCompleted
    this._records = []
    this._onProtocolError = onProtocolError
    resultObserver.subscribe(this)
  }

  onNext (record) {
    this._records.push(record)
  }

  onError (error) {
    if (error.code === PROTOCOL_ERROR && this._onProtocolError) {
      this._onProtocolError(error.message)
    }

    if (this._onError) {
      this._onError(error)
    }
  }

  onCompleted () {
    if (this._records !== null && this._records.length !== 1) {
      this.onError(
        newError(
          'Illegal response from router. Received ' +
            this._records.length +
            ' records but expected only one.\n' +
            json.stringify(this._records),
          PROTOCOL_ERROR
        )
      )
      return
    }

    if (this._onCompleted) {
      this._onCompleted(RawRoutingTable.ofRecord(this._records[0]))
    }
  }
}

class RouteObserver extends StreamObserver {
  /**
   *
   * @param {Object} param -
   * @param {function(err: String)} param.onProtocolError
   * @param {function(err: Error)} param.onError
   * @param {function(RawRoutingTable)} param.onCompleted
   */
  constructor ({ onProtocolError, onError, onCompleted } = {}) {
    super()

    this._onProtocolError = onProtocolError
    this._onError = onError
    this._onCompleted = onCompleted
  }

  onNext (record) {
    this.onError(
      newError(
        'Received RECORD when resetting: received record is: ' +
          json.stringify(record),
        PROTOCOL_ERROR
      )
    )
  }

  onError (error) {
    if (error.code === PROTOCOL_ERROR && this._onProtocolError) {
      this._onProtocolError(error.message)
    }

    if (this._onError) {
      this._onError(error)
    }
  }

  onCompleted (metadata) {
    if (this._onCompleted) {
      this._onCompleted(RawRoutingTable.ofMessageResponse(metadata))
    }
  }
}

const _states = {
  READY_STREAMING: {
    // async start state
    onSuccess: (streamObserver, meta) => {
      streamObserver._handleRunSuccess(
        meta,
        () => {
          streamObserver._setState(_states.STREAMING)
        } // after run succeeded, async directly move to streaming
        // state
      )
    },
    onError: (streamObserver, error) => {
      streamObserver._handleError(error)
    },
    name: () => {
      return 'READY_STREAMING'
    }
  },
  READY: {
    // reactive start state
    onSuccess: (streamObserver, meta) => {
      streamObserver._handleRunSuccess(
        meta,
        () => streamObserver._handleStreaming() // after run succeeded received, reactive shall start pulling
      )
    },
    onError: (streamObserver, error) => {
      streamObserver._handleError(error)
    },
    name: () => {
      return 'READY'
    }
  },
  STREAMING: {
    onSuccess: (streamObserver, meta) => {
      if (meta.has_more) {
        streamObserver._handleHasMore(meta)
      } else {
        streamObserver._handlePullSuccess(meta)
      }
    },
    onError: (streamObserver, error) => {
      streamObserver._handleError(error)
    },
    name: () => {
      return 'STREAMING'
    }
  },
  FAILED: {
    onError: error => {
      // more errors are ignored
    },
    name: () => {
      return 'FAILED'
    }
  },
  SUCCEEDED: {
    name: () => {
      return 'SUCCEEDED'
    }
  }
}

export {
  StreamObserver,
  ResultStreamObserver,
  LoginObserver,
  ResetObserver,
  FailedObserver,
  CompletedObserver,
  RouteObserver,
  ProcedureRouteObserver
}
