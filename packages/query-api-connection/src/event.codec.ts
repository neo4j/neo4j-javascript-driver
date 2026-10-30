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
import { TransformStreamDefaultController, Transformer } from "./node/stream";
import { newError, error } from "neo4j-driver-core";
import { Counters, NotificationShape, ProfiledQueryPlan, RawQueryError, RawQueryValue } from "./types.codec";

export type HeaderEvent = {
    $event: 'Header',
    _body: {
        fields?: string []
    }
}

export type RecordEvent = {
    $event: 'Record',
    _body: RawQueryValue[]
}

export type SummaryEvent = {
    $event: 'Summary',
    _body: {
        notifications?: NotificationShape[]
        counters?: Counters
        bookmarks?: string[]
        profiledQueryPlan?: ProfiledQueryPlan
        queryPlan?: ProfiledQueryPlan 
    }
}

export type ErrorEvent = {
    $event: 'Error',
    _body: RawQueryError[]
}

export type Event = HeaderEvent | RecordEvent | SummaryEvent | ErrorEvent;


function isEvent(obj: any): obj is Event {
    return obj != null && typeof obj.$event === "string" && typeof obj._body === 'object' && obj._body != null
}

export class QueryApiEventTransformer implements Transformer<string, Event> {
    transform(chunk: string, controller: TransformStreamDefaultController<Event>): void {
        try {
            const mightEvent = JSON.parse(chunk)
            if (isEvent(mightEvent)) {
                controller.enqueue(mightEvent)
            } else {
                throw newError('Invalid event', error.PROTOCOL_ERROR)
            }
        } catch(e) {
            controller.error(e)
        } 
    }
}
