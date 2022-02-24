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
import { pull } from 'lodash'
import { newError, Record, ResultSummary } from 'neo4j-driver-core'
import {
  Observable,
  Subject,
  ReplaySubject,
  from,
  AsyncSubject,
  BehaviorSubject
} from 'rxjs'
import {
  filter,
  flatMap,
  publishReplay,
  refCount,
  shareReplay,
  tap
} from 'rxjs/operators'

const States = {
  READY: 0,
  STREAMING: 1,
  COMPLETED: 2
}

/**
 * The reactive result interface.
 */
export default class RxResult {
  /**
   * @constructor
   * @protected
   * @param {Observable<Result>} result - An observable of single Result instance to relay requests.
   */
  constructor (result) {
    const replayedResult = result.pipe(publishReplay(1), refCount())

    this._result = replayedResult
    this._keys = replayedResult.pipe(
      flatMap(r => from(r.keys())),
      publishReplay(1),
      refCount()
    )
    this._records = undefined
    this._controls = new StreamControl()
    this._summary = new ReplaySubject()
    this._state = States.READY
  }

  /**
   * Returns an observable that exposes a single item containing field names
   * returned by the executing query.
   *
   * Errors raised by actual query execution can surface on the returned
   * observable stream.
   *
   * @public
   * @returns {Observable<string[]>} - An observable stream (with exactly one element) of field names.
   */
  keys () {
    return this._keys
  }

  /**
   * Returns an observable that exposes each record returned by the executing query.
   *
   * Errors raised during the streaming phase can surface on the returned observable stream.
   *
   * @public
   * @returns {Observable<Record>} - An observable stream of records.
   */
  records () {
    const result = this._result.pipe(
      flatMap(
        result =>
          new Observable(recordsObserver =>
            this._startStreaming({ result, recordsObserver })
          )
      )
    )
    result.push = () => this._push()
    return result
  }

  /**
   * Returns an observable that exposes a single item of {@link ResultSummary} that is generated by
   * the server after the streaming of the executing query is completed.
   *
   * *Subscribing to this stream before subscribing to records() stream causes the results to be discarded on the server.*
   *
   * @public
   * @returns {Observable<ResultSummary>} - An observable stream (with exactly one element) of result summary.
   */
  consume () {
    return this._result.pipe(
      flatMap(
        result =>
          new Observable(summaryObserver =>
            this._startStreaming({ result, summaryObserver })
          )
      )
    )
  }

  pause () {
    this._controls.pause()
  }

  resume () {
    return this._controls.resume()
  }

  push () {
    return this._controls.push()
  }

  _startStreaming ({
    result,
    recordsObserver = null,
    summaryObserver = null
  } = {}) {
    const subscriptions = []

    if (summaryObserver) {
      subscriptions.push(this._summary.subscribe(summaryObserver))
    }

    if (this._state < States.STREAMING) {
      this._state = States.STREAMING
      this._setupRecordsStream(result)
      if (recordsObserver) {
        subscriptions.push(this._records.subscribe(recordsObserver))
      } else {
        result._cancel()
      }

      subscriptions.push({
        unsubscribe: () => {
          if (result._cancel) {
            result._cancel()
          }
        }
      })
    } else if (recordsObserver) {
      recordsObserver.error(
        newError(
          'Streaming has already started/consumed with a previous records or summary subscription.'
        )
      )
    }

    return () => {
      subscriptions.forEach(s => s.unsubscribe())
    }
  }

  _setupRecordsStream (result) {
    if (this._records) {
      return this._records
    }

    this._records = createFullyControlledSubject(
      result[Symbol.asyncIterator](),
      {
        complete: async () => {
          this._state = States.COMPLETED
          this._summary.next(await result.summary())
          this._summary.complete()
        },
        error: error => {
          this._state = States.COMPLETED
          this._summary.error(error)
        }
      },
      this._controls
    )
    return this._records
  }
}

function createFullyControlledSubject (
  iterator,
  completeObserver,
  streamControl = new StreamControl()
) {
  const subject = new Subject()

  const pushNextValue = async result => {
    try {
      streamControl.pushing = true
      const { done, value } = await result
      if (done) {
        subject.complete()
        completeObserver.complete()
      } else {
        subject.next(value)
        if (!streamControl.paused) {
          await pushNextValue(iterator.next())
        }
      }
    } catch (error) {
      subject.error(error)
      completeObserver.error(error)
    } finally {
      streamControl.pushing = false
    }
  }

  async function push (value, times = 1) {
    await pushNextValue(iterator.next(value))
  }

  push()

  streamControl.pusher = push

  return subject
}

class StreamControl {
  constructor (push = async () => {}) {
    this._paused = false
    this._pushing = false
    this._push = push
  }

  pause () {
    this._paused = true
  }

  get paused () {
    return this._paused
  }

  set pushing (pushing) {
    this._pushing = pushing
  }

  async resume () {
    const wasPaused = this._paused
    this._paused = false
    if (wasPaused && !this._pushing) {
      await this.push()
    }
  }

  async push () {
    return await this._push()
  }

  set pusher (push) {
    this._push = push
  }
}
