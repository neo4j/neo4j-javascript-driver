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
import { Connection, types, internal, ProtocolVersion } from "neo4j-driver-core";
import { BeginTransactionConfig, CommitTransactionConfig, RunQueryConfig } from "neo4j-driver-core/types/connection";
export type HttpScheme = 'http' | 'https';
export interface HttpConnectionConfig {
    release: () => Promise<void>;
    auth: types.AuthToken;
    queryEndpoint: string;
    address: internal.serverAddress.ServerAddress;
    config: any;
    logger: internal.logger.Logger;
    errorHandler: (error: Error & {
        code: string;
        retryable: boolean;
    }) => Error;
}
export default class HttpConnection extends Connection {
    private _release;
    private _auth;
    private _queryEndpoint;
    private _address;
    private _config;
    private _abortControllers;
    private _log?;
    private _sessionAffinityHeader;
    private _id;
    private _errorHandler;
    private _open;
    private _currentTx;
    private _workPipe;
    constructor(config: HttpConnectionConfig);
    run(query: string, parameters?: Record<string, unknown> | undefined, config?: RunQueryConfig | undefined): internal.observer.ResultStreamObserver;
    private _headers;
    beginTransaction(config: BeginTransactionConfig): internal.observer.ResultStreamObserver;
    commitTransaction(config: CommitTransactionConfig): internal.observer.ResultStreamObserver;
    rollbackTransaction(config: CommitTransactionConfig): internal.observer.ResultStreamObserver;
    private _getTransactionApi;
    private _getTransactionCommitApi;
    private _getExplicityTransactionApi;
    static discover({ scheme, address, path }: {
        scheme: HttpScheme;
        address: internal.serverAddress.ServerAddress;
        path?: string;
    }): Promise<{
        query: string;
        version: string;
        edition: string;
    }>;
    get id(): number;
    set auth(auth: types.AuthToken);
    get auth(): types.AuthToken;
    set queryEndpoint(queryEndpoint: string);
    get queryEndpoint(): string;
    getProtocolVersion(): ProtocolVersion;
    isOpen(): boolean;
    hasOngoingObservableRequests(): boolean;
    resetAndFlush(): Promise<void>;
    release(): Promise<void>;
    close(): Promise<void>;
    toString(): string;
    private _catch;
    private _finally;
    private _newAbortController;
}
