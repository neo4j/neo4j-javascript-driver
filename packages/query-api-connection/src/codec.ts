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

import { types } from "neo4j-driver-core"
import { BeginTransactionConfig } from "neo4j-driver-core/types/connection"


export const NEO4J_QUERY_CONTENT_TYPE = 'application/vnd.neo4j.query'
export const NEO4J_QUERY_CONTENT_TYPE_V1_0 = 'application/vnd.neo4j.query.v1.0'
export const NEO4J_QUERY_CONTENT_TYPE_V1_0_JSONL = 'application/vnd.neo4j.query.v1.0+jsonl' 

export function encodeAuthToken(auth: types.AuthToken): string {
    switch (auth.scheme) {
        case 'bearer':
            return `Bearer ${auth.credentials}`
        case 'basic':
            return `Basic ${btoa(`${auth.principal}:${auth.credentials}`)}`
        default:
            throw new Error(`Authorization scheme "${auth.scheme}" is not supported.`)
    }
}

export function encodeTransactionBody (config?: Pick<BeginTransactionConfig, 'bookmarks' | 'txConfig' | 'mode' | 'impersonatedUser'> ): Record<string, unknown> {
    const body: Record<string, unknown> = {} 

    if (config?.bookmarks != null && !config.bookmarks.isEmpty()) {
        body.bookmarks = config?.bookmarks?.values()
    }

    if (config?.txConfig.timeout != null) {
        body.maxExecutionTime = config?.txConfig.timeout.toInt()
    }

    if (config?.impersonatedUser != null) {
        body.impersonatedUser = config?.impersonatedUser
    }

    if (config?.mode) {
        let accessMode = config.mode.substring(0, 1).toUpperCase() + config.mode.substring(1).toLowerCase()
        body.accessMode = accessMode
    }

    return body
}