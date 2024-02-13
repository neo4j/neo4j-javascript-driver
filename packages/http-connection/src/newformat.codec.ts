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

import { newError, Node, Relationship, int, error, types } from "neo4j-driver-core"

type RawNewFormatValueDef<T extends string, V extends unknown > =  { $type: T, _value: V }

type RawNewFormatNull = RawNewFormatValueDef<'Null', null>
type RawNewFormatBoolean = RawNewFormatValueDef<'Boolean', boolean>
type RawNewFormatInteger = RawNewFormatValueDef<'Integer', string>
type RawNewFormatFloat = RawNewFormatValueDef<'Float', string>
type RawNewFormatString = RawNewFormatValueDef<'String', string>
type RawNewFormatTime = RawNewFormatValueDef<'Time', string>
type RawNewFormatDate = RawNewFormatValueDef<'Date', string>
type RawNewFormatLocalTime = RawNewFormatValueDef<'LocalTime', string>
type RawNewFormatZonedDateTime = RawNewFormatValueDef<'ZonedDateTime', string>
type RawNewFormatOffsetDateTime = RawNewFormatValueDef<'OffsetDateTime', string>
type RawNewFormatLocalDateTime = RawNewFormatValueDef<'LocalDateTime', string>
type RawNewFormatDuration = RawNewFormatValueDef<'Duration', string>
type RawNewFormatSpatial = RawNewFormatValueDef<'Spatial', { srid: number, x: string, y: string}>
type RawNewFormatBinary = RawNewFormatValueDef<'Base64', string>
type RawNewFormatMap = RawNewFormatValueDef<'Map', Record<string, object>>
type RawNewFormatList = RawNewFormatValueDef<'List', object[]>


type RawNewFormatValue = RawNewFormatNull | RawNewFormatBoolean | RawNewFormatInteger | RawNewFormatFloat | 
    RawNewFormatString | RawNewFormatTime |  RawNewFormatDate | RawNewFormatLocalTime | RawNewFormatZonedDateTime | 
    RawNewFormatOffsetDateTime |  RawNewFormatLocalDateTime | RawNewFormatDuration | RawNewFormatSpatial | 
    RawNewFormatBinary | RawNewFormatMap | RawNewFormatList 


type RawNewFormatData = {
    fields: string[]
    values: RawNewFormatValue[]
}

export type RawNewFormatResponse = {
    data: RawNewFormatData
    bookmarks: string[]
    errors?: []
    notifications?: unknown[]
    [str: string]: unknown
}

export class NewFormatResponseCodec {
    constructor(
        private _config: types.InternalConfig,
        private _rawNewFormatResponse: RawNewFormatResponse) {

    }

    get hasError(): boolean {
        if (this._rawNewFormatResponse.errors == null) {
            return false
        }
        return this._rawNewFormatResponse.errors.length !== 0
    }

    get error(): Error {
        return new Error(
            // @ts-expect-error
            this._rawNewFormatResponse.errors[0].message,
            // @ts-expect-error
            this._rawNewFormatResponse.errors[0].error
        )
    }

    get keys(): string[] {
        return this._rawNewFormatResponse.data.fields
    }

    *stream(): Generator<any[]> {
        let rawRecord: unknown[] = []
        for (const value of this._rawNewFormatResponse.data.values) {
            rawRecord.push(this._decodeValue(value))
            
            if (rawRecord.length === this.keys.length) {
                console.log('yielding', rawRecord)
                yield rawRecord
                // erasing raw records
                rawRecord = []
            }
        }
        console.log('returning')
        return
    }

    get meta(): Record<string, unknown> {
        // console.log('meta', this._rawNewFormatResponse.results[0].stats)
        // const meta: Record<string, unknown> = { ...this._rawNewFormatResponse.results[0].stats, bookmark: this._rawNewFormatResponse.lastBookmarks }
        // if (this._rawNewFormatResponse.notifications != null) {
        //     meta.notifications = this._rawNewFormatResponse.notifications
        // }
        return {}
    }

    private _decodeValue(value: RawNewFormatValue): unknown {
        if (value.$type === "Integer") {
            if (this._config.useBigInt === true) {
                return BigInt(value._value)
            } else {
                const integer = int(value._value) 
                if (this._config.disableLosslessIntegers === true) {
                    return integer.toNumber()
                }
                return integer
            }
        }
        return value._value
    }
}
