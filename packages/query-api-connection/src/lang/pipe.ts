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
import { internal } from "neo4j-driver-core"

export default class Pipe {
    private promise: Promise<void>

    constructor(private logger?: internal.logger.Logger) {
        this.promise = Promise.resolve()
    }

    attach (work: () => Promise<void> | void): Promise<void> {
        this.promise =  this.promise.then(work)
        return this.promise
    }

    recover (): void {
        this.promise = this.promise.catch(error => {
            if (this.logger?.isDebugEnabled() === true) {
                this.logger?.debug(`Recovering from ${error}`)
            }
        })
    }
}