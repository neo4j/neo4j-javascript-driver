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
export type RawQueryValueTypes = 'Null' | 'Boolean' | 'Integer' | 'Float' | 'String' | 'Time' | 'Date' | 'LocalTime' | 'ZonedDateTime' | 'OffsetDateTime' | 'LocalDateTime' | 'Duration' | 'Point' | 'Base64' | 'Map' | 'List' | 'Node' | 'Relationship' | 'Path';
export type NodeShape = {
    _element_id: string;
    _labels: string[];
    _properties?: Record<string, RawQueryValue>;
};
export type RelationshipShape = {
    _element_id: string;
    _start_node_element_id: string;
    _end_node_element_id: string;
    _type: string;
    _properties?: Record<string, RawQueryValue>;
};
export type PathShape = (RawQueryRelationship | RawQueryNode)[];
export type RawQueryValueDef<T extends RawQueryValueTypes, V extends unknown> = {
    $type: T;
    _value: V;
};
export type RawQueryNull = RawQueryValueDef<'Null', null>;
export type RawQueryBoolean = RawQueryValueDef<'Boolean', boolean>;
export type RawQueryInteger = RawQueryValueDef<'Integer', string>;
export type RawQueryFloat = RawQueryValueDef<'Float', string>;
export type RawQueryString = RawQueryValueDef<'String', string>;
export type RawQueryTime = RawQueryValueDef<'Time', string>;
export type RawQueryDate = RawQueryValueDef<'Date', string>;
export type RawQueryLocalTime = RawQueryValueDef<'LocalTime', string>;
export type RawQueryZonedDateTime = RawQueryValueDef<'ZonedDateTime', string>;
export type RawQueryOffsetDateTime = RawQueryValueDef<'OffsetDateTime', string>;
export type RawQueryLocalDateTime = RawQueryValueDef<'LocalDateTime', string>;
export type RawQueryDuration = RawQueryValueDef<'Duration', string>;
export type RawQueryPoint = RawQueryValueDef<'Point', string>;
export type RawQueryBinary = RawQueryValueDef<'Base64', string>;
export interface RawQueryMap extends RawQueryValueDef<'Map', Record<string, RawQueryValue>> {
}
export interface RawQueryList extends RawQueryValueDef<'List', RawQueryValue[]> {
}
export type RawQueryNode = RawQueryValueDef<'Node', NodeShape>;
export type RawQueryRelationship = RawQueryValueDef<'Relationship', RelationshipShape>;
export type RawQueryPath = RawQueryValueDef<'Path', PathShape>;
export type RawQueryValue = RawQueryNull | RawQueryBoolean | RawQueryInteger | RawQueryFloat | RawQueryString | RawQueryTime | RawQueryDate | RawQueryLocalTime | RawQueryZonedDateTime | RawQueryOffsetDateTime | RawQueryLocalDateTime | RawQueryDuration | RawQueryPoint | RawQueryBinary | RawQueryMap | RawQueryList | RawQueryNode | RawQueryRelationship | RawQueryPath;
export type RawQueryError = {
    code: string;
    message: string;
    error?: string;
};
export type Counters = {
    containsUpdates: boolean;
    nodesCreated: number;
    nodesDeleted: number;
    propertiesSet: number;
    relationshipsCreated: number;
    relationshipsDeleted: number;
    labelsAdded: number;
    labelsRemoved: number;
    indexesAdded: number;
    indexesRemoved: number;
    constraintsAdded: number;
    constraintsRemoved: number;
    containsSystemUpdates: boolean;
    systemUpdates: number;
};
export type ProfiledQueryPlan = {
    dbHits: number;
    records: number;
    hasPageCacheStats: boolean;
    pageCacheHits: number;
    pageCacheMisses: number;
    pageCacheHitRatio: number;
    time: number;
    operatorType: string;
    arguments: Record<string, RawQueryValue>;
    identifiers: string[];
    children: ProfiledQueryPlan[];
};
export type NotificationShape = {
    code: string;
    title: string;
    description: string;
    position: {
        offset: number;
        line: number;
        column: number;
    } | {};
    severity: string;
    category: string;
};
export default class TypedJsonCodec {
    static of(contentType: string, config: types.InternalConfig): TypedJsonCodec;
    decodeStats(counters: Counters): Record<string, unknown>;
    decodeProfile(queryPlan: ProfiledQueryPlan): Record<string, unknown>;
    decodeValue(value: RawQueryValue): unknown;
}
