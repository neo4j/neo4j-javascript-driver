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

type RawJoltData = {
    row: unknown[]
    meta: unknown[]
    graph: unknown // object with nodes list and relationship list
}

type RawJoltResults = {
    columns: string[]
    data: RawJoltData[]
    stats: Record<string, unknown>
}

export type RawJoltResponse = {
    results: RawJoltResults[]
    lastBookmarks: string[]
    errors: []
    [str: string]: unknown
}

export class JoltProcessor {
    constructor(private _rawJoltResponse: RawJoltResponse) {

    }

    get keys(): string[] {
        return this._rawJoltResponse.results[0].columns
    }

    *stream (): Generator<any[]> {
        for (const data of this._rawJoltResponse.results[0].data) {
            console.log('yielding row',  data.row)
            yield  data.row
        }
        console.log('returning')
        return
    }  

    get meta(): Record<string, unknown> {
        console.log('meta', this._rawJoltResponse.results[0].stats)
        return { ...this._rawJoltResponse.results[0].stats, bookmark: this._rawJoltResponse.lastBookmarks }
    }
}