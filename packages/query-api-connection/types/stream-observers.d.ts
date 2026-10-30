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
import { ResultObserver, internal } from "neo4j-driver-core";
export interface ResultStreamObserverConfig {
    highRecordWatermark: number;
    lowRecordWatermark: number;
    beforeError?: (error: Error) => void;
    afterComplete?: (metadata: unknown) => void;
    server: internal.serverAddress.ServerAddress;
}
export declare class ResultStreamObserver implements internal.observer.ResultStreamObserver {
    private _paused;
    private _queuedRecords;
    private _completed;
    private _keys;
    private _highRecordWatermark;
    private _lowRecordWatermark;
    private _resultObservers;
    private _metadata?;
    private _error?;
    private _beforeError?;
    private _afterComplete?;
    private _server;
    private _haveRecordStreamed;
    private readonly _fsm;
    constructor(config: ResultStreamObserverConfig);
    get completed(): boolean;
    get paused(): boolean;
    cancel(): void;
    pause(): void;
    resume(): void;
    prepareToHandleSingleResponse(): void;
    markCompleted(): void;
    subscribe(observer: ResultObserver): void;
    onKeys(keys: any[]): void;
    _onKeys(keys: any[]): void;
    onNext(rawRecord: any[]): void;
    _onNext(rawRecord: any[]): void;
    onError(error: Error): void;
    _onError(error: Error): void;
    /**
     *
     * @param {any|false} meta The metadata returned from server. Or false,
     * if observer should complete with {}
     */
    onCompleted(meta: any): void;
    _onCompleted(meta: any): void;
}
