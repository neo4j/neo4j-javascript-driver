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
import { FSM, FSMTransition } from "./fsm";

export interface ResultStreamObserverConfig {
    highRecordWatermark: number,
    lowRecordWatermark: number,
    beforeError?: (error: Error) => void;
    afterComplete?: (metadata: unknown) => void;
    server: internal.serverAddress.ServerAddress
}

type Events = 'keys' | 'next' | 'error' | 'completed'
type States = 'READY' | 'STREAMING' | 'SUCCEEDED' | 'FAILED'

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
    private _haveRecordStreamed: boolean
    private readonly _fsm: FSM<States, Events>


    constructor(config: ResultStreamObserverConfig) {
        this._paused = false
        this._completed = false
        this._queuedRecords = []
        this._lowRecordWatermark = config.lowRecordWatermark
        this._highRecordWatermark = config.highRecordWatermark
        this._beforeError = config.beforeError
        this._afterComplete = config.afterComplete
        this._server = config.server
        this._haveRecordStreamed = false
        this._fsm = newFSM(this)

        this._resultObservers = []
    }

    get completed() {
        return this._completed
    }

    get paused() {
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

    prepareToHandleSingleResponse() {
        this.onKeys([])
    }

    markCompleted() {
        this._completed = true
        if (this._keys == null) {
            this.onKeys([])
        }
        this.onCompleted(false)
    }

    subscribe(observer: ResultObserver) {
        if (this._keys != null && observer.onKeys != null) {
            observer.onKeys(this._keys)
        }

        if (this._queuedRecords.length > 0 && observer.onNext) {
            while (this._queuedRecords.length > 0) {
                const record = this._queuedRecords.shift()
                if (record != null) {
                    observer.onNext(record)
                }

                if (this._queuedRecords.length - 1 <= this._lowRecordWatermark) {
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
        this._fsm.onEvent('keys', keys)
    }

    _onKeys(keys: any[]): void {
        this._keys = keys
        const observingOnKeys = this._resultObservers.filter(o => o.onKeys)
        if (observingOnKeys.length > 0) {
            observingOnKeys.forEach(o => o.onKeys!(this._keys))
        }
    }

    onNext(rawRecord: any[]): void {
        this._fsm.onEvent('next', rawRecord)
    }

    _onNext(rawRecord: any[]): void {
        this._haveRecordStreamed = true
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
        this._fsm.onEvent('error', error)
    }

    _onError(error: Error) {
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

    /**
     * 
     * @param {any|false} meta The metadata returned from server. Or false,
     * if observer should complete with {}
     */
    onCompleted(meta: any): void {
        this._fsm.onEvent('completed', meta)
    }

    _onCompleted(meta: any): void {
        const completionMetadata = meta !== false ? Object.assign(
            this._server ? { server: this._server } : {},
            meta,
            {
                stream_summary: {
                    have_records_streamed: this._haveRecordStreamed,
                    pulled: true,
                    has_keys: this._keys.length > 0
                }
            }
        ) : {}
        this._metadata = completionMetadata
        this._completed = true
        const observingOnCompleted = this._resultObservers.filter(o => o.onCompleted)
        if (observingOnCompleted.length > 0) {
            observingOnCompleted.forEach(o => o.onCompleted!(this._metadata))
        }

        if (this._afterComplete) {
            this._afterComplete(completionMetadata)
        }

    }
}

function newFSM(observer: ResultStreamObserver): FSM<States, Events> {
    const onInvalidTransition = (state: States, event: Events) => (_: unknown): FSMTransition<States> => {
        const result = observer._onError(new Error(`Invalid event. State: ${state}, Event: ${event}`))
        return {
            nextState: 'FAILED',
            result
        }
    }

    const onFailure = (error: Error): FSMTransition<States> => {
        const result = observer._onError(error)
        return {
            nextState: 'FAILED',
            result
        }
    }

    const ignore = () => ({})

    return new FSM<States, Events>(
        {
            name: 'READY',
            events: {
                keys: (keys: string[]) => {
                    const result = observer._onKeys(keys)
                    return {
                        nextState: 'STREAMING',
                        result
                    }
                },
                completed: onInvalidTransition('READY', 'completed'),
                next: onInvalidTransition('READY', 'next'),
                error: onFailure
            }
        },
        {
            name: 'STREAMING',
            events: {
                keys: onInvalidTransition('STREAMING', 'keys'),
                completed: (metadata: any) => {
                    const result = observer._onCompleted(metadata)
                    return {
                        nextState: 'SUCCEEDED',
                        result
                    }
                },
                next: (rawRecord: any[]) => {
                    const result = observer._onNext(rawRecord)
                    return {
                        result
                    }
                },
                error: onFailure
            }
        },
        {
            name: 'SUCCEEDED',
            events: {
                keys: ignore,
                next: ignore,
                completed: ignore,
                error: ignore
            }
        },
        {
            name: 'FAILED',
            events: {
                keys: ignore,
                next: ignore,
                completed: ignore,
                error: ignore
            }
        }
    )
}


