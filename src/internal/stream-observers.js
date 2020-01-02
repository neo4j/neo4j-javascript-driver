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
import Record from '../record'
import Connection from './connection'
import { newError, PROTOCOL_ERROR } from '../error'
import Integer from '../integer'
import { ALL } from './request-message'

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
   * @param {Connection} param.connection
   * @param {boolean} param.reactive
   * @param {function(connection: Connection, stmtId: number|Integer, n: number|Integer, observer: StreamObserver)} param.moreFunction -
   * @param {function(connection: Connection, stmtId: number|Integer, observer: StreamObserver)} param.discardFunction -
   * @param {number|Integer} param.fetchSize -
   * @param {function(err: Error): Promise|void} param.beforeError -
   * @param {function(err: Error): Promise|void} param.afterError -
   * @param {function(keys: string[]): Promise|void} param.beforeKeys -
   * @param {function(keys: string[]): Promise|void} param.afterKeys -
   * @param {function(metadata: Object): Promise|void} param.beforeComplete -
   * @param {function(metadata: Object): Promise|void} param.afterComplete -
   */
  constructor ({
    connection,
    reactive = false,
    moreFunction,
    discardFunction,
    fetchSize = ALL,
    beforeError,
    afterError,
    beforeKeys,
    afterKeys,
    beforeComplete,
    afterComplete
  } = {}) {
    super()

    this._connection = connection
    this._reactive = reactive
    this._streaming = false

    this._fieldKeys = null
    this._fieldLookup = null
    this._head = null
    this._queuedRecords = []
    this._tail = null
    this._error = null
    this._hasFailed = false
    this._observers = []
    this._meta = {}

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
    this._finished = false
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
    }
  }

  onCompleted (meta) {
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
      if (meta.qid) {
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

        if (this._reactive) {
          this._handleStreaming()
        }
      }

      if (beforeHandlerResult) {
        Promise.resolve(beforeHandlerResult).then(() => continuation())
      } else {
        continuation()
      }
    } else {
      this._streaming = false

      if (meta.has_more) {
        // We've consumed current batch and server notified us that there're more
        // records to stream. Let's invoke more or discard function based on whether
        // the user wants to discard streaming or not
        this._handleStreaming()

        delete meta.has_more
      } else {
        this._finished = true
        const completionMetadata = Object.assign(
          this._connection ? { server: this._connection.server } : {},
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
    }
  }

  _handleStreaming () {
    if (
      this._head &&
      this._observers.some(o => o.onNext || o.onCompleted) &&
      !this._streaming
    ) {
      this._streaming = true

      if (this._discard) {
        this._discardFunction(this._connection, this._queryId, this)
      } else {
        this._moreFunction(
          this._connection,
          this._queryId,
          this._fetchSize,
          this
        )
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
  }

  /**
   * Mark this observer as if it has completed with no metadata.
   */
  markCompleted () {
    this._head = []
    this._fieldKeys = []
    this._tail = {}
    this._finished = true
  }

  /**
   * Cancel pending record stream
   */
  cancel () {
    this._discard = true
  }

  /**
   * Will be called on errors.
   * If user-provided observer is present, pass the error
   * to it's onError method, otherwise set instance variable _error.
   * @param {Object} error - An error object
   */
  onError (error) {
    if (this._hasFailed) {
      return
    }

    this._finished = true
    this._hasFailed = true
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
      }
    }
    if (this._tail && observer.onCompleted) {
      observer.onCompleted(this._tail)
    }
    this._observers.push(observer)

    if (this._reactive && !this._finished) {
      this._handleStreaming()
    }
  }

  hasFailed () {
    return this._hasFailed
  }
}

class LoginObserver extends StreamObserver {
  /**
   *
   * @param {Object} param -
   * @param {Connection} param.connection
   * @param {function(err: Error)} param.beforeError
   * @param {function(err: Error)} param.afterError
   * @param {function(metadata)} param.beforeComplete
   * @param {function(metadata)} param.afterComplete
   */
  constructor ({
    connection,
    beforeError,
    afterError,
    beforeComplete,
    afterComplete
  } = {}) {
    super()

    this._connection = connection
    this._beforeError = beforeError
    this._afterError = afterError
    this._beforeComplete = beforeComplete
    this._afterComplete = afterComplete
  }

  onNext (record) {
    this.onError(
      newError('Received RECORD when initializing ' + JSON.stringify(record))
    )
  }

  onError (error) {
    if (this._beforeError) {
      this._beforeError(error)
    }

    this._connection._updateCurrentObserver() // make sure this exact observer will not be called again
    this._connection._handleFatalError(error) // initialization errors are fatal

    if (this._afterError) {
      this._afterError(error)
    }
  }

  onCompleted (metadata) {
    if (this._beforeComplete) {
      this._beforeComplete(metadata)
    }

    if (metadata) {
      // read server version from the response metadata, if it is available
      const serverVersion = metadata.server
      if (!this._connection.version) {
        this._connection.version = serverVersion
      }

      // read database connection id from the response metadata, if it is available
      const dbConnectionId = metadata.connection_id
      if (!this._connection.databaseId) {
        this._connection.databaseId = dbConnectionId
      }
    }

    if (this._afterComplete) {
      this._afterComplete(metadata)
    }
  }
}

class ResetObserver extends StreamObserver {
  /**
   *
   * @param {Object} param -
   * @param {Connection} param.connection
   * @param {function(err: Error)} param.onError
   * @param {function(metadata)} param.onComplete
   */
  constructor ({ connection, onError, onComplete } = {}) {
    super()

    this._connection = connection
    this._onError = onError
    this._onComplete = onComplete
  }

  onNext (record) {
    this.onError(
      newError(
        'Received RECORD when resetting: received record is: ' +
          JSON.stringify(record),
        PROTOCOL_ERROR
      )
    )
  }

  onError (error) {
    if (error.code === PROTOCOL_ERROR) {
      this._connection._handleProtocolError(error.message)
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

export {
  StreamObserver,
  ResultStreamObserver,
  LoginObserver,
  ResetObserver,
  FailedObserver,
  CompletedObserver
}
