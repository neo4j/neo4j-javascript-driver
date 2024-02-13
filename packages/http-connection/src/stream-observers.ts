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

import { Record, ResultObserver, internal } from "neo4j-driver-core"

export interface ResultStreamObserverConfig {
    highRecordWatermark: number,
    lowRecordWatermark: number,
    beforeError?: (error: Error) => void;
    afterComplete?: (metadata: unknown) => void;
    server: internal.serverAddress.ServerAddress
}

export class ResultStreamObserver implements internal.observer.ResultStreamObserver {
    private _paused: boolean
    private _queuedRecords: Record[]
    private _completed: boolean
    private _keys: string[]
    private _highRecordWatermark: number
    private _lowRecordWatermark: number
    private _resultObservers: ResultObserver[]
    private _metadata?: any
    private _error?: Error
    private _beforeError?: (error: Error) => void;
    private _afterComplete?: (metadata: unknown) => void;
    private _server: internal.serverAddress.ServerAddress

    constructor(config: ResultStreamObserverConfig) {
        this._paused = false
        this._completed = false
        this._queuedRecords = []
        this._lowRecordWatermark = config.lowRecordWatermark
        this._highRecordWatermark = config.highRecordWatermark
        this._beforeError = config.beforeError
        this._afterComplete = config.afterComplete
        this._server = config.server

        this._resultObservers = []
    }

    get completed() {
        return this._completed
    }

    get paused () {
        return this._paused
    }

    cancel() {
        this._completed = true
        this._queuedRecords = []
    }
    pause() {
        this._paused = true
    }

    resume() {
        this._paused = false
    }

    

    prepareToHandleSingleResponse: () => void;

    markCompleted() {
        this._completed = true
    }

    subscribe(observer: ResultObserver) {
        if (this._keys != null && observer.onKeys != null) {
            observer.onKeys(this._keys)
        }

        if (this._queuedRecords.length > 0 && observer.onNext) {
            for (let i = 0; i < this._queuedRecords.length; i++) {
                observer.onNext(this._queuedRecords[i])
                if (this._queuedRecords.length - i - 1 <= this._lowRecordWatermark) {
                    this.resume()
                }
            }
        }
        if (this._metadata && observer.onCompleted) {
            observer.onCompleted(this._metadata)
        }
        if (this._error && observer.onError) {
            observer.onError(this._error)
        }
        this._resultObservers.push(observer)

        // start stream
    }
    onKeys(keys: any[]): void {
        this._keys = keys
        const observingOnKeys = this._resultObservers.filter(o => o.onNext)
        if (observingOnKeys.length > 0) {
            observingOnKeys.forEach(o => o.onKeys!(this._keys))
        }
    }

    onNext(rawRecord: any[]): void {
        const record = new Record(this._keys, rawRecord)
        const observingOnNext = this._resultObservers.filter(o => o.onNext)
        if (observingOnNext.length > 0) {
            observingOnNext.forEach(o => o.onNext!(record))
        } else {
            this._queuedRecords.push(record)
            if (this._queuedRecords.length > this._highRecordWatermark) {
                this.pause()
            }
        }
    }
    onError(error: Error) {
        this._error = error

        let beforeHandlerResult = null
        if (this._beforeError) {
            beforeHandlerResult = this._beforeError(error)
        }

        const continuation = () => {
            this._resultObservers.filter(o => o.onError)
                .forEach(o => o.onError!(error))

            // if (this._afterError) {
            //     this._afterError(error)
            // }
        }

        if (beforeHandlerResult) {
            Promise.resolve(beforeHandlerResult).then(() => continuation())
        } else {
            continuation()
        }
    }

    onCompleted(meta: any): void {
        const completionMetadata = Object.assign(
            this._server ? { server: this._server } : {},
            //this._meta,
            meta
        )
        this._metadata = completionMetadata
        this.markCompleted()
        const observingOnCompleted = this._resultObservers.filter(o => o.onCompleted)
        if (observingOnCompleted.length > 0) {
            observingOnCompleted.forEach(o => o.onCompleted!(this._metadata))
        }

        if (this._afterComplete) {
            console.log('afterComplete', completionMetadata)
            this._afterComplete(completionMetadata)
        }

    }
}