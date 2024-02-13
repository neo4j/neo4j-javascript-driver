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
import { ConnectionProvider, internal, AuthTokenManager, Connection, Releasable, auth, types, ServerInfo } from "neo4j-driver-core"
import HttpConnection from "./connection.http"
import { InternalConfig } from "neo4j-driver-core/types/types"

type HttpScheme = 'http' | 'https'

export interface HttpConnectionProviderConfig {
    id: number,
    log: internal.logger.Logger
    address: internal.serverAddress.ServerAddress
    scheme: HttpScheme
    authTokenManager: AuthTokenManager
    config: types.InternalConfig
    [rec: string]: any
}

export default class HttpConnectionProvider extends ConnectionProvider {
    private _id: number
    private _log: internal.logger.Logger
    private _address: internal.serverAddress.ServerAddress
    private _scheme: HttpScheme
    private _authTokenManager: AuthTokenManager
    private _config: types.InternalConfig


    constructor(config: HttpConnectionProviderConfig) {
        super()
        this._id = config.id
        this._log = config.log
        this._address = config.address
        this._scheme = config.scheme
        this._authTokenManager = config.authTokenManager
        this._config = config.config
    }

    async acquireConnection(param?: { accessMode?: string | undefined; database?: string | undefined; bookmarks: internal.bookmarks.Bookmarks; impersonatedUser?: string | undefined; onDatabaseNameResolved?: ((databaseName?: string | undefined) => void) | undefined; auth?: types.AuthToken | undefined } | undefined): Promise<Connection & Releasable> {
        const auth = param?.auth ?? await this._authTokenManager.getToken()
        
        return new HttpConnection({ release: async () => console.log('release'), auth, address: this._address, database: (param?.database ?? 'neo4j'), scheme: this._scheme, config: this._config }) 
    }


    async verifyConnectivityAndGetServerInfo(param?: { database?: string | undefined; accessMode?: string | undefined } | undefined): Promise<ServerInfo> {
        return new ServerInfo({}, 5.0)
    }
    async close(): Promise<void> {
        
    }
}