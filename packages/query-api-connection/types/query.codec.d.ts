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
import { RunQueryConfig } from "neo4j-driver-core/types/connection";
import { Counters, NotificationShape, ProfiledQueryPlan, RawQueryValue, RawQueryError } from "./types.codec";
export type RawQueryData = {
    fields: string[];
    values: RawQueryValue[][];
};
export type RawQuerySuccessResponse = {
    data: RawQueryData;
    counters: Counters;
    bookmarks: string[];
    profiledQueryPlan?: ProfiledQueryPlan;
    queryPlan?: ProfiledQueryPlan;
    notifications?: NotificationShape[];
    [str: string]: unknown;
};
export type RawQueryFailuresResponse = {
    errors: RawQueryError[];
};
export type RawQueryResponse = RawQuerySuccessResponse | RawQueryFailuresResponse;
export declare class QueryResponseCodec {
    static ofResponse(config: types.InternalConfig, url: String, response: Response): Promise<QueryResponseCodec>;
    static of(config: types.InternalConfig, contentType: string, response: RawQueryResponse): QueryResponseCodec;
    get keys(): string[] | Promise<string[]>;
    get meta(): Record<string, unknown> | Promise<Record<string, unknown>>;
    stream(): Generator<any[]> | AsyncGenerator<any[]>;
}
export type QueryRequestCodecConfig = Pick<RunQueryConfig, 'bookmarks' | 'txConfig' | 'mode' | 'impersonatedUser'>;
export declare class QueryRequestCodec {
    private _auth;
    private _query;
    private _parameters?;
    private _config?;
    private _body?;
    static of(auth: types.AuthToken, query: string, parameters?: Record<string, unknown> | undefined, config?: QueryRequestCodecConfig | undefined): QueryRequestCodec;
    private constructor();
    get contentType(): string;
    get accept(): string;
    get authorization(): string;
    get body(): Record<string, unknown>;
    _encodeParameters(parameters: Record<string, unknown>): Record<string, RawQueryValue>;
    _encodeValue(value: unknown): RawQueryValue;
}
