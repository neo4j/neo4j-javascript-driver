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

import { newError, Node, Relationship, int, error } from "neo4j-driver-core"


type RawJoltNode = {
    id: string,
    elementId: string,
    labels: string[]
    properties: object
}

type RawJoltRelationship = {
    id: string,
    elementId: string,
    type: string,
    startNode: string,
    startNodeElementId: string,
    endNode: string,
    endNodeElementId: string,
    properties: object
}

type RawJoltGraph = {
    nodes: RawJoltNode[]
    relationships: RawJoltRelationship[]
}

type RawJoltData = {
    row: unknown[]
    meta: unknown[]
    graph: RawJoltGraph
}

type RawJoltResults = {
    columns: string[]
    data: RawJoltData[]
    stats: Record<string, unknown>
}

export type RawJoltResponse = {
    results: RawJoltResults[]
    lastBookmarks: string[]
    errors: []
    notifications?: unknown[]
    [str: string]: unknown
}

export class JoltProcessor {
    constructor(private _rawJoltResponse: RawJoltResponse) {

    }

    get keys(): string[] {
        return this._rawJoltResponse.results[0].columns
    }

    *stream (): Generator<any[]> {
        for (const data of this._rawJoltResponse.results[0].data) {
            const row: unknown[] = []
            for (const i in data.row) {
                console.log()
                const element = data.row[i]
                const meta = data.meta[i]
                // @ts-expect-error // fix it
                if (meta?.type === 'node') {
                    // @ts-expect-error
                    const elementId = meta.elementId
                    const node = data.graph.nodes.find(n => n.elementId === elementId)

                    if (node == null) {
                        throw newError(`Node '${elementId}' expected, but not found`, error.PROTOCOL_ERROR)
                    }

                    row.push(new Node<number>(int(node.id).toNumber(), node.labels, node.properties, node.elementId ))
                // @ts-expect-error // fix it
                } else if (meta?.type === 'relationship'){
                    // @ts-expect-error
                    const elementId = meta.elementId
                    const relationship = data.graph.relationships.find(n => n.elementId === elementId)

                    if (relationship == null) {
                        throw newError(`Relationship '${elementId}' expected, but not found`, error.PROTOCOL_ERROR)
                    }

                    row.push(new Relationship<number>(
                        int(relationship.id).toNumber(), int(relationship.startNode).toNumber(), int(relationship.endNode).toNumber(), 
                        relationship.type, relationship.properties, relationship.elementId, relationship.startNodeElementId, relationship.endNodeElementId))
                } else  {
                    row.push(element)
                }   
            }
            console.log('yielding row',  row)
            yield  row
        }
        console.log('returning')
        return
    }  

    get meta(): Record<string, unknown> {
        console.log('meta', this._rawJoltResponse.results[0].stats)
        const meta: Record<string, unknown> = { ...this._rawJoltResponse.results[0].stats, bookmark: this._rawJoltResponse.lastBookmarks }
        if (this._rawJoltResponse.notifications != null) {
            meta.notifications = this._rawJoltResponse.notifications
        }
        return meta
    }
}