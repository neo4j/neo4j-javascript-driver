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

import { TransformStreamDefaultController, Transformer } from "../node/stream";

export default class LineTransformer implements Transformer<string, string> {
    constructor(private _rest: string | undefined = undefined) {

    }
    transform(chunk: string, controller: TransformStreamDefaultController<string>): void {
        try {
            const splitted = chunk.split('\n')

            if (this.shouldPrependRest(splitted)){
                splitted[0] = this._rest + splitted[0]
                this._rest = undefined
            }

            const rest = splitted[splitted.length - 1]
            if (rest != null && rest.trim() != "" ) {
                this._rest = rest
            }

            for (let i = 0; i < splitted.length - 1; i++) {
                controller.enqueue(splitted[i])
            }
        } catch(e) {
            controller.error(e)
        } 
    }

    private shouldPrependRest(splitted: string[]) {
        return splitted.length > 0 && this._rest != null;
    }
}
