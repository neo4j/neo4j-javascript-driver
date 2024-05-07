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

import { Connection, types, internal, newError } from "neo4j-driver-core"
import { RunQueryConfig } from "neo4j-driver-core/types/connection"
import { ResultStreamObserver } from "./stream-observers"
import { QueryRequestCodec, QueryResponseCodec, RawQueryResponse } from "./query.codec"

type HttpScheme = 'http' | 'https'

export interface HttpConnectionConfig {
    release: () => Promise<void>
    auth: types.AuthToken
    scheme: HttpScheme
    address: internal.serverAddress.ServerAddress
    database: string
    config: types.InternalConfig
}


export default class HttpConnection extends Connection {
    private _release: () => Promise<void>
    private _auth: types.AuthToken
    private _scheme: HttpScheme
    private _address: internal.serverAddress.ServerAddress
    private _database: string
    private _config: types.InternalConfig
    private _abortController?: AbortController

    constructor(config: HttpConnectionConfig) {
        super()
        this._release = config.release
        this._auth = config.auth
        this._scheme = config.scheme
        this._address = config.address
        this._database = config.database
        this._config = config.config
    }

    run(query: string, parameters?: Record<string, unknown> | undefined, config?: RunQueryConfig | undefined): internal.observer.ResultStreamObserver {
        const observer = new ResultStreamObserver({
            highRecordWatermark: config?.highRecordWatermark ?? Number.MAX_SAFE_INTEGER,
            lowRecordWatermark: config?.lowRecordWatermark ?? Number.MIN_SAFE_INTEGER,
            afterComplete: config?.afterComplete,
            server: this._address
        })

        const requestCodec = new QueryRequestCodec(
            this._auth,
            query,
            parameters, 
            config
        )

        this._abortController =  new AbortController()

        fetch(this._getTransactionApi(), {
            method: 'POST',
            mode: 'cors',
            headers: {
                'Content-Type': requestCodec.contentType,
                Accept: requestCodec.accept,
                Authorization: requestCodec.authorization,
            },
            signal: this._abortController.signal,
            body: JSON.stringify(requestCodec.body)
        }).
            then(async (res) => {
                return [res.headers.get('content-type'), (await res.json()) as RawQueryResponse]
            })
            .catch((error) => observer.onError(error))
            .then(async ([contentType, rawQueryResponse]: [string, RawQueryResponse]) => {
                console.log(JSON.stringify(rawQueryResponse, undefined, 4))
                if (rawQueryResponse == null) {
                    // is already dead
                    return
                }
                const batchSize = config?.fetchSize ?? Number.MAX_SAFE_INTEGER
                const codec = new QueryResponseCodec(this._config, contentType, rawQueryResponse);

                if (codec.hasError) {
                    throw codec.error
                }
                observer.onKeys(codec.keys)
                const stream = codec.stream()

                while (!observer.completed) {
                    if (observer.paused) {
                        await new Promise((resolve) => setTimeout(resolve, 20))
                        continue
                    }

                    let iterate = true
                    for (let i = 0; iterate && !observer.paused && i < batchSize; i++) {
                        const { done, value: rawRecord } = stream.next()
                        if (!done) {
                            observer.onNext(rawRecord)
                        } else {
                            iterate = false
                            observer.onCompleted(codec.meta)
                        }
                    }
                }
            })
            .catch(error => observer.onError(error))
            .finally(() => {
                this._abortController = undefined
            })

        return observer
    }

    private _getTransactionApi():string {
        const address = `${this._scheme}://${this._address.asHostPort()}/db/${this._database === '' ? 'neo4j' : this._database}/query/v2`
        return address
    }

    getProtocolVersion(): number {
        return 0
    }

    isOpen(): boolean {
        return true
    }

    hasOngoingObservableRequests(): boolean {
        return this._abortController != null
    }

    async resetAndFlush(): Promise<void> {
        this._abortController?.abort(newError('User aborted operation.'))
    }

    release(): Promise<void> {
        return this._release()
    }
}