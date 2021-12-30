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
import ResultSummary from '../result-summary'

interface StreamObserver {
  /**
   * Will be called on every record that comes in and transform a raw record
   * to a Object. If user-provided observer is present, pass transformed record
   * to it's onNext method, otherwise, push to record que.
   * @param {Array} rawRecord - An array with the raw record
   */
  onNext?: (rawRecord: any[]) => void
  /**
   * Will be called on errors.
   * If user-provided observer is present, pass the error
   * to it's onError method, otherwise set instance variable _error.
   * @param {Object} error - An error object
   */
  onError: (error: Error) => void
  onCompleted?: (meta: any) => void
}

/**
 * Interface to observe updates on the Result which is being produced.
 *
 */
interface ResultObserver {
  /**
   * Receive the keys present on the record whenever this information is available
   *
   * @param {string[]} keys The keys present on the {@link Record}
   */
  onKeys?: (keys: string[]) => void

  /**
   * Receive the each record present on the {@link @Result}
   * @param {Record} record The {@link Record} produced
   */
  onNext?: (record: Record) => void

  /**
   * Called when the result is fully received
   * @param {ResultSummary| any} summary The result summary
   */
  onCompleted?: (summary: ResultSummary | any) => void

  /**
   * Called when some error occurs during the result proccess or query execution
   * @param {Error} error The error ocurred
   */
  onError?: (error: Error) => void
}

/**
 * Raw observer for the stream
 */
export interface ResultStreamObserver extends StreamObserver {
  /**
   * Cancel pending record stream
   */
  cancel(): void
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
  prepareToHandleSingleResponse(): void

  /**
   * Mark this observer as if it has completed with no metadata.
   */
  markCompleted(): void

  /**
   * Subscribe to events with provided observer.
   * @param {Object} observer - Observer object
   * @param {function(keys: String[])} observer.onKeys - Handle stream header, field keys.
   * @param {function(record: Object)} observer.onNext - Handle records, one by one.
   * @param {function(metadata: Object)} observer.onCompleted - Handle stream tail, the metadata.
   * @param {function(error: Object)} observer.onError - Handle errors, should always be provided.
   */
  subscribe(observer: ResultObserver): void
}

export class CompletedObserver implements ResultStreamObserver {
  subscribe(observer: ResultObserver): void {
    apply(observer, observer.onKeys, [])
    apply(observer, observer.onCompleted, {})
  }

  cancel(): void {
    // do nothing
  }

  prepareToHandleSingleResponse(): void {
    // do nothing
  }

  markCompleted(): void {
    // do nothing
  }

  onError(error: Error): void {
    // nothing to do, already finished
    throw Error('CompletedObserver not supposed to call onError')
  }
}

export class FailedObserver implements ResultStreamObserver {
  private _error: Error
  private _beforeError?: (error: Error) => void
  private _observers: ResultObserver[]

  constructor({
    error,
    onError
  }: {
    error: Error
    onError?: (error: Error) => void | Promise<void>
  }) {
    this._error = error
    this._beforeError = onError
    this._observers = []
    this.onError(error)
  }

  subscribe(observer: ResultObserver): void {
    apply(observer, observer.onError, this._error)
    this._observers.push(observer)
  }

  onError(error: Error): void {
    Promise.resolve(apply(this, this._beforeError, error)).then(() =>
      this._observers.forEach(o => apply(o, o.onError, error))
    )
  }

  cancel(): void {
    // do nothing
  }

  prepareToHandleSingleResponse(): void {
    // do nothing
  }

  markCompleted(): void {
    // do nothing
  }
}

function apply<T>(thisArg: any, func?: (param: T) => void, param?: T): void {
  if (func) {
    func.bind(thisArg)(param as any)
  }
}
