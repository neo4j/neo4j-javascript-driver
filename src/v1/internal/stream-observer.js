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
import Record from '../record'

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
class StreamObserver {
  constructor () {
    this._fieldKeys = null
    this._fieldLookup = null
    this._queuedRecords = []
    this._tail = null
    this._error = null
    this._hasFailed = false
    this._observer = null
    this._conn = null
    this._meta = {}
  }

  /**
   * Will be called on every record that comes in and transform a raw record
   * to a Object. If user-provided observer is present, pass transformed record
   * to it's onNext method, otherwise, push to record que.
   * @param {Array} rawRecord - An array with the raw record
   */
  onNext (rawRecord) {
    const record = new Record(this._fieldKeys, rawRecord, this._fieldLookup)
    if (this._observer) {
      this._observer.onNext(record)
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
      }
    } else {
      // End of stream
      if (this._observer) {
        this._observer.onCompleted(meta)
      } else {
        this._tail = meta
      }
    }
    this._copyMetadataOnCompletion(meta)
  }

  _copyMetadataOnCompletion (meta) {
    for (var key in meta) {
      if (meta.hasOwnProperty(key)) {
        this._meta[key] = meta[key]
      }
    }
  }

  serverMetadata () {
    const serverMeta = { server: this._conn.server }
    return Object.assign({}, this._meta, serverMeta)
  }

  resolveConnection (conn) {
    this._conn = conn
  }

  /**
   * Stream observer defaults to handling responses for two messages: RUN + PULL_ALL or RUN + DISCARD_ALL.
   * Response for RUN initializes statement keys. Response for PULL_ALL / DISCARD_ALL exposes the result stream.
   *
   * However, some operations can be represented as a single message which receives full metadata in a single response.
   * For example, operations to begin, commit and rollback an explicit transaction use two messages in Bolt V1 but a single message in Bolt V3.
   * Messages are `RUN "BEGIN" {}` + `PULL_ALL` in Bolt V1 and `BEGIN` in Bolt V3.
   *
   * This function prepares the observer to only handle a single response message.
   */
  prepareToHandleSingleResponse () {
    this._fieldKeys = []
  }

  /**
   * Mark this observer as if it has completed with no metadata.
   */
  markCompleted () {
    this._fieldKeys = []
    this._tail = {}
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
    this._hasFailed = true

    if (this._observer) {
      if (this._observer.onError) {
        this._observer.onError(error)
      } else {
        console.log(error)
      }
    } else {
      this._error = error
    }
  }

  /**
   * Subscribe to events with provided observer.
   * @param {Object} observer - Observer object
   * @param {function(record: Object)} observer.onNext - Handle records, one by one.
   * @param {function(metadata: Object)} observer.onComplete - Handle stream tail, the metadata.
   * @param {function(error: Object)} observer.onError - Handle errors.
   */
  subscribe (observer) {
    if (this._error) {
      observer.onError(this._error)
      return
    }
    if (this._queuedRecords.length > 0) {
      for (let i = 0; i < this._queuedRecords.length; i++) {
        observer.onNext(this._queuedRecords[i])
      }
    }
    if (this._tail) {
      observer.onCompleted(this._tail)
    }
    this._observer = observer
  }

  hasFailed () {
    return this._hasFailed
  }
}

export default StreamObserver
