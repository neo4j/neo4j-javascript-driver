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

import { Connection, types, internal, newError, ProtocolVersion } from "neo4j-driver-core"
import { BeginTransactionConfig, CommitTransactionConfig, RunQueryConfig } from "neo4j-driver-core/types/connection"
import { ResultStreamObserver } from "./stream-observers"
import { QueryRequestCodec, QueryResponseCodec, RawQueryResponse } from "./query.codec"
import { BeginTransactionRequestCodec, RawBeginTransactionResponse, BeginTransactionResponseCodec, CommitTransactionRequestCodec, RawCommitTransactionResponse, CommitTransactionResponseCodec, RollbackTransactionRequestCodec, RawRollbackTransactionResponse, RollbackTransactionResponseCodec } from "./transaction.codec"
import Pipe from "./lang/pipe"

export type HttpScheme = 'http' | 'https'

let currentId = 0

export interface HttpConnectionConfig {
    release: () => Promise<void>
    auth: types.AuthToken
    queryEndpoint: string
    address: internal.serverAddress.ServerAddress
    config: any
    logger: internal.logger.Logger,
    errorHandler: (error: Error & { code: string, retryable: boolean }) => Error
}


export default class HttpConnection extends Connection {
    private _release: () => Promise<void>
    private _auth: types.AuthToken
    private _queryEndpoint: string
    // @ts-ignore
    private _address: internal.serverAddress.ServerAddress
    private _config: types.InternalConfig
    private _abortControllers: AbortController[]
    private _log?: internal.logger.Logger
    private _sessionAffinityHeader: string 
    private _id: number
    private _errorHandler: (error: Error & { code: string, retryable: boolean }) => Error
    private _open: boolean
    private _currentTx: { id: string, affinity?: string, host?: string, expires: Date,  database: string } | undefined
    private _workPipe: Pipe

    constructor(config: HttpConnectionConfig) {
        super()
        this._id = currentId++
        this._release = config.release
        this._auth = config.auth
        this._queryEndpoint = config.queryEndpoint
        this._config = config.config
        this._log = config.logger
        this._errorHandler = config.errorHandler
        this._open = true
        this._currentTx = undefined
        this._workPipe = new Pipe(config.logger)
        this._abortControllers = []
        this._sessionAffinityHeader = config.config.httpSessionAffinityHeader ?? 'neo4j-cluster-affinity'
    }

    run(query: string, parameters?: Record<string, unknown> | undefined, config?: RunQueryConfig | undefined): internal.observer.ResultStreamObserver {
        const observer = new ResultStreamObserver({
            highRecordWatermark: config?.highRecordWatermark ?? Number.MAX_SAFE_INTEGER,
            lowRecordWatermark: config?.lowRecordWatermark ?? Number.MIN_SAFE_INTEGER,
            afterComplete: config?.afterComplete,
            beforeError: config?.beforeError,
            server: this._address,
        })

        const requestCodec = QueryRequestCodec.of(
            this._auth,
            query,
            parameters,
            config
        )

        const abortController = this._newAbortController()

        this._workPipe.attach(async () => {
            const request: RequestInit & { url: string } = {
                url: this._getTransactionApi(config?.database!),
                method: 'POST',
                mode: 'cors',
                headers: this._headers(requestCodec),
                signal: abortController.signal,
                body: JSON.stringify(requestCodec.body)
            }
    
            this._log?.debug(`${this} REQUEST: ${JSON.stringify(request)}`)

            const res = await fetch(request.url, request)
            const batchSize = config?.fetchSize ?? Number.MAX_SAFE_INTEGER
            const codec = await QueryResponseCodec.ofResponse(this._config, request.url, res);

            observer.onKeys(await codec.keys)
            const stream = codec.stream()

            while (!observer.completed) {
                if (observer.paused) {
                    await new Promise((resolve) => setTimeout(resolve, 20))
                    continue
                }

                for (let i = 0; !observer.paused && i < batchSize && !observer.completed; i++) {
                    const { done, value: rawRecord } = await stream.next()
                    if (!done) {
                        observer.onNext(rawRecord)
                    } else {
                        observer.onCompleted(await codec.meta)
                    }
                }
            }

            observer.onCompleted(await codec.meta)            
        })
            .catch(this._catch(observer))
            .finally(this._finally(abortController))

        return observer
    }

    private _headers(requestCodec: {
        contentType: string,
        accept: string,
        authorization: string
    }) {
        const headers: Record<string, string>  = {
            'Content-Type': requestCodec.contentType,
            Accept: requestCodec.accept,
            Authorization: requestCodec.authorization,
        }

        if (this._currentTx?.affinity != null) {
            headers[this._sessionAffinityHeader] = this._currentTx.affinity
        } 
        return headers
    }


    beginTransaction(config: BeginTransactionConfig): internal.observer.ResultStreamObserver {
        const observer = new ResultStreamObserver({
            server: this._address,
            afterComplete: config?.afterComplete,
            beforeError: config.beforeError,
            highRecordWatermark: Number.MAX_SAFE_INTEGER,
            lowRecordWatermark: Number.MIN_SAFE_INTEGER,
          })
        observer.prepareToHandleSingleResponse()


        const requestCodec = BeginTransactionRequestCodec.of(
            this._auth,
            config
        )

        const abortController = this._newAbortController()

        this._workPipe.attach(async () => {
            const request: RequestInit & { url: string } = {
                url: this._getExplicityTransactionApi(config?.database!),
                method: 'POST',
                mode: 'cors',
                headers: this._headers(requestCodec),
                signal: abortController.signal,
                body: JSON.stringify(requestCodec.body)
            }
    
            this._log?.debug(`${this} REQUEST: ${JSON.stringify(request)} `)

            const res = await fetch(request.url, request) 
            const {
                body: rawBeginTransactionResponse,
                headers: [contentType, affinity]
            } = await readBodyAndReaders<RawBeginTransactionResponse>(request.url, res, 'content-type', this._sessionAffinityHeader)

            this._log?.debug(`${this} RESPONSE: { body: ${JSON.stringify(rawBeginTransactionResponse)}, headers: { content-type: ${contentType}, ${this._sessionAffinityHeader}: ${affinity} }}`);
            
            const codec = BeginTransactionResponseCodec.of(this._config, contentType ?? '', rawBeginTransactionResponse);

            if (codec.error != null) {
                throw codec.error
            }

            this._currentTx = {
                id: codec.id,
                host: codec.host,
                expires: codec.expires,
                database: config?.database!,
            }

            if (affinity != null) {
                this._currentTx.affinity = affinity
            }

            observer.onCompleted({})
        
        })
            .catch(this._catch(observer))
            .finally(this._finally(abortController))

        return observer
    }

    commitTransaction(config: CommitTransactionConfig): internal.observer.ResultStreamObserver {
        const observer = new ResultStreamObserver({
            server: this._address,
            afterComplete: config?.afterComplete,
            beforeError: config.beforeError,
            highRecordWatermark: Number.MAX_SAFE_INTEGER,
            lowRecordWatermark: Number.MIN_SAFE_INTEGER,
          })
        observer.prepareToHandleSingleResponse()


        const requestCodec = CommitTransactionRequestCodec.of(
            this._auth,
            config
        )

        const abortController = this._newAbortController()

        this._workPipe.attach(async () => {
            const request: RequestInit & { url: string } = {
                url: this._getTransactionCommitApi(),
                method: 'POST',
                mode: 'cors',
                headers: this._headers(requestCodec),
                signal: abortController.signal,
                body: JSON.stringify(requestCodec.body)
            }
    
            this._log?.debug(`${this} REQUEST: ${JSON.stringify(request)} `)

            const res = await fetch(request.url, request)
            const {
                body: rawCommitTransactionResponse,
                headers: [contentType]
            } = await readBodyAndReaders<RawCommitTransactionResponse>(request.url, res, 'contentType')

            this._log?.debug(`${this} RESPONSE: { body: ${JSON.stringify(rawCommitTransactionResponse)}, headers: { content-type: ${contentType} }}`);
            
            const codec = CommitTransactionResponseCodec.of(this._config, contentType ?? '', rawCommitTransactionResponse);

            if (codec.error) {
                throw codec.error
            }

            this._currentTx = undefined

            observer.onCompleted(codec.meta)
        })
            .catch(this._catch(observer))
            .finally(this._finally(abortController))

        return observer
    }

    rollbackTransaction(config: CommitTransactionConfig): internal.observer.ResultStreamObserver {
        const observer = new ResultStreamObserver({
            server: this._address,
            afterComplete: config?.afterComplete,
            beforeError: config.beforeError,
            highRecordWatermark: Number.MAX_SAFE_INTEGER,
            lowRecordWatermark: Number.MIN_SAFE_INTEGER,
          })
        observer.prepareToHandleSingleResponse()


        const requestCodec = RollbackTransactionRequestCodec.of(
            this._auth,
            config
        )

        const abortController = this._newAbortController()

        this._workPipe.attach(async () => {
            const request: RequestInit & { url: string } = {
                url: this._getTransactionApi(this._currentTx?.database!),
                method: 'DELETE',
                mode: 'cors',
                headers: this._headers(requestCodec),
                signal: abortController.signal,
                body: JSON.stringify(requestCodec.body)
            }
    
            this._log?.debug(`${this} REQUEST: ${JSON.stringify(request)} `)

            const res = await fetch(request.url, request)
            const {
                body: rawRollbackTransactionResponse,
                headers: [
                    contentType
                ]
            } = await readBodyAndReaders<RawRollbackTransactionResponse>(request.url, res, 'content-type')

            this._log?.debug(`${this} RESPONSE: { body: ${JSON.stringify(rawRollbackTransactionResponse)}, headers: { content-type: ${contentType} }}`);
            
            const codec = RollbackTransactionResponseCodec.of(this._config, contentType ?? '', rawRollbackTransactionResponse);

            if (codec.error) {
                throw codec.error
            }

            this._currentTx = undefined

            observer.onCompleted(codec.meta)
        })
            .catch(this._catch(observer))
            .finally(this._finally(abortController))

        return observer
    }

    private _getTransactionApi(database: string): string {
        if (this._currentTx === undefined) {
            return this._queryEndpoint.replace('{databaseName}', database)
        }
        return this._queryEndpoint.replace('{databaseName}',  this._currentTx.database) + `/tx/${this._currentTx.id}`
    }

    private _getTransactionCommitApi(): string {
        return this._queryEndpoint.replace('{databaseName}', this._currentTx?.database!) + `/tx/${this._currentTx?.id}/commit`
    }

    private _getExplicityTransactionApi(database: string): string {
        return this._queryEndpoint.replace('{databaseName}', database) + '/tx'
    }

    static async discover({ scheme, address, path }: { scheme: HttpScheme, address: internal.serverAddress.ServerAddress, path?: string }): Promise<{
        query: string
        version: string
        edition: string
    }> {
        return await fetch(`${scheme}://${address.asHostPort()}${path ?? ''}`, {
            headers: {
                Accept: 'application/json',
            }
        })
            .then(async (res) => (await res.json()) as Record<string, string>)
            .then(json => {
                if (typeof json.query !== 'string') {
                    throw new Error('Query API is not available')
                }
                const query = json.query.endsWith('/') ? json.query.substring(0, json.query.length - 1) : json.query
                return { query, version: json.neo4j_version, edition: json.neo4j_edition }
            })
            .catch(e => {
                throw newError(`Failure discovering endpoints. Caused by: ${e.message}`, 'SERVICE_UNAVAILABLE', e)
            })
    }

    get id (): number {
        return this._id
    }

    set auth(auth: types.AuthToken) {
        this._auth = auth
    }

    get auth(): types.AuthToken {
        return this._auth
    }

    set queryEndpoint(queryEndpoint: string) {
        this._queryEndpoint = queryEndpoint
    }

    get queryEndpoint(): string {
        return this._queryEndpoint
    }

    getProtocolVersion(): ProtocolVersion {
        return new ProtocolVersion(0, 0)
    }

    isOpen(): boolean {
        return this._open
    }

    hasOngoingObservableRequests(): boolean {
        return this._abortControllers.length > 0
    }

    async resetAndFlush(): Promise<void> {
        this._abortControllers.forEach((controller) => controller.abort(newError('User aborted operation.')))
        this._abortControllers = []
        this._currentTx = undefined
        this._workPipe.recover()
    }

    release(): Promise<void> {
        this._workPipe.recover()
        return this._release()
    }

    async close(): Promise<void> {
        this._abortControllers.forEach((controller) => controller.abort(newError('Aborted since connection is being closed.')))
        this._abortControllers = []
        this._open = false
    }

    toString() {
        return `HttpConnection [${this._id}]`
    }

    private _catch(observer: ResultStreamObserver): (error: any) => void {
        return error => {
            this._currentTx = undefined
            const newError = this._errorHandler(error)
            observer.onError(newError)
        }
    }

    private _finally(abortController: AbortController): (() => void) | null | undefined {
        this._abortControllers = this._abortControllers.filter(ac => ac !== abortController)
        return undefined
    }

    private _newAbortController (): AbortController {
        const abortController = new AbortController()
        this._abortControllers.push(abortController)
        return abortController
    }
}

async function readBodyAndReaders<T extends Record<string, unknown>> (url: string, response: Response, ...headers: string[]): Promise<{ body: T, headers: (string | null)[]}> {
    try {
        const text = await response.text()
        
        return {
            body: text !== '' ? JSON.parse(text) : {},
            headers: headers.map(header => response.headers.get(header))
        }        
    } catch (error) {
        throw newError(`Failure accessing "${url}"`, 'SERVICE_UNAVAILABLE', error)
    }
}