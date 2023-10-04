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
import { observer } from '../../src/internal'
import {
  Record,
  ResultObserver
} from '../../src'

export default class ResultStreamObserverMock implements observer.ResultStreamObserver {
  private readonly _queuedRecords: Record[]
  private _fieldKeys?: string[]
  private readonly _observers: ResultObserver[]
  private _error?: Error
  private _meta?: any
  private readonly _beforeError?: (error: Error) => void
  private readonly _afterComplete?: (metadata: any) => void

  constructor (observers?: { beforeError?: (error: Error) => void, afterComplete?: (metadata: any) => void }) {
    this._queuedRecords = []
    this._observers = []
    this._beforeError = observers?.beforeError
    this._afterComplete = observers?.afterComplete
  }

  get error (): Error | undefined {
    return this._error
  }

  cancel (): void {}

  prepareToHandleSingleResponse (): void {}

  markCompleted (): void {}

  subscribe (observer: ResultObserver): void {
    this._observers.push(observer)

    if ((observer.onError != null) && (this._error != null)) {
      observer.onError(this._error)
      return
    }

    if ((observer.onKeys != null) && (this._fieldKeys != null)) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      observer.onKeys(this._fieldKeys)
    }

    if (observer.onNext != null) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      this._queuedRecords.forEach(record => observer.onNext!(record))
    }

    if ((observer.onCompleted != null) && this._meta != null) {
      observer.onCompleted(this._meta)
    }
  }

  onKeys (keys: string[]): void {
    this._fieldKeys = keys
    this._observers.forEach(o => {
      if (o.onKeys != null) {
        o.onKeys(keys)
      }
    })
  }

  onNext (rawRecord: any[]): void {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const record = new Record(this._fieldKeys!, rawRecord)
    const streamed = this._observers
      .filter(o => o.onNext)
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      .map(o => o.onNext!(record))
      .reduce(() => true, false)

    if (!streamed) {
      this._queuedRecords.push(record)
    }
  }

  onError (error: Error): void {
    this._error = error
    if (this._beforeError != null) {
      this._beforeError(error)
    }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    this._observers.filter(o => o.onError).forEach(o => o.onError!(error))
  }

  onCompleted (meta: any): void {
    this._meta = meta
    this._observers
      .filter(o => o.onCompleted)
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      .forEach(o => o.onCompleted!(meta))

    if (this._afterComplete != null) {
      this._afterComplete(meta)
    }
  }

  pause (): void {
    // do nothing
  }

  resume (): void {
    // do nothing
  }
}
