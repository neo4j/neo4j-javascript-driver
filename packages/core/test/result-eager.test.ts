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

import { EagerResult, Record, ResultSummary } from '../src'

describe('EagerResult', () => {
  it('should construct with keys, records and summary', () => {
    const keys = ['a', 'b', 'c']
    const records = [new Record(keys, [1, 2, 3])]
    const summary = new ResultSummary('query', {}, {})

    const eagerResult = new EagerResult(keys, records, summary)

    expect(eagerResult.keys).toBe(keys)
    expect(eagerResult.records).toBe(records)
    expect(eagerResult.summary).toBe(summary)
  })
})
