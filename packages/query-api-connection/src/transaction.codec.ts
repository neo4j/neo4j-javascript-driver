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

import { error, newError, types } from "neo4j-driver-core"
import { BeginTransactionConfig } from "neo4j-driver-core/types/connection"
import { NEO4J_QUERY_CONTENT_TYPE, encodeAuthToken, encodeTransactionBody } from "./codec"

export type BeginTransactionRequestCodecConfig = Pick<BeginTransactionConfig, 'bookmarks' | 'txConfig' | 'mode' | 'impersonatedUser'>
export type CommitTransactionRequestCodecConfig = {}
export type RollbackTransactionRequestCodecConfig = {}

export type RawTransaction = {
    id: string
    expires: string
    tx_host?: string
}

export type RawBeginTransactionSuccessResponse = {
    transaction: RawTransaction
}

export type RawTransactionError = {
    code: string,
    message: string
    error?: string
}

export type RawTransactionFailuresResponse = {
    errors: RawTransactionError[]
}

export type RawBeginTransactionResponse = RawBeginTransactionSuccessResponse | RawTransactionFailuresResponse 

export class BeginTransactionRequestCodec {
    private _body?: Record<string, unknown>
 
    static of (
        auth: types.AuthToken,
        config?: BeginTransactionRequestCodecConfig | undefined
    ): BeginTransactionRequestCodec {
        return new BeginTransactionRequestCodec(auth, config)
    }

    private constructor(
        private _auth: types.AuthToken,
        private _config?: BeginTransactionRequestCodecConfig
    ) {

    }

    get contentType (): string {
        return NEO4J_QUERY_CONTENT_TYPE
    }

    get accept (): string {
        return `${NEO4J_QUERY_CONTENT_TYPE}, application/json`
    }

    get authorization(): string {
        return encodeAuthToken(this._auth)
    }

    get body (): Record<string, unknown> {
        if (this._body != null) {
            return this._body
        }

        this._body = encodeTransactionBody(this._config)

        return this._body
    }
}

export class BeginTransactionResponseCodec {
    static of(
        config: types.InternalConfig,
        contentType: string,
        response: RawBeginTransactionResponse): BeginTransactionResponseCodec {
        if (isSuccess(response)) {
            return new BeginTransactionSuccessResponseCodec(config, response)
        }

        return new BeginTransactionFailureResponseCodec(response.errors?.length > 0 ?
            newError(
                response.errors[0].message,
                // TODO: REMOVE THE ?? AND .ERROR WHEN SERVER IS FIXED
                response.errors[0].code ?? response.errors[0].error
            ) :
            newError('Server replied an empty error response', error.PROTOCOL_ERROR))

    }

    get error(): Error | undefined {
        throw new Error('Not implemented')
    }

    get id(): string {
        throw new Error('Not implemented')
    }

    get expires(): Date {
        throw new Error('Not implemented')
    }

    get host(): string | undefined {
        throw new Error('Not implemented')
    }

}

class  BeginTransactionSuccessResponseCodec extends BeginTransactionResponseCodec {
    constructor(
        private readonly _config: types.InternalConfig, 
        private readonly _response: RawBeginTransactionSuccessResponse) {
        super()
    }

    get error(): Error | undefined {
        return undefined;
    }

    get id(): string {
        return this._response.transaction.id
    }

    get expires(): Date {
        return new Date(this._response.transaction.expires)
    }

    get host(): string | undefined {
        return this._response.transaction.tx_host
    }
}

class BeginTransactionFailureResponseCodec extends BeginTransactionResponseCodec {
    constructor(private readonly _error: Error) {
        super()
    }

    get error(): Error | undefined {
        return this._error
    }

    get id(): string {
        throw this._error
    }

    get expires(): Date {
        throw this._error
    }

    get host(): string | undefined {
        throw this._error
    }
}

export type RawCommitTransactionSuccessResponse = {
    bookmarks: string[] | undefined
}

export type RawCommitTransactionResponse = RawCommitTransactionSuccessResponse | RawTransactionFailuresResponse 


export class CommitTransactionRequestCodec {
    static of (
        auth: types.AuthToken,
        config?: CommitTransactionRequestCodecConfig | undefined
    ): CommitTransactionRequestCodec {
        return new CommitTransactionRequestCodec(auth, config)
    }

    private constructor(
        private _auth: types.AuthToken,
        private _config?: CommitTransactionRequestCodecConfig
    ) {

    }

    get contentType (): string {
        return NEO4J_QUERY_CONTENT_TYPE
    }

    get accept (): string {
        return `${NEO4J_QUERY_CONTENT_TYPE}, application/json`
    }

    get body () : Record<string, unknown> {
        return {}
    }

    get authorization(): string {
        return encodeAuthToken(this._auth)
    }
}

export class CommitTransactionResponseCodec {
    static of(
        config: types.InternalConfig,
        contentType: string,
        response: RawCommitTransactionResponse): CommitTransactionResponseCodec {
        if (isCommitSuccess(response)) {
            return new CommitTransactionSuccessResponseCodec(config, response)
        }

        return new CommitTransactionFailureResponseCodec(response.errors?.length > 0 ?
            newError(
                response.errors[0].message,
                // TODO: REMOVE THE ?? AND .ERROR WHEN SERVER IS FIXED
                response.errors[0].code ?? response.errors[0].error
            ) :
            newError('Server replied an empty error response', error.PROTOCOL_ERROR))

    }

    get error(): Error | undefined {
        throw new Error('Not implemented')
    }

    get meta(): Record<string, unknown> {
        throw new Error('Not implemented')
    }
}

class  CommitTransactionSuccessResponseCodec extends CommitTransactionResponseCodec {
    constructor(
        private readonly _config: types.InternalConfig, 
        private readonly _response: RawCommitTransactionSuccessResponse) {
        super()
    }

    get error(): Error | undefined {
        return undefined;
    }

    get meta(): Record<string, unknown> {
        return {
            bookmark: this._response.bookmarks
        }
    }
}

class CommitTransactionFailureResponseCodec extends CommitTransactionResponseCodec {
    constructor(private readonly _error: Error) {
        super()
    }

    get error(): Error | undefined {
        return this._error
    }

    get meta(): Record<string, unknown> {
        throw this._error
    }
}

export type RawRollbackTransactionSuccessResponse = {
    e?: any
}

export type RawRollbackTransactionResponse = RawRollbackTransactionSuccessResponse | RawTransactionFailuresResponse 


export class RollbackTransactionRequestCodec {
    static of (
        auth: types.AuthToken,
        config?: RollbackTransactionRequestCodecConfig | undefined
    ): RollbackTransactionRequestCodec {
        return new RollbackTransactionRequestCodec(auth, config)
    }

    private constructor(
        private _auth: types.AuthToken,
        private _config?: RollbackTransactionRequestCodecConfig
    ) {

    }

    get body () : Record<string, unknown> {
        return {}
    }

    get contentType (): string {
        return NEO4J_QUERY_CONTENT_TYPE
    }

    get accept (): string {
        return `${NEO4J_QUERY_CONTENT_TYPE}, application/json`
    }

    get authorization(): string {
        return encodeAuthToken(this._auth)
    }
}

export class RollbackTransactionResponseCodec {
    static of(
        config: types.InternalConfig,
        contentType: string,
        response: RawRollbackTransactionResponse): RollbackTransactionResponseCodec {
        if (isRollbackSuccess(response)) {
            return new RollbackTransactionSuccessResponseCodec(config, response)
        }

        return new RollbackTransactionFailureResponseCodec(response.errors?.length > 0 ?
            newError(
                response.errors[0].message,
                // TODO: REMOVE THE ?? AND .ERROR WHEN SERVER IS FIXED
                response.errors[0].code ?? response.errors[0].error
            ) :
            newError('Server replied an empty error response', error.PROTOCOL_ERROR))

    }

    get error(): Error | undefined {
        throw new Error('Not implemented')
    }

    get meta(): Record<string, unknown> {
        throw new Error('Not implemented')
    }
}

class  RollbackTransactionSuccessResponseCodec extends RollbackTransactionResponseCodec {
    constructor(
        private readonly _config: types.InternalConfig, 
        private readonly _response: RawRollbackTransactionSuccessResponse) {
        super()
    }

    get error(): Error | undefined {
        return undefined;
    }

    get meta(): Record<string, unknown> {
        return {
        }
    }
}

class RollbackTransactionFailureResponseCodec extends RollbackTransactionResponseCodec {
    constructor(private readonly _error: Error) {
        super()
    }

    get error(): Error | undefined {
        return this._error
    }

    get meta(): Record<string, unknown> {
        throw this._error
    }
}

function isSuccess(obj: RawBeginTransactionResponse): obj is RawBeginTransactionSuccessResponse {
    // @ts-expect-error
    if (obj.errors != null) {
        return false
    }
    return true
}

function isCommitSuccess(obj: RawCommitTransactionResponse): obj is RawCommitTransactionSuccessResponse {
    // @ts-expect-error
    if (obj.errors != null) {
        return false
    }
    return true
}

function isRollbackSuccess(obj: RawRollbackTransactionResponse): obj is RawRollbackTransactionSuccessResponse {
    // @ts-expect-error
    if (obj.errors != null) {
        return false
    }
    return true
}