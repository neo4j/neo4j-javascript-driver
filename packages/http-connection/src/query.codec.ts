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

import { newError, Node, Relationship, int, error, types, Integer, Time, Date, LocalTime, Point, DateTime, LocalDateTime, Duration, isInt, isPoint, isDuration, isLocalTime, isTime, isDate, isLocalDateTime, isDateTime, isRelationship, isPath, isNode, isPathSegment, Path, PathSegment } from "neo4j-driver-core"
import { RunQueryConfig } from "neo4j-driver-core/types/connection"

type RawQueryValueTypes = 'Null' | 'Boolean' | 'Integer' | 'Float' | 'String' |
    'Time' | 'Date' | 'LocalTime' | 'ZonedDateTime' | 'OffsetDateTime' | 'LocalDateTime' |
    'Duration' | 'Point' | 'Base64' | 'Map' | 'List' | 'Node' | 'Relationship' |
    'Path'

type PointShape = { srid: number, x: string, y: string, z?: string }
type NodeShape = { _element_id: string, _labels: string[], _properties?:  Record<string, RawQueryValue>}
type RelationshipShape = { _element_id: string, _start_node_element_id: string, _end_node_element_id: string, _type: string,  _properties?:  Record<string, RawQueryValue>  }
type PathShape = (RawQueryRelationship | RawQueryNode)[]
type RawQueryValueDef<T extends RawQueryValueTypes, V extends unknown> = { $type: T, _value: V }

type RawQueryNull = RawQueryValueDef<'Null', null>
type RawQueryBoolean = RawQueryValueDef<'Boolean', boolean>
type RawQueryInteger = RawQueryValueDef<'Integer', string>
type RawQueryFloat = RawQueryValueDef<'Float', string>
type RawQueryString = RawQueryValueDef<'String', string>
type RawQueryTime = RawQueryValueDef<'Time', string>
type RawQueryDate = RawQueryValueDef<'Date', string>
type RawQueryLocalTime = RawQueryValueDef<'LocalTime', string>
type RawQueryZonedDateTime = RawQueryValueDef<'ZonedDateTime', string>
type RawQueryOffsetDateTime = RawQueryValueDef<'OffsetDateTime', string>
type RawQueryLocalDateTime = RawQueryValueDef<'LocalDateTime', string>
type RawQueryDuration = RawQueryValueDef<'Duration', string>
type RawQueryPoint = RawQueryValueDef<'Point', PointShape>
type RawQueryBinary = RawQueryValueDef<'Base64', string>
interface RawQueryMap extends RawQueryValueDef<'Map', Record<string, RawQueryValue>> { }
interface RawQueryList extends RawQueryValueDef<'List', RawQueryValue[]> { }
type RawQueryNode = RawQueryValueDef<'Node', NodeShape>
type RawQueryRelationship = RawQueryValueDef<'Relationship', RelationshipShape>
type RawQueryPath = RawQueryValueDef<'Path', PathShape>


type RawQueryValue = RawQueryNull | RawQueryBoolean | RawQueryInteger | RawQueryFloat |
    RawQueryString | RawQueryTime | RawQueryDate | RawQueryLocalTime | RawQueryZonedDateTime |
    RawQueryOffsetDateTime | RawQueryLocalDateTime | RawQueryDuration | RawQueryPoint |
    RawQueryBinary | RawQueryMap | RawQueryList | RawQueryNode | RawQueryRelationship |
    RawQueryPath

type Counters = {
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

type ProfiledQueryPlan = {
    dbHits: number
    records: number
    hasPageCacheStats: boolean
    pageCacheHits: number
    pageCacheMisses: number
    pageCacheHitRatio: number
    time: number
    operatorType: string
    arguments: Record<string, unknown>
    identifiers: string[]
    children: ProfiledQueryPlan[]
}


type RawQueryData = {
    fields: string[]
    values: RawQueryValue[]
}

export type RawQueryResponse = {
    data: RawQueryData
    counters: Counters
    bookmarks: string[]
    profiledQueryPlan?: ProfiledQueryPlan
    errors?: []
    notifications?: unknown[]
    [str: string]: unknown
}

export class QueryResponseCodec {
    constructor(
        private _config: types.InternalConfig,
        private _contentType: string,
        private _rawQueryResponse: RawQueryResponse) {

    }

    get hasError(): boolean {
        if (this._rawQueryResponse.errors == null) {
            return false
        }
        return this._rawQueryResponse.errors.length !== 0
    }

    get error(): Error {
        return newError(
            // @ts-expect-error
            this._rawQueryResponse.errors[0].message,
            // @ts-expect-error
            this._rawQueryResponse.errors[0].error
        )
    }

    get keys(): string[] {
        return this._rawQueryResponse.data.fields
    }

    *stream(): Generator<any[]> {
        let rawRecord: unknown[] = []
        for (const value of this._rawQueryResponse.data.values) {
            rawRecord.push(this._decodeValue(value))

            if (rawRecord.length === this.keys.length) {
                yield rawRecord
                // erasing raw records
                rawRecord = []
            }
        }
        return
    }

    get meta(): Record<string, unknown> {
        // console.log('meta', this._rawQueryResponse.results[0].stats)
        // const meta: Record<string, unknown> = { ...this._rawQueryResponse.results[0].stats, bookmark: this._rawQueryResponse.lastBookmarks }
        // if (this._rawQueryResponse.notifications != null) {
        //     meta.notifications = this._rawQueryResponse.notifications
        // }
        return {
            bookmark: this._rawQueryResponse.bookmarks,
            stats: this._decodeStats(this._rawQueryResponse.counters),
            profile: this._rawQueryResponse.profiledQueryPlan != null ? 
                this._decodeProfile(this._rawQueryResponse.profiledQueryPlan): null
        }
    }

    private _decodeStats(counters: Counters): Record<string, unknown> {
        return Object.fromEntries(
                Object.entries(counters)
                    .map(([key, value]) => [key, typeof value === 'number' ? this._normalizeInteger(int(value)): value])
        )
    }

    private _decodeProfile(queryPlan: ProfiledQueryPlan): Record<string, unknown> {
        return Object.fromEntries(
                Object.entries(queryPlan)
                    .map(([key, value]) => {
                        let actualKey: string = key
                        let actualValue: unknown = value
                        switch(key) {
                            case 'children':
                                actualValue = (value as ProfiledQueryPlan[]).map(this._decodeProfile.bind(this))
                                break
                            case 'arguments':
                                actualKey = 'args'
                                break
                            case 'records':
                                actualKey = 'row'
                                break 
                            default:
                                break
                        }
                        return [actualKey, actualValue]
                    })
        )
    }


    private _decodeValue(value: RawQueryValue): unknown {
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
                return this._decodeZonedDateTime(value._value as string)
            case "OffsetDateTime":
                return this._decodeOffsetDateTime(value._value as string)
            case "LocalDateTime":
                return this._decodeLocalDateTime(value._value as string)
            case "Duration":
                return this._decodeDuration(value._value as string)
            case "Point":
                return this._decodePoint(value._value as PointShape)
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

    _decodeTime(value: string): Time<Integer | bigint | number> {
        // 12:50:35.556+01:00
        const [hourStr, minuteString, secondMillisecondAndOffsetString, offsetMinuteString] = value.split(':')
        const [secondStr, millisecondAndOffsetString] = secondMillisecondAndOffsetString.split('.')

        // @ts-expect-error
        const [millisecondString, offsetHourString, isPositive]: [string, string, boolean] = millisecondAndOffsetString.indexOf('+') >= 0 ?
            [...millisecondAndOffsetString.split('+'), true] : (
                millisecondAndOffsetString.indexOf('-') >= 0 ?  
                    [...millisecondAndOffsetString.split('-'), false] :
                    [millisecondAndOffsetString.slice(0, millisecondAndOffsetString.length - 1), '0', true]
            )


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

    _decodeZonedDateTime(value: string): DateTime<Integer | bigint | number> {
        // 2015-11-21T21:40:32.142Z[Antarctica/Troll]
        const [dateTimeStr, timeZoneIdEndWithAngleBrackets] = value.split('[')
        const timeZoneId = timeZoneIdEndWithAngleBrackets.slice(0, timeZoneIdEndWithAngleBrackets.length -1)
        const dateTime = this._decodeOffsetDateTime(dateTimeStr)
        
        return new DateTime(
            dateTime.year,
            dateTime.month,
            dateTime.day,
            dateTime.hour,
            dateTime.minute,
            dateTime.second,
            dateTime.nanosecond,
            dateTime.timeZoneOffsetSeconds,
            timeZoneId
        )
    }

    _decodeOffsetDateTime(value: string): DateTime<Integer | bigint | number> {
        // 2015-06-24T12:50:35.556+01:00
        const [dateStr, timeStr] = value.split('T')
        const date = this._decodeDate(dateStr)
        const time = this._decodeTime(timeStr)
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

    _decodeLocalDateTime(value: string): LocalDateTime<Integer | bigint | number > {
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

    _decodeDuration(value: string): Duration<Integer | bigint | number > {
        // P14DT16H12M
        // Duration is PnW

        const durationStringWithP = value.slice(1, value.length)
        
        if (durationStringWithP.endsWith('W')) {
            const weeksString = durationStringWithP.slice(0, durationStringWithP.length - 1)
            const weeks = this._decodeInteger(weeksString)
            throw newError('Duration in weeks are not supported yet', error.PROTOCOL_ERROR)
        }

        let month = '0'
        let day = 'O'
        let second = '0'
        let currentNumber = ''
        let timePart = false

        for (const ch of durationStringWithP) {
            if (ch >= '0' && ch <= '9') {
                currentNumber = currentNumber + ch
            } else {
                switch(ch) {
                    case 'M':
                        if (timePart) {
                            throw newError(`Unexpected Duration component ${ch} in date part`, error.PROTOCOL_ERROR)
                        }
                        month = currentNumber
                        break;
                    case 'D':
                        if (!timePart) {
                            throw newError(`Unexpected Duration component ${ch} in time part`, error.PROTOCOL_ERROR)
                        }
                        day = currentNumber
                        break
                    case 'S':
                        if (!timePart) {
                            throw newError(`Unexpected Duration component ${ch} in time part`, error.PROTOCOL_ERROR)
                        }
                        second = currentNumber
                    case 'T':
                        timePart = true
                    default:
                        throw newError(`Unexpected Duration component ${ch}`, error.PROTOCOL_ERROR)
                }
                currentNumber = ''
            }
        }

        return new Duration(
            this._decodeInteger(month),
            this._decodeInteger(day),
            this._decodeInteger(second),
            // nano not present
            this._decodeInteger('0')
        )
    }

    _decodeMap(value: Record<string, RawQueryValue>): Record<string, unknown> {
        const result: Record<string, unknown> = {}
        for (const k of Object.keys(value)) {
            if (Object.prototype.hasOwnProperty.call(value, k)) {
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

    _decodeBase64(value: string): Uint8Array {
        const binaryString: string = atob(value)
        // @ts-expect-error See https://developer.mozilla.org/en-US/docs/Glossary/Base64
        return Uint8Array.from(binaryString, (b) => b.codePointAt(0))
    }

    _decodeList(value: RawQueryValue[]): unknown[] {
        return value.map(v => this._decodeValue(v))
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
        const decoded = value.map(v => this._decodeValue(v))
        type SegmentAccumulator = [] | [Node] | [Node, Relationship]
        type Accumulator = { acc: SegmentAccumulator, segments: PathSegment[]}

        return new Path(
            decoded[0] as Node,
            decoded[decoded.length - 1] as Node,
            // @ts-expect-error
            decoded.reduce((previous: Accumulator, current: Node | Relationship): Accumulator => {
                if (previous.acc.length === 2) {
                    return { acc: [current as Node], segments: [...previous.segments,
                     new PathSegment(previous.acc[0], previous.acc[1], current as Node)]}
                }
                return { ...previous, acc: [...previous.acc, current] as SegmentAccumulator}
            }, { acc: [], segments: []}).segments
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

export class QueryRequestCodec {
    private _body?: Record<string, unknown>

    constructor(
        private _auth: types.AuthToken,
        private _query: string,
        private _parameters?: Record<string, unknown> | undefined,
        private _config?: RunQueryConfig | undefined
    ) {

    }

    get contentType (): string {
        return 'application/vnd.neo4j.query'
    }

    get accept (): string {
        return 'application/vnd.neo4j.query, application/json'
    }

    get authorization (): string {
        return `Basic ${btoa(`${this._auth.principal}:${this._auth.credentials}`)}`
    }

    get body (): Record<string, unknown> {
        if (this._body != null) {
            return this._body
        }

        this._body = {
            statement: this._query,
            includeCounters: true,
            bookmarks: this._config?.bookmarks?.values()
        }

        if (Object.getOwnPropertyNames(this._parameters).length !== 0) {
            this._body.parameters = this._encodeParameters(this._parameters!)
        }

        if (this._config?.txConfig.timeout != null) {
            this._body.max_execution_time = this._config?.txConfig.timeout
        }

        if (this._config?.impersonatedUser != null) {
            this._body.impersonated_user = this._config?.impersonatedUser
        }

        return this._body
    }

    _encodeParameters(parameters: Record<string, unknown>): Record<string, RawQueryValue> {
        const encodedParams: Record<string, RawQueryValue> = {}
        for (const k of Object.keys(parameters)) {
            if (Object.prototype.hasOwnProperty.call(parameters, k)) {
                encodedParams[k] = this._encodeValue(parameters[k])
            }
        }
        return encodedParams
    }

    _encodeValue(value: unknown): RawQueryValue {
        if (value === null ) {
            return { $type: 'Null', _value: null }
        } else if (value === true || value === false) {
            return { $type: 'Boolean', _value: value }
        } else if (typeof value === 'number') {
            return { $type: 'Float', _value: value.toString() }
        } else if (typeof value === 'string') {
            return { $type: 'String', _value: value }
        } else if (typeof value === 'bigint') {
            return { $type: 'Integer', _value: value.toString()}
        } else if (isInt(value)) {
            return { $type: 'Integer', _value: value.toString() }
        } else if (value instanceof Int8Array) {
            return { $type: 'Base64', _value: btoa(String.fromCharCode.apply(null, value))}
        } else if (value instanceof Array) {
            return { $type: 'List', _value: value.map(this._encodeValue.bind(this))}
        } else if (isIterable(value)) {
            return this._encodeValue(Array.from(value)) 
        } else if (isPoint(value)) {
            return { $type: 'Point', _value: {
                srid: int(value.srid).toNumber(),
                x: value.x.toString(),
                y: value.y.toString(),
                z: value.z?.toString()
            }}
        } else if (isDuration(value)) {
            return { $type: 'Duration', _value: value.toString()}
        } else if (isLocalTime(value)) {
            return { $type: 'LocalTime', _value: value.toString()}
        } else if (isTime(value)) {
            return { $type: 'Time', _value: value.toString()}
        } else if (isDate(value)) {
            return { $type: 'Date', _value: value.toString()}
        } else if (isLocalDateTime(value)) {
            return { $type: 'LocalDateTime', _value:  value.toString() }
        } else if (isDateTime(value)) {
            if (value.timeZoneId != null) {
                return { $type: 'ZonedDateTime', _value: value.toString()}
            }
            return { $type: 'OffsetDateTime', _value: value.toString()}
        } else if (isRelationship(value) || isNode(value) || isPath(value) || isPathSegment(value) ) {
            throw newError('Graph types can not be ingested to the server', error.PROTOCOL_ERROR)
        } else if (typeof value === 'object') {
            return { $type: "Map", _value: this._encodeParameters(value as Record<string, unknown>)}
        } else {
            throw newError(`Unable to convert parameter to http request. Value: ${value}`, error.PROTOCOL_ERROR)
        }
    }
}

function isIterable<T extends unknown = unknown> (obj: unknown): obj is Iterable<T> {
    if (obj == null) {
      return false
    }
    // @ts-expect-error
    return typeof obj[Symbol.iterator] === 'function'
}
  
