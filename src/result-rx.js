/**
 * Copyright (c) 2002-2019 "Neo4j,"
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
import { newError } from './error'
import ResultSummary from './result-summary'
import { Observable, Subject, ReplaySubject, from } from 'rxjs'
import { flatMap, publishReplay, refCount, shareReplay } from 'rxjs/operators'

const States = {
  READY: 0,
  STREAMING: 1,
  COMPLETED: 2
}

export default class RxResult {
  /**
   *
   * @param {Observable<Result>} result
   */
  constructor (result) {
    const replayedResult = result.pipe(
      publishReplay(1),
      refCount()
    )

    this._result = replayedResult
    this._keys = replayedResult.pipe(
      flatMap(r => from(r.keys())),
      publishReplay(1),
      refCount()
    )
    this._records = new Subject()
    this._summary = new ReplaySubject()
    this._state = States.READY
  }

  keys () {
    return this._keys
  }

  records () {
    return this._result.pipe(
      flatMap(
        result =>
          new Observable(recordsObserver =>
            this._startStreaming({ result, recordsObserver })
          )
      )
    )
  }

  /**
   * return {Observable<ResultSummary>}
   */
  summary () {
    return this._result.pipe(
      flatMap(
        result =>
          new Observable(summaryObserver =>
            this._startStreaming({ result, summaryObserver })
          )
      )
    )
  }

  _startStreaming ({
    result,
    recordsObserver = null,
    summaryObserver = null
  } = {}) {
    const subscriptions = []

    if (recordsObserver) {
      subscriptions.push(this._records.subscribe(recordsObserver))
    }

    if (summaryObserver) {
      subscriptions.push(this._summary.subscribe(summaryObserver))
    }

    if (this._state < States.STREAMING) {
      this._state = States.STREAMING

      subscriptions.push({
        unsubscribe: () => {
          if (result.discard) {
            result.discard()
          }
        }
      })

      if (this._records.observers.length === 0) {
        result._discard()
      }

      result.subscribe({
        onNext: record => {
          this._records.next(record)
        },
        onCompleted: summary => {
          this._records.complete()

          this._summary.next(summary)
          this._summary.complete()

          this._state = States.COMPLETED
        },
        onError: err => {
          this._records.error(err)
          this._summary.error(err)

          this._state = States.COMPLETED
        }
      })
    } else if (this._state === States.STREAMING && recordsObserver) {
      recordsObserver.error(
        newError(
          'Streaming has already started with a previous records or summary subscription.'
        )
      )
    }

    return () => {
      subscriptions.forEach(s => s.unsubscribe())
    }
  }
}
