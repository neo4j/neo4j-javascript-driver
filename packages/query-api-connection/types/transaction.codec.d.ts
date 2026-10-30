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
import { types } from "neo4j-driver-core";
import { BeginTransactionConfig } from "neo4j-driver-core/types/connection";
export type BeginTransactionRequestCodecConfig = Pick<BeginTransactionConfig, 'bookmarks' | 'txConfig' | 'mode' | 'impersonatedUser'>;
export type CommitTransactionRequestCodecConfig = {};
export type RollbackTransactionRequestCodecConfig = {};
export type RawTransaction = {
    id: string;
    expires: string;
    tx_host?: string;
};
export type RawBeginTransactionSuccessResponse = {
    transaction: RawTransaction;
};
export type RawTransactionError = {
    code: string;
    message: string;
    error?: string;
};
export type RawTransactionFailuresResponse = {
    errors: RawTransactionError[];
};
export type RawBeginTransactionResponse = RawBeginTransactionSuccessResponse | RawTransactionFailuresResponse;
export declare class BeginTransactionRequestCodec {
    private _auth;
    private _config?;
    private _body?;
    static of(auth: types.AuthToken, config?: BeginTransactionRequestCodecConfig | undefined): BeginTransactionRequestCodec;
    private constructor();
    get contentType(): string;
    get accept(): string;
    get authorization(): string;
    get body(): Record<string, unknown>;
}
export declare class BeginTransactionResponseCodec {
    static of(config: types.InternalConfig, contentType: string, response: RawBeginTransactionResponse): BeginTransactionResponseCodec;
    get error(): Error | undefined;
    get id(): string;
    get expires(): Date;
    get host(): string | undefined;
}
export type RawCommitTransactionSuccessResponse = {
    bookmarks: string[] | undefined;
};
export type RawCommitTransactionResponse = RawCommitTransactionSuccessResponse | RawTransactionFailuresResponse;
export declare class CommitTransactionRequestCodec {
    private _auth;
    private _config?;
    static of(auth: types.AuthToken, config?: CommitTransactionRequestCodecConfig | undefined): CommitTransactionRequestCodec;
    private constructor();
    get contentType(): string;
    get accept(): string;
    get body(): Record<string, unknown>;
    get authorization(): string;
}
export declare class CommitTransactionResponseCodec {
    static of(config: types.InternalConfig, contentType: string, response: RawCommitTransactionResponse): CommitTransactionResponseCodec;
    get error(): Error | undefined;
    get meta(): Record<string, unknown>;
}
export type RawRollbackTransactionSuccessResponse = {
    e?: any;
};
export type RawRollbackTransactionResponse = RawRollbackTransactionSuccessResponse | RawTransactionFailuresResponse;
export declare class RollbackTransactionRequestCodec {
    private _auth;
    private _config?;
    static of(auth: types.AuthToken, config?: RollbackTransactionRequestCodecConfig | undefined): RollbackTransactionRequestCodec;
    private constructor();
    get body(): Record<string, unknown>;
    get contentType(): string;
    get accept(): string;
    get authorization(): string;
}
export declare class RollbackTransactionResponseCodec {
    static of(config: types.InternalConfig, contentType: string, response: RawRollbackTransactionResponse): RollbackTransactionResponseCodec;
    get error(): Error | undefined;
    get meta(): Record<string, unknown>;
}
