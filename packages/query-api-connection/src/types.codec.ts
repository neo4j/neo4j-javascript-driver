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

import { Date, DateTime, Duration, Integer, LocalDateTime, LocalTime, Node, Path, PathSegment, Point, Relationship, Time, error, int, internal, isDateTime, isTime, newError, types } from "neo4j-driver-core"
import { NEO4J_QUERY_CONTENT_TYPE, NEO4J_QUERY_CONTENT_TYPE_V1_0, NEO4J_QUERY_CONTENT_TYPE_V1_0_JSONL } from "./codec"


export type RawQueryValueTypes = 'Null' | 'Boolean' | 'Integer' | 'Float' | 'String' |
    'Time' | 'Date' | 'LocalTime' | 'ZonedDateTime' | 'OffsetDateTime' | 'LocalDateTime' |
    'Duration' | 'Point' | 'Base64' | 'Map' | 'List' | 'Node' | 'Relationship' |
    'Path'

export type NodeShape = { _element_id: string, _labels: string[], _properties?: Record<string, RawQueryValue> }
export type RelationshipShape = { _element_id: string, _start_node_element_id: string, _end_node_element_id: string, _type: string, _properties?: Record<string, RawQueryValue> }
export type PathShape = (RawQueryRelationship | RawQueryNode)[]
export type RawQueryValueDef<T extends RawQueryValueTypes, V extends unknown> = { $type: T, _value: V }

export type RawQueryNull = RawQueryValueDef<'Null', null>
export type RawQueryBoolean = RawQueryValueDef<'Boolean', boolean>
export type RawQueryInteger = RawQueryValueDef<'Integer', string>
export type RawQueryFloat = RawQueryValueDef<'Float', string>
export type RawQueryString = RawQueryValueDef<'String', string>
export type RawQueryTime = RawQueryValueDef<'Time', string>
export type RawQueryDate = RawQueryValueDef<'Date', string>
export type RawQueryLocalTime = RawQueryValueDef<'LocalTime', string>
export type RawQueryZonedDateTime = RawQueryValueDef<'ZonedDateTime', string>
export type RawQueryOffsetDateTime = RawQueryValueDef<'OffsetDateTime', string>
export type RawQueryLocalDateTime = RawQueryValueDef<'LocalDateTime', string>
export type RawQueryDuration = RawQueryValueDef<'Duration', string>
export type RawQueryPoint = RawQueryValueDef<'Point', string>
export type RawQueryBinary = RawQueryValueDef<'Base64', string>
export interface RawQueryMap extends RawQueryValueDef<'Map', Record<string, RawQueryValue>> { }
export interface RawQueryList extends RawQueryValueDef<'List', RawQueryValue[]> { }

export type RawQueryNode = RawQueryValueDef<'Node', NodeShape>
export type RawQueryRelationship = RawQueryValueDef<'Relationship', RelationshipShape>
export type RawQueryPath = RawQueryValueDef<'Path', PathShape>


export type RawQueryValue = RawQueryNull | RawQueryBoolean | RawQueryInteger | RawQueryFloat |
    RawQueryString | RawQueryTime | RawQueryDate | RawQueryLocalTime | RawQueryZonedDateTime |
    RawQueryOffsetDateTime | RawQueryLocalDateTime | RawQueryDuration | RawQueryPoint |
    RawQueryBinary | RawQueryMap | RawQueryList | RawQueryNode | RawQueryRelationship |
    RawQueryPath

export type RawQueryError = {
    code: string,
    message: string
    error?: string
}

export type Counters = {
    containsUpdates: boolean
    nodesCreated: number
    nodesDeleted: number
    propertiesSet: number
    relationshipsCreated: number
    relationshipsDeleted: number
    labelsAdded: number
    labelsRemoved: number
    indexesAdded: number
    indexesRemoved: number
    constraintsAdded: number
    constraintsRemoved: number
    containsSystemUpdates: boolean
    systemUpdates: number
}

export type ProfiledQueryPlan = {
    dbHits: number
    records: number
    hasPageCacheStats: boolean
    pageCacheHits: number
    pageCacheMisses: number
    pageCacheHitRatio: number
    time: number
    operatorType: string
    arguments: Record<string, RawQueryValue>
    identifiers: string[]
    children: ProfiledQueryPlan[]
}
    
export type NotificationShape = {
    code: string
    title: string
    description: string
    position: {
        offset: number
        line: number
        column: number
    } | {}
    severity: string
    category: string
}

export default class TypedJsonCodec {
    static of(contentType: string, config: types.InternalConfig): TypedJsonCodec {
        if (contentType === NEO4J_QUERY_CONTENT_TYPE_V1_0_JSONL ||
            contentType === NEO4J_QUERY_CONTENT_TYPE_V1_0 ||
            contentType === NEO4J_QUERY_CONTENT_TYPE) {
                return new TypedJsonCodecV10(config)
        }

        throw newError(`Unsupported content type: ${contentType}`)
    }

    decodeStats(counters: Counters): Record<string, unknown> {
        throw Error('Not implemented')
    }

    decodeProfile(queryPlan: ProfiledQueryPlan): Record<string, unknown> {
        throw Error('Not implemented')
    }


    decodeValue(value: RawQueryValue): unknown {
        throw Error('Not implemented')
    }
}

class TypedJsonCodecV10 extends TypedJsonCodec {

    constructor(private readonly _config: types.InternalConfig) {
        super()
    }

    decodeStats(counters: Counters): Record<string, unknown> {
        return Object.fromEntries(
            Object.entries(counters)
                .map(([key, value]) => [key, typeof value === 'number' ? this._normalizeInteger(int(value)) : value])
        )
    }

    decodeProfile(queryPlan: ProfiledQueryPlan): Record<string, unknown> {
        return Object.fromEntries(
            Object.entries(queryPlan)
                .map(([key, value]) => {
                    let actualKey: string = key
                    let actualValue: unknown = value
                    switch (key) {
                        case 'children':
                            actualValue = (value as ProfiledQueryPlan[]).map(this.decodeProfile.bind(this))
                            break
                        case 'arguments':
                            actualKey = 'args'
                            actualValue = Object.fromEntries(Object.entries(value as {})
                                .map(([k, v]) => [k, this.decodeValue(v as RawQueryValue)]))
                            break
                        case 'records':
                            actualKey = 'rows'
                            break
                        default:
                            break
                    }
                    return [actualKey, actualValue]
                })
        )
    }


    decodeValue(value: RawQueryValue): unknown {
        switch (value.$type) {
            case "Null":
                return null
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
                return this._decodeZonedDateTime(value._value as string)
            case "OffsetDateTime":
                return this._decodeOffsetDateTime(value._value as string)
            case "LocalDateTime":
                return this._decodeLocalDateTime(value._value as string)
            case "Duration":
                return this._decodeDuration(value._value as string)
            case "Point":
                return this._decodePoint(value._value as string)
            case "Base64":
                return this._decodeBase64(value._value as string)
            case "Map":
                return this._decodeMap(value._value as Record<string, RawQueryValue>)
            case "List":
                return this._decodeList(value._value as RawQueryValue[])
            case "Node":
                return this._decodeNode(value._value as NodeShape)
            case "Relationship":
                return this._decodeRelationship(value._value as RelationshipShape)
            case "Path":
                return this._decodePath(value._value as PathShape)
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

    _decodeTime(value: string): Time<Integer | bigint | number> | LocalTime<Integer | bigint | number> {
        // 12:50:35.556+01:00
        // 12:50:35+01:00
        // 12:50:35Z
        const [hourStr, minuteString, secondNanosecondAndOffsetString, offsetMinuteString] = value.split(':')
        let [secondStr, nanosecondAndOffsetString] = secondNanosecondAndOffsetString.split('.')
        let [nanosecondString, offsetHourString, isPositive, hasOffset]: [string, string, boolean, boolean] = ['0', '0', true, true]

        if (nanosecondAndOffsetString !== undefined) {
            if ( nanosecondAndOffsetString.indexOf('+') >= 0 ) {
                [nanosecondString, offsetHourString] = [...nanosecondAndOffsetString.split('+')]
            } else if (nanosecondAndOffsetString.indexOf('-') >= 0) {
                [nanosecondString, offsetHourString] = [...nanosecondAndOffsetString.split('-')]
                isPositive = false
            } else if (nanosecondAndOffsetString.indexOf('Z') >= 0) {
                [nanosecondString] = [...nanosecondAndOffsetString.split('Z')]
            } else {
                hasOffset = false
                if (nanosecondAndOffsetString.indexOf('[')) {
                    [nanosecondString] = [...nanosecondAndOffsetString.split('[')]
                }
            }
        } else  {
            if ( secondStr.indexOf('+') >= 0 ) {
                [secondStr, offsetHourString] = [...secondStr.split('+')]
            } else if ( secondStr.indexOf('-') >= 0 ) {
                [secondStr, offsetHourString] = [...secondStr.split('-')]
                isPositive = false
            } else if (secondStr.indexOf('Z') < 0) {
                hasOffset = false
            }
        }

        secondStr = secondStr.substring(0, 2)

        const nanosecond = nanosecondString === undefined ? int(0) : int((nanosecondString).padEnd(9, '0'))

        if (hasOffset) {
            const timeZoneOffsetInSeconds = int(offsetHourString).multiply(60).add(int(offsetMinuteString ?? '0')).multiply(60).multiply(isPositive ? 1 : -1)

            return new Time(
                this._decodeInteger(hourStr),
                this._decodeInteger(minuteString),
                this._decodeInteger(secondStr),
                this._normalizeInteger(nanosecond),
                this._normalizeInteger(timeZoneOffsetInSeconds))
        }

        return new LocalTime(
            this._decodeInteger(hourStr),
            this._decodeInteger(minuteString),
            this._decodeInteger(secondStr),
            this._normalizeInteger(nanosecond),
        )
    }

    _decodeDate(value: string): Date<Integer | bigint | number> {
        // (+|-)2015-03-26
        // first might be signal or first digit on date
        const first = value[0]
        const [yearStr, monthStr, dayStr] = value.substring(1).split('-')
        return new Date(
            this._decodeInteger(first.concat(yearStr)),
            this._decodeInteger(monthStr),
            this._decodeInteger(dayStr)
        )
    }

    _decodeLocalTime(value: string): LocalTime<Integer | bigint | number> {
        // 12:50:35.556
        const [hourStr, minuteString, secondNanosecondAndOffsetString] = value.split(':')
        const [secondStr, nanosecondString] = secondNanosecondAndOffsetString.split('.')
        const nanosecond = nanosecondString === undefined ? int(0) : int((nanosecondString).padEnd(9, '0'))

        return new LocalTime(
            this._decodeInteger(hourStr),
            this._decodeInteger(minuteString),
            this._decodeInteger(secondStr),
            this._normalizeInteger(nanosecond)
        )
    }

    _decodeZonedDateTime(value: string): DateTime<Integer | bigint | number> {
        // 2015-11-21T21:40:32.142Z[Antarctica/Troll]
        const [dateTimeStr, timeZoneIdEndWithAngleBrackets] = value.split('[')
        const timeZoneId = timeZoneIdEndWithAngleBrackets.slice(0, timeZoneIdEndWithAngleBrackets.length - 1)
        const dateTime = this._decodeOffsetDateTime(dateTimeStr)

        return new DateTime(
            dateTime.year,
            dateTime.month,
            dateTime.day,
            dateTime.hour,
            dateTime.minute,
            dateTime.second,
            dateTime.nanosecond,
            isDateTime(dateTime) ? dateTime.timeZoneOffsetSeconds : undefined,
            timeZoneId
        )
    }

    _decodeOffsetDateTime(value: string): DateTime<Integer | bigint | number> | LocalDateTime<Integer | bigint | number>{
        // 2015-06-24T12:50:35.556+01:00
        const [dateStr, timeStr] = value.split('T')
        const date = this._decodeDate(dateStr)
        const time = this._decodeTime(timeStr)
        if (isTime(time)) {
            return new DateTime(
                date.year,
                date.month,
                date.day,
                time.hour,
                time.minute,
                time.second,
                time.nanosecond,
                time.timeZoneOffsetSeconds 
            )
        }

        return new LocalDateTime(
            date.year,
            date.month,
            date.day,
            time.hour,
            time.minute,
            time.second,
            time.nanosecond
        )
    }

    _decodeLocalDateTime(value: string): LocalDateTime<Integer | bigint | number> {
        // 2015-06-24T12:50:35.556
        const [dateStr, timeStr] = value.split('T')
        const date = this._decodeDate(dateStr)
        const time = this._decodeLocalTime(timeStr)
        return new LocalDateTime(
            date.year,
            date.month,
            date.day,
            time.hour,
            time.minute,
            time.second,
            time.nanosecond
        )
    }

    _decodeDuration(value: string): Duration<Integer | bigint | number> {
        // P14DT16H12M
        const durationStringWithP = value.slice(1, value.length)

        let month = '0'
        let week = '0'
        let day = '0'
        let second = '0'
        let nanosecond = '0'
        let hour = '0'
        let minute = '0'
        let currentNumber = ''
        let timePart = false

        for (const ch of durationStringWithP) {
            if (ch >= '0' && ch <= '9' || ch === '.' || ch === ',' || (currentNumber.length === 0 && ch === '-')) {
                currentNumber = currentNumber + ch
            } else {
                switch (ch) {
                    case 'M':
                        // minutes
                        if (timePart) {
                            minute = currentNumber
                        // months
                        } else {
                            month = currentNumber
                        }
                        break;
                    case 'W':
                        if (timePart) {
                            throw newError(`Duration is not well formatted. Unexpected Duration component ${ch} in time part`, error.PROTOCOL_ERROR)
                        }
                        week = currentNumber;
                        break
                    case 'D':
                        if (timePart) {
                            throw newError(`Duration is not well formatted. Unexpected Duration component ${ch} in time part`, error.PROTOCOL_ERROR)
                        }
                        day = currentNumber
                        break
                    case 'S':
                        if (!timePart) {
                            throw newError(`Duration is not well formatted. Unexpected Duration component ${ch} in date part`, error.PROTOCOL_ERROR)
                        }
                        const nanosecondSeparator = currentNumber.includes(',') ? ',' : '.';
                        [second, nanosecond] = currentNumber.split(nanosecondSeparator)
                        break
                    case 'H':
                        if (!timePart) {
                            throw newError(`Duration is not well formatted. Unexpected Duration component ${ch} in date part`, error.PROTOCOL_ERROR)
                        }
                        hour = currentNumber
                        break
                    case 'T':
                        timePart = true
                        break
                    default:
                        throw newError(`Duration is not well formatted. Unexpected Duration component ${ch}`, error.PROTOCOL_ERROR)
                }
                currentNumber = ''
            }
        }

        const secondsInt = int(hour)
            .multiply(60)
            .add(minute)
            .multiply(60)
            .add(second)

        const dayInt = int(week)
            .multiply(7)
            .add(day)

        const nanosecondString = nanosecond ?? '0'
        return new Duration(
            this._decodeInteger(month),
            this._normalizeInteger(dayInt),
            this._normalizeInteger(secondsInt),
            this._decodeInteger(nanosecondString.padEnd(9, '0'))
        )
    }

    _decodeMap(value: Record<string, RawQueryValue>): Record<string, unknown> {
        const result: Record<string, unknown> = {}
        for (const k of Object.keys(value)) {
            if (Object.prototype.hasOwnProperty.call(value, k)) {
                result[k] = this.decodeValue(value[k])
            }
        }
        return result
    }

    _decodePoint(value: string): Point<Integer | bigint | number> {
        const createProtocolError = (): Point => internal.objectUtil.createBrokenObject(newError(
            `Wrong point format. RawValue: ${value}`,
            error.PROTOCOL_ERROR
        ), new Point<Integer | bigint | number>(0, 0, 0))


        const splittedOnSeparator = value.split(';')
        if (splittedOnSeparator.length !== 2 || !splittedOnSeparator[0].startsWith('SRID=') ||
            !(splittedOnSeparator[1].startsWith('POINT (') || splittedOnSeparator[1].startsWith('POINT Z ('))) {
            return createProtocolError()
        }

        const [_, sridString] = splittedOnSeparator[0].split('=')
        const srid = this._normalizeInteger(int(sridString))

        const [__, coordinatesString] = splittedOnSeparator[1].split('(')
        const [x, y, z] = coordinatesString.substring(0, coordinatesString.length - 1).split(" ").filter(c => c != null).map(parseFloat)

        return new Point(
            srid,
            x,
            y,
            z
        )
    }

    _decodeBase64(value: string): Uint8Array {
        const binaryString: string = atob(value)
        // @ts-expect-error See https://developer.mozilla.org/en-US/docs/Glossary/Base64
        return Uint8Array.from(binaryString, (b) => b.codePointAt(0))
    }

    _decodeList(value: RawQueryValue[]): unknown[] {
        return value.map(v => this.decodeValue(v))
    }

    _decodeNode(value: NodeShape): Node<bigint | number | Integer> {
        return new Node(
            // @ts-expect-error identity doesn't return
            undefined,
            value._labels,
            this._decodeMap(value._properties ?? {}),
            value._element_id
        )
    }

    _decodeRelationship(value: RelationshipShape): Relationship<bigint | number | Integer> {
        return new Relationship(
            // @ts-expect-error identity doesn't return
            undefined,
            undefined,
            undefined,
            value._type,
            this._decodeMap(value._properties ?? {}),
            value._element_id,
            value._start_node_element_id,
            value._end_node_element_id
        )
    }

    _decodePath(value: PathShape): Path<bigint | number | Integer> {
        const decoded = value.map(v => this.decodeValue(v))
        type SegmentAccumulator = [] | [Node] | [Node, Relationship]
        type Accumulator = { acc: SegmentAccumulator, segments: PathSegment[] }

        return new Path(
            decoded[0] as Node,
            decoded[decoded.length - 1] as Node,
            // @ts-expect-error
            decoded.reduce((previous: Accumulator, current: Node | Relationship): Accumulator => {
                if (previous.acc.length === 2) {
                    return {
                        acc: [current as Node], segments: [...previous.segments,
                        new PathSegment(previous.acc[0], previous.acc[1], current as Node)]
                    }
                }
                return { ...previous, acc: [...previous.acc, current] as SegmentAccumulator }
            }, { acc: [], segments: [] }).segments
        )
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
