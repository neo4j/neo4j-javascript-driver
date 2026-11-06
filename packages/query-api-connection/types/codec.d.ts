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
export declare const NEO4J_QUERY_CONTENT_TYPE = "application/vnd.neo4j.query";
export declare const NEO4J_QUERY_CONTENT_TYPE_V1_0 = "application/vnd.neo4j.query.v1.0";
export declare const NEO4J_QUERY_CONTENT_TYPE_V1_0_JSONL = "application/vnd.neo4j.query.v1.0+jsonl";
export declare function encodeAuthToken(auth: types.AuthToken): string;
export declare function encodeTransactionBody(config?: Pick<BeginTransactionConfig, 'bookmarks' | 'txConfig' | 'mode' | 'impersonatedUser'>): Record<string, unknown>;
