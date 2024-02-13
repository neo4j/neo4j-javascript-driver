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

import { Connection, types, internal } from "neo4j-driver-core"
import { RunQueryConfig } from "neo4j-driver-core/types/connection"
import { ResultStreamObserver } from "./stream-observers"
import { JoltProcessor, RawJoltResponse } from "./jolt"

type HttpScheme = 'http' | 'https'

export interface HttpConnectionConfig {
    release: () => Promise<void>
    auth: types.AuthToken
    scheme: HttpScheme
    address: internal.serverAddress.ServerAddress
    database: string
}


export default class HttpConnection extends Connection {
    private _release: () => Promise<void>
    private _auth: types.AuthToken
    private _scheme: HttpScheme
    private _address: internal.serverAddress.ServerAddress
    private _database: string

    constructor(config: HttpConnectionConfig) {
        super()
        this._release = config.release
        this._auth = config.auth
        this._scheme = config.scheme
        this._address = config.address
        this._database = config.database
    }

    run(query: string, parameters?: Record<string, unknown> | undefined, config?: RunQueryConfig | undefined): internal.observer.ResultStreamObserver {
        const observer = new ResultStreamObserver({
            highRecordWatermark: config?.highRecordWatermark ?? Number.MAX_SAFE_INTEGER,
            lowRecordWatermark: config?.lowRecordWatermark ?? Number.MIN_SAFE_INTEGER,
            afterComplete: config?.afterComplete,
            server: this._address
        })
        
        fetch(this._getTransactionApi(), {
            method: 'POST',
            mode: 'cors',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                Authorization: `Basic ${btoa(`${this._auth.principal}:${this._auth.credentials}`)}`,
            },
            body: JSON.stringify({
                statements: [
                    {
                        statement: query,
                        includeStats: true,
                        parameters: parameters,
                        resultDataContents: ['row', 'graph'],
                    },
                ],
            }),
        }).then(async (res) => (await res.json()) as RawJoltResponse)
            .catch((error) => observer.onError(error))
            .then(async (rawJoltResponse) => {
                console.log(JSON.stringify(rawJoltResponse, undefined, 4))
                if (rawJoltResponse == null) {
                    // is already dead
                    return
                }
                const batchSize = config?.fetchSize ?? Number.MAX_SAFE_INTEGER
                const processor = new JoltProcessor(rawJoltResponse);
                observer.onKeys(processor.keys)
                const stream = processor.stream()

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
                            console.log('completed')
                            observer.onCompleted(processor.meta)
                        }
                    }
                }
            })
            .catch(error => observer.onError(error))

        return observer
    }

    private _getTransactionApi():string {
        const address = `${this._scheme}://${this._address.asHostPort()}/db/${this._database}/tx/commit`
        console.log('calling', address)
        return address
    }

    getProtocolVersion(): number {
        return 0
    }

    isOpen(): boolean {
        return true
    }

    hasOngoingObservableRequests(): boolean {
        return false // TODO: VERIFY
    }

    release(): Promise<void> {
        return this._release()
    }
}