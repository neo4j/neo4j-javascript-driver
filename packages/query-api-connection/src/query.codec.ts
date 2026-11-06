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
import { newError, int, error, types, isInt, isPoint, isDuration, isLocalTime, isTime, isDate, isLocalDateTime, isDateTime, isRelationship, isPath, isNode, isPathSegment, isUnboundRelationship, isVector, isUnsupportedType } from "neo4j-driver-core"
import { RunQueryConfig } from "neo4j-driver-core/types/connection"
import { NEO4J_QUERY_CONTENT_TYPE, NEO4J_QUERY_CONTENT_TYPE_V1_0_JSONL, encodeAuthToken, encodeTransactionBody } from "./codec"
import TypedJsonCodec, { Counters, NotificationShape, ProfiledQueryPlan, RawQueryValue, RawQueryError } from "./types.codec"
import { Event, HeaderEvent, QueryApiEventTransformer, SummaryEvent } from "./event.codec"
import { TransformStream, TextDecoderStream } from "./node/stream"
import LineTransformer from "./lang/line.transformer"

export type RawQueryData = {
    fields: string[]
    values: RawQueryValue[][]
}

export type RawQuerySuccessResponse = {
    data: RawQueryData
    counters: Counters
    bookmarks: string[]
    profiledQueryPlan?: ProfiledQueryPlan
    queryPlan?: ProfiledQueryPlan
    notifications?: NotificationShape[]
    [str: string]: unknown
}


export type RawQueryFailuresResponse = {
    errors: RawQueryError[]
}

export type RawQueryResponse = RawQuerySuccessResponse | RawQueryFailuresResponse

export class QueryResponseCodec {

    static async ofResponse(
        config: types.InternalConfig,
        url: String,
        response: Response
        ): Promise<QueryResponseCodec> {

        const contentType = response.headers.get('Content-Type') ?? ''

        if (contentType === NEO4J_QUERY_CONTENT_TYPE_V1_0_JSONL) {
            const decoder = new TextDecoderStream();
            // @ts-expect-error
            const it = response.body?.pipeThrough(decoder)
                // @ts-expect-error
                .pipeThrough(new TransformStream(new LineTransformer()))
                // @ts-expect-error
                .pipeThrough(new TransformStream(new QueryApiEventTransformer()))
                // @ts-expect-error
                .values()!;

            
            return new QueryJsonlResponseCodec(
                TypedJsonCodec.of(contentType, config),
                it
            )
        }

        try {
            const text = await response.text()
            const body = text !== '' ? JSON.parse(text) : {};
            return QueryResponseCodec.of(config, contentType, body);
        } catch (error) {
            throw newError(`Failure accessing "${url}"`, 'SERVICE_UNAVAILABLE', error as Error)
        }
    }

    static of(
        config: types.InternalConfig,
        contentType: string,
        response: RawQueryResponse): QueryResponseCodec {

        if (isSuccess(response)) {
            if (contentType === NEO4J_QUERY_CONTENT_TYPE) {
                return new QuerySuccessResponseCodec(TypedJsonCodec.of(contentType, config), response)
            }
            return new QueryFailureResponseCodec(newError(
                `Wrong content-type. Expected "${NEO4J_QUERY_CONTENT_TYPE}", but got "${contentType}".`,
                error.PROTOCOL_ERROR
            ))
        }

        return new QueryFailureResponseCodec(response.errors?.length > 0 ?
            newError(
                response.errors[0].message,
                // TODO: REMOVE THE ?? AND .ERROR WHEN SERVER IS FIXED
                response.errors[0].code ?? response.errors[0].error
            ) :
            newError('Server replied an empty error response', error.PROTOCOL_ERROR))
    }

    get keys(): string[] | Promise<string[]> {
        throw new Error('Not implemented')
    }

    get meta(): Record<string, unknown> | Promise<Record<string, unknown>> {
        throw new Error('Not implemented')
    }

    *stream(): Generator<any[]> | AsyncGenerator<any[]> {
        throw new Error('Not implemented')
    }
}

class QuerySuccessResponseCodec extends QueryResponseCodec {

    constructor(
        private readonly _typedJsonCodec: TypedJsonCodec,
        private readonly _response: RawQuerySuccessResponse) {
        super()
    }

    get keys(): string[] {
        return this._response.data.fields
    }

    *stream(): Generator<any[]> {
        while (this._response.data.values.length > 0) {
            const value =  this._response.data.values.shift()
            if (value != null) {
                yield value.map(this._typedJsonCodec.decodeValue.bind(this._typedJsonCodec))
            }
        } 
        return
    }

    get meta(): Record<string, unknown> {
        return {
            bookmark: this._response.bookmarks,
            stats: this._typedJsonCodec.decodeStats(this._response.counters),
            profile: this._response.profiledQueryPlan != null ?
                this._typedJsonCodec.decodeProfile(this._response.profiledQueryPlan) : null,
            plan: this._response.queryPlan != null ?
                this._typedJsonCodec.decodeProfile(this._response.queryPlan) : null,
            notifications: this._response.notifications
        }
    }

}

class QueryJsonlResponseCodec extends QueryResponseCodec {
    private _keys: string[]
    private _error: Error | undefined
    private _meta: Record<string, unknown>
    private _done: boolean

    constructor(
        private readonly _typedJsonCodec: TypedJsonCodec,
        private readonly _it: AsyncIterableIterator<Event> ) {
            super()
            this._done = false
    }

    get keys(): Promise<string[]> | string[] {
        if (this._error) {
            return Promise.reject(error)
        }
        if (this._keys != null) {
            return this._keys
        }
        return this._next()
            .then(event => {
                if (event == null || event.$event !== 'Header') {
                    throw newError(`Streaming ordering violation. Expected Header, got: ${event?.$event}`, error.PROTOCOL_ERROR)
                }

                this._processHeader(event)

                return this._keys
            })
    }

    private _processHeader (event: HeaderEvent) {
        if (event._body.fields == null) {
            throw newError(`Expected Header event for streaming query to have non null keys.`, error.PROTOCOL_ERROR)
        }
        this._keys = event._body.fields
    }

    get meta(): Promise<Record<string, unknown>> | Record<string, unknown> {
        if (this._error) {
            return Promise.reject(error)
        }
        if (this._meta != null) {
            return this._meta
        }

        return this._next()
            .then(event => {
                if (event == null) {
                    throw newError(`Streaming ordering violation. Expected Header, got: ${event}`, error.PROTOCOL_ERROR)
                }

                if (event.$event !== 'Summary') {
                    if (event.$event === 'Header') {
                        this._processHeader(event)
                    }
                    // next
                    return this.meta
                }

                this._processSummary(event)
                return this._meta
            })
    }

    private _processSummary(event: SummaryEvent) {
        this._meta = {
            bookmark: event._body.bookmarks,
            stats: event._body.counters != null ? this._typedJsonCodec.decodeStats(event._body.counters) : null,
            profile: event._body.profiledQueryPlan != null ?
                this._typedJsonCodec.decodeProfile(event._body.profiledQueryPlan) : null,
            plan: event._body.queryPlan != null ?
                this._typedJsonCodec.decodeProfile(event._body.queryPlan) : null,
            notifications: event._body.notifications
        }
    }

    async *stream(): AsyncGenerator<any[]> { 
        if (this._error) {
            throw this._error
        }
        while(!this._done) {
            const event = await this._next()
            if (this._done) {
                return;
            }

            if (event?.$event === 'Header') {
                this._processHeader(event)
            } else if(event?.$event === 'Record') {
                yield event._body.map(this._typedJsonCodec.decodeValue.bind(this._typedJsonCodec))
            } else if(event?.$event === 'Summary') {
                this._processSummary(event)
            } else {
                this._error = newError(`${event?.$event} is not expected`, error.PROTOCOL_ERROR)
                throw this._error
            }
        }
        return
    }

    private async _next(): Promise<Event | undefined> {
        if (this._done) {
            throw newError("Closed streaming.", error.PROTOCOL_ERROR)
        }
        const { value: event, done } = await this._it.next() as { value: Event, done: boolean }
        this._done = done === true
        if (this._done) {
            return event
        }

        if (event.$event === 'Error') {
            this._error = event._body.length > 0 ? newError(
                event._body[0].message,
                // TODO: REMOVE THE ?? AND .ERROR WHEN SERVER IS FIXED
                event._body[0].code
            ) : newError('Server replied an empty error response', error.PROTOCOL_ERROR)
            throw this._error
        } 

        return event
    }
}

class QueryFailureResponseCodec extends QueryResponseCodec {
    constructor(private readonly _error: Error) {
        super()
    }

    get keys(): string[] {
        throw this._error
    }

    get meta(): Record<string, unknown> {
        throw this._error
    }

    stream(): Generator<any[], any, unknown> {
        throw this._error
    }
}

export type QueryRequestCodecConfig = Pick<RunQueryConfig, 'bookmarks' | 'txConfig' | 'mode' | 'impersonatedUser'>

export class QueryRequestCodec {
    private _body?: Record<string, unknown>

    static of(
        auth: types.AuthToken,
        query: string,
        parameters?: Record<string, unknown> | undefined,
        config?: QueryRequestCodecConfig | undefined
    ): QueryRequestCodec {
        return new QueryRequestCodec(auth, query, parameters, config)
    }

    private constructor(
        private _auth: types.AuthToken,
        private _query: string,
        private _parameters?: Record<string, unknown> | undefined,
        private _config?: QueryRequestCodecConfig | undefined
    ) {

    }

    get contentType(): string {
        return NEO4J_QUERY_CONTENT_TYPE
    }

    get accept(): string {
        // @ts-expect-error
        if (ReadableStream.prototype.values == null) {
            //older versions of Safari (until Safari 27) don't support async iteration of ReadableStreams, which we need for this
            return `${NEO4J_QUERY_CONTENT_TYPE}, application/json`
        }
        else {
            return `${NEO4J_QUERY_CONTENT_TYPE_V1_0_JSONL}, ${NEO4J_QUERY_CONTENT_TYPE}, application/json`
        }
    }

    get authorization(): string {
        return encodeAuthToken(this._auth)
    }

    get body(): Record<string, unknown> {
        if (this._body != null) {
            return this._body
        }

        this._body = {
            statement: this._query,
            includeCounters: true,
            ...encodeTransactionBody(this._config)
        }

        if (this._parameters != null && Object.getOwnPropertyNames(this._parameters).length !== 0) {
            this._body.parameters = this._encodeParameters(this._parameters!)
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
        if (value === null) {
            return { $type: 'Null', _value: null }
        } else if (value === true || value === false) {
            return { $type: 'Boolean', _value: value }
        } else if (typeof value === 'number') {
            return { $type: 'Float', _value: value.toString() }
        } else if (typeof value === 'string') {
            return { $type: 'String', _value: value }
        } else if (typeof value === 'bigint') {
            return { $type: 'Integer', _value: value.toString() }
        } else if (isInt(value)) {
            return { $type: 'Integer', _value: value.toString() }
        } else if (value instanceof Uint8Array) {
            return { $type: 'Base64', _value: btoa(String.fromCharCode.apply(null, Array.from(value.values()))) }
        } else if (value instanceof Array) {
            return { $type: 'List', _value: value.map(this._encodeValue.bind(this)) }
        } else if (isIterable(value)) {
            return this._encodeValue(Array.from(value))
        } else if (isPoint(value)) {
            return {
                $type: 'Point', _value: value.z == null ?
                    `SRID=${int(value.srid).toString()};POINT (${value.x} ${value.y})` :
                    `SRID=${int(value.srid).toString()};POINT Z (${value.x} ${value.y} ${value.z})`
            }
        } else if (isDuration(value)) {
            return { $type: 'Duration', _value: value.toString() }
        } else if (isLocalTime(value)) {
            return { $type: 'LocalTime', _value: value.toString() }
        } else if (isTime(value)) {
            return { $type: 'Time', _value: value.toString() }
        } else if (isDate(value)) {
            return { $type: 'Date', _value: value.toString() }
        } else if (isLocalDateTime(value)) {
            return { $type: 'LocalDateTime', _value: value.toString() }
        } else if (isDateTime(value)) {
            if (value.timeZoneOffsetSeconds == null) {
                throw new Error(
                    'DateTime objects without "timeZoneOffsetSeconds" property ' +
                    'are prone to bugs related to ambiguous times. For instance, ' +
                    '2022-10-30T2:30:00[Europe/Berlin] could be GMT+1 or GMT+2.'
                )
            }
            
            if (value.timeZoneId != null) {
                return { $type: 'ZonedDateTime', _value: value.toString() }
            }
            return { $type: 'OffsetDateTime', _value: value.toString() }
        } else if (isVector(value)) {
            throw newError('Vectors are not supported yet on query api', error.PROTOCOL_ERROR)
        } else if (isUnsupportedType(value)) {
            throw newError('UnsupportedType can not be ingested to the server', error.PROTOCOL_ERROR)
        } else if (isRelationship(value) || isNode(value) || isPath(value) || isPathSegment(value) || isUnboundRelationship(value)) {
            throw newError('Graph types can not be ingested to the server', error.PROTOCOL_ERROR) 
        } else if (typeof value === 'object') {
            return { $type: "Map", _value: this._encodeParameters(value as Record<string, unknown>) }
        } else {
            throw newError(`Unable to convert parameter to http request. Value: ${value}`, error.PROTOCOL_ERROR)
        }
    }
}

function isIterable<T extends unknown = unknown>(obj: unknown): obj is Iterable<T> {
    if (obj == null) {
        return false
    }
    // @ts-expect-error
    return typeof obj[Symbol.iterator] === 'function'
}

function isSuccess(obj: RawQueryResponse): obj is RawQuerySuccessResponse {
    if (obj.errors != null) {
        return false
    }
    return true
}
