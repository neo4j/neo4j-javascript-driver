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

import { newError, Node, Relationship, int, error, types, Integer, Time, Date, LocalTime, Point } from "neo4j-driver-core"

type RawNewFormatValueTypes = 'Null' | 'Boolean' | 'Integer' | 'Float' | 'String' |
    'Time' | 'Date' | 'LocalTime' | 'ZonedDateTime' | 'OffsetDateTime' | 'LocalDateTime' |
    'Duration' | 'Point' | 'Base64' | 'Map' | 'List'

type PointShape = { srid: number, x: string, y: string, z?: string }

type RawNewFormatValueDef<T extends RawNewFormatValueTypes, V extends unknown> = { $type: T, _value: V }

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
type RawNewFormatPoint = RawNewFormatValueDef<'Point', PointShape>
type RawNewFormatBinary = RawNewFormatValueDef<'Base64', string>
interface RawNewFormatMap extends RawNewFormatValueDef<'Map', Record<string, RawNewFormatValue>> { }
interface RawNewFormatList extends RawNewFormatValueDef<'List', RawNewFormatValue[]> { }


type RawNewFormatValue = RawNewFormatNull | RawNewFormatBoolean | RawNewFormatInteger | RawNewFormatFloat |
    RawNewFormatString | RawNewFormatTime | RawNewFormatDate | RawNewFormatLocalTime | RawNewFormatZonedDateTime |
    RawNewFormatOffsetDateTime | RawNewFormatLocalDateTime | RawNewFormatDuration | RawNewFormatPoint |
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
        switch (value.$type) {
            case "Null":
                return value._value
            case "Boolean":
                return value._value
            case "Integer":
                return this._decodeInteger(value._value as string)
            case "Float":
                return this._decodeFloat(value._value as string)
            case "String":
                return value._value
            case "Time":
                return this._decodeTime(value._value as string)
            case "Date":
                return this._decodeDate(value._value as string)
            case "LocalTime":
                return this._decodeLocalTime(value._value as string)
            case "ZonedDateTime":
            case "OffsetDateTime":
            case "LocalDateTime":
            case "Duration":
            case "Point":
            case "Base64":
            case "Map":
                return this._decodeMap(value._value as Record<string, RawNewFormatValue>)
            case "List":
                return this._decodeList(value._value as RawNewFormatValue[])
            default:
                // @ts-expect-error It should never happen
                throw newError(`Unknown type: ${value.$type}`, error.PROTOCOL_ERROR)
        }
    }

    _decodeInteger(value: string): Integer | number | bigint {
        if (this._config.useBigInt === true) {
            return BigInt(value)
        } else {
            const integer = int(value)
            if (this._config.disableLosslessIntegers === true) {
                return integer.toNumber()
            }
            return integer
        }
    }

    _decodeFloat(value: string): number {
        return parseFloat(value)
    }

    _decodeTime(value: string): Time<Integer | bigint | number> {
        // 12:50:35.556+01:00
        const [hourStr, minuteString, secondMillisecondAndOffsetString, offsetMinuteString] = value.split(':')
        const [secondStr, millisecondAndOffsetString] = secondMillisecondAndOffsetString.split('.')
        // @ts-expect-error
        const [millisecondString, offsetHourString, isPositive]: [string, string, boolean] = millisecondAndOffsetString.indexOf('+') ?
            [...millisecondAndOffsetString.split('+'), true] : [...millisecondAndOffsetString.split('-'), false]


        let nanosecond = int(millisecondString).multiply(1000000)

        const timeZoneOffsetInSeconds = int(offsetHourString).multiply(60).add(int(offsetMinuteString)).multiply(60).multiply(isPositive ? 1 : -1)
        return new Time(
            this._decodeInteger(hourStr),
            this._decodeInteger(minuteString),
            this._decodeInteger(secondStr),
            this._normalizeInteger(nanosecond),
            this._normalizeInteger(timeZoneOffsetInSeconds))
    }

    _decodeDate(value: string): Date<Integer | bigint | number> {
        // 2015-03-26
        const [yearStr, monthStr, dayStr] = value.split(value)
        return new Date(
            this._decodeInteger(yearStr),
            this._decodeInteger(monthStr),
            this._decodeInteger(dayStr)
        )
    }

    _decodeLocalTime(value: string): LocalTime<Integer | bigint | number> {
        // 12:50:35.556
        const [hourStr, minuteString, secondMillisecondAndOffsetString] = value.split(':')
        const [secondStr, millisecondString] = secondMillisecondAndOffsetString.split('.')
        const nanosecond = int(millisecondString).multiply(1000000)

        return new LocalTime(
            this._decodeInteger(hourStr),
            this._decodeInteger(minuteString),
            this._decodeInteger(secondStr),
            this._normalizeInteger(nanosecond))
    }

    _decodeMap(value: Record<string, RawNewFormatValue>): Record<string, unknown> {
        const result: Record<string, unknown> = {}
        for (const k in value) {
            if (Object.hasOwnProperty.apply(value, k)) {
                result[k] = this._decodeValue(value[k])
            }
        }
        return result
    }

    _decodePoint(value: PointShape): Point<Integer | bigint | number> {
        return new Point(
            this._normalizeInteger(int(value.srid)),
            this._decodeFloat(value.x),
            this._decodeFloat(value.y),
            value.z != null ? this._decodeFloat(value.z) : undefined
        )
    }

    _decodeList(value: RawNewFormatValue[]): unknown[] {
        return value.map(v => this._decodeValue(v))
    }

    _normalizeInteger(integer: Integer): Integer | number | bigint {
        if (this._config.useBigInt === true) {
            return integer.toBigInt()
        } else if (this._config.disableLosslessIntegers === true) {
            return integer.toNumber()
        }
        return integer
    }
}
