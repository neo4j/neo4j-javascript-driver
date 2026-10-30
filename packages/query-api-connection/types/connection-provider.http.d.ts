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
import { ConnectionProvider, internal, AuthTokenManager, Connection, Releasable, types, ServerInfo } from "neo4j-driver-core";
import HttpConnection, { HttpScheme } from "./connection.http";
export type HttpConnectionProviderConfig = {
    id: number;
    log: internal.logger.Logger;
    address: internal.serverAddress.ServerAddress;
    scheme: HttpScheme;
    authTokenManager: AuthTokenManager;
    config: types.InternalConfig;
    [rec: string]: any;
};
export type NewPool = (...params: ConstructorParameters<typeof internal.pool.Pool<HttpConnection>>) => internal.pool.Pool<HttpConnection>;
export type NewHttpConnection = (...params: ConstructorParameters<typeof HttpConnection>) => HttpConnection;
export type HttpConnectionProviderInjectable = {
    newPool: NewPool;
    newHttpConnection: NewHttpConnection;
};
export default class HttpConnectionProvider extends ConnectionProvider {
    private _id;
    private _log;
    private _address;
    private _scheme;
    private _authTokenManager;
    private _config;
    private _path;
    private _queryEndpoint?;
    private _openConnections;
    private _pool;
    private _newHttpConnection;
    constructor(config: HttpConnectionProviderConfig, { newPool, newHttpConnection }?: HttpConnectionProviderInjectable);
    acquireConnection(param?: {
        accessMode?: string | undefined;
        database?: string | undefined;
        bookmarks: internal.bookmarks.Bookmarks;
        impersonatedUser?: string | undefined;
        onDatabaseNameResolved?: ((databaseName?: string | undefined) => void) | undefined;
        auth?: types.AuthToken | undefined;
    } | undefined): Promise<Connection & Releasable>;
    verifyConnectivityAndGetServerInfo(param: {
        database: string;
        accessMode?: string | undefined;
    } | undefined): Promise<ServerInfo>;
    verifyAuthentication(param: {
        auth?: types.AuthToken | undefined;
        database: string;
        accessMode: string;
    }): Promise<boolean>;
    supportsMultiDb(): Promise<boolean>;
    supportsSessionAuth(): Promise<boolean>;
    supportsUserImpersonation(): Promise<boolean>;
    close(): Promise<void>;
    private _createConnection;
    private _validateConnectionOnAcquire;
    private _destroyConnection;
}
