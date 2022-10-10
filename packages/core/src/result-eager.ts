/**
 * Copyright (c) "Neo4j"
 * Neo4j Sweden AB [http://neo4j.com]
 *
 * This file is part of Neo4j.
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

import Record, { Dict } from './record'
import ResultSummary from './result-summary'
import Result from './result'

/**
 * Represents the fully streamed result
 */
export default class EagerResult<Entries extends Dict = Dict> {
  keys: string[]
  records: Array<Record<Entries>>
  summary: ResultSummary

  /**
     * @constructor
     * @private
     * @param {string[]} keys The records keys
     * @param {Record[]} records The resulted records
     * @param {ResultSummary[]} summary The result Summary
     */
  constructor (
    keys: string[],
    records: Record[],
    summary: ResultSummary
  ) {
    /**
       * Field keys, in the order the fields appear in the records.
       * @type {string[]}
       */
    this.keys = keys
    /**
       * Field records, in the order the records arrived from the server.
       * @type {Record[]}
       */
    this.records = records
    /**
       * Field summary
       * @type {ResultSummary}
       */
    this.summary = summary
  }
}

/**
 * Creates a {@link EagerResult} from a given {@link Result} by
 * consuming all the stream.
 *
 * @private
 * @param {Result} result The result to be consumed
 * @returns A promise of a EagerResult
 */
export async function createEagerResultFromResult<Entries extends Dict = Dict> (result: Result): Promise<EagerResult<Entries>> {
  const { summary, records } = await result
  const keys = await result.keys()
  return new EagerResult(keys, records, summary)
}
