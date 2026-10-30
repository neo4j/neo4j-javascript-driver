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
import { ConnectionProvider, internal, AuthTokenManager, Connection, Releasable, types, ServerInfo, ProtocolVersion } from "neo4j-driver-core"
import HttpConnection, { HttpScheme } from "./connection.http"

const {
    pool: {
        Pool,
        PoolConfig,
    },
    bookmarks: {
        Bookmarks
    },
    txConfig: {
        TxConfig
    },
    constants: {
        ACCESS_MODE_READ,
        ACCESS_MODE_WRITE
    }
} = internal

type AccessMode = typeof ACCESS_MODE_READ | typeof ACCESS_MODE_WRITE

const AUTHENTICATION_ERRORS = [
    'Neo.ClientError.Security.CredentialsExpired',
    'Neo.ClientError.Security.Forbidden',
    'Neo.ClientError.Security.TokenExpired',
    'Neo.ClientError.Security.Unauthorized'
  ]
  

export type HttpConnectionProviderConfig = {
    id: number,
    log: internal.logger.Logger
    address: internal.serverAddress.ServerAddress
    scheme: HttpScheme
    authTokenManager: AuthTokenManager
    config: types.InternalConfig
    [rec: string]: any
}

type AcquisitionContext = { auth?: types.AuthToken, queryEndpoint: string }

export type NewPool =  (...params: ConstructorParameters<typeof internal.pool.Pool<HttpConnection>>) => internal.pool.Pool<HttpConnection>
export type NewHttpConnection = (...params: ConstructorParameters<typeof HttpConnection>) => HttpConnection

export type HttpConnectionProviderInjectable = {
    newPool: NewPool,
    newHttpConnection: NewHttpConnection
}

export default class HttpConnectionProvider extends ConnectionProvider {
    private _id: number
    private _log: internal.logger.Logger
    private _address: internal.serverAddress.ServerAddress
    private _scheme: HttpScheme
    private _authTokenManager: AuthTokenManager
    private _config: types.InternalConfig
    private _path: string
    private _queryEndpoint?: string
    private _openConnections: { [n: number]: HttpConnection }
    private _pool: internal.pool.Pool<HttpConnection>
    private _newHttpConnection: NewHttpConnection

    constructor(config: HttpConnectionProviderConfig, { newPool, newHttpConnection }: HttpConnectionProviderInjectable = {
        newPool: (...params) => new Pool<HttpConnection>(...params),
        newHttpConnection: (...params) => new HttpConnection(...params)
    }) {
        super()
        this._id = config.id
        this._log = config.log
        this._address = config.address
        this._scheme = config.scheme
        this._authTokenManager = config.authTokenManager
        this._config = config.config
        this._path = config.path ?? ''
        this._openConnections = {}
        this._queryEndpoint = `${this._scheme}://${this._address.asHostPort()}${this._path}/db/{databaseName}/query/v2`
        this._newHttpConnection = newHttpConnection
        this._pool = newPool({
            create: this._createConnection.bind(this),
            destroy: this._destroyConnection.bind(this),
            validateOnAcquire: this._validateConnectionOnAcquire.bind(this),
            config: PoolConfig.fromDriverConfig(config.config),
            log: this._log
        })
    }

    async acquireConnection(param?: { accessMode?: string | undefined; database?: string | undefined; bookmarks: internal.bookmarks.Bookmarks; impersonatedUser?: string | undefined; onDatabaseNameResolved?: ((databaseName?: string | undefined) => void) | undefined; auth?: types.AuthToken | undefined } | undefined): Promise<Connection & Releasable> {
        // @ts-expect-error sending unexpected data
        return await this._pool.acquire({ auth: param?.auth, queryEndpoint: this._queryEndpoint }, this._address)
    }


    async verifyConnectivityAndGetServerInfo(param: { database: string; accessMode?: string | undefined } | undefined): Promise<ServerInfo> {
        const discoveryInfo = await HttpConnection.discover({ scheme: this._scheme, address: this._address, path: this._path })

        // @ts-expect-error sending unexpected data
        const connection = await this._pool.acquire({ queryEndpoint: this._queryEndpoint }, this._address)

        try {
            await run(connection, param)
            var [major, minor] = discoveryInfo.version.split('.');
            return new ServerInfo({
                address: this._address.asHostPort(),
                version: discoveryInfo.version
            }, new ProtocolVersion(parseInt(major), parseInt(minor)))
        } finally {
            await connection.release()
        }
    }

    async verifyAuthentication(param: { auth?: types.AuthToken | undefined; database: string ; accessMode: string  }): Promise<boolean> {
        const connection = await this.acquireConnection({ ...param, bookmarks: Bookmarks.empty() })
        try {
            await run(connection, param) 
            return true
        } catch (error) {
            if (AUTHENTICATION_ERRORS.includes(error.code)) {
                return false
            }
            throw error
        } finally {
            await connection.release()
        }
    }

    async supportsMultiDb(): Promise<boolean> {
        return true
    }

    async supportsSessionAuth(): Promise<boolean> {
        return true
    }

    async supportsUserImpersonation(): Promise<boolean> {
        return true
    }

    async close(): Promise<void> {
        await this._pool.close()

        await Promise.all(Object.values(this._openConnections).map(c => c.close()))
    }

    private async _createConnection(
        context: AcquisitionContext,
        address: internal.serverAddress.ServerAddress,
        release: (address: internal.serverAddress.ServerAddress, connection: HttpConnection) => Promise<void>): Promise<HttpConnection> {

        const auth = context.auth ?? await this._authTokenManager.getToken()

        const connection: HttpConnection = this._newHttpConnection({
            release: async () => await release(address, connection),
            auth,
            address,
            queryEndpoint: context.queryEndpoint,
            config: this._config,
            logger: this._log,
            errorHandler: (error: Error & { code: string, retryable: boolean }): Error => {
                if (error == null || typeof error.code !== 'string' || !error.code.startsWith('Neo.ClientError.Security.') || context?.auth != null) {
                    if (error != null && error.code === 'SERVICE_UNAVAILABLE') {
                        this._queryEndpoint = undefined
                    }
                    return error
                }
                const handled = this._authTokenManager.handleSecurityException(auth, error.code as unknown as `Neo.ClientError.Security.${string}`)
                if (handled) {
                    error.retryable = true
                }

                return error
            }
        })

        this._openConnections[connection.id] = connection

        return connection
    }

    private async _validateConnectionOnAcquire(context: AcquisitionContext, conn: HttpConnection): Promise<boolean> {
        try {
            conn.queryEndpoint = context.queryEndpoint
            conn.auth = context.auth ?? await this._authTokenManager.getToken()
            return true
        } catch (error) {
            this._log.debug(
                `The connection ${conn.id} is not valid because of an error ${error.code} '${error.message}'`
            )
            return false
        }
    }

    private async _destroyConnection(conn: HttpConnection): Promise<void> {
        delete this._openConnections[conn.id]
        return await conn.close()
    }
}

/**
 * Execute a query and reports possible errors
 * @param connection 
 * @param config 
 * @returns Promise of correct execution
 */
function run(connection: Connection, config: { database: string; accessMode?: string | undefined } | undefined): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        connection.run('CALL db.ping()', {}, {
            database: config?.database, mode: config?.accessMode as AccessMode, fetchSize: 200, reactive: false, bookmarks: Bookmarks.empty(), highRecordWatermark: 10, lowRecordWatermark: 0, txConfig: TxConfig.empty()
        })
            .subscribe({
                onCompleted() {
                    resolve()
                },
                onError(error) {
                    reject(error)
                }
            })
    })
}
