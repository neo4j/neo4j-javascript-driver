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

import { Record, ResultSummary, Result } from 'neo4j-driver-core'

const dummy: any = null

const res: Result = dummy

res
  .then(value => {
    const records: Record[] = value.records
    const summary: ResultSummary = value.summary
  })
  .catch(error => {
    console.log(error)
  })

res.subscribe({})

res.subscribe({
  onNext: (record: Record) => console.log(record)
})

res.subscribe({
  onNext: (record: Record) => console.log(record),
  onError: (error: Error) => console.log(error)
})

res.subscribe({
  onNext: (record: Record) => console.log(record),
  onError: (error: Error) => console.log(error),
  onCompleted: (summary: ResultSummary) => console.log(summary)
})

res.subscribe({
  onKeys: (keys: string[]) => console.log(keys),
  onNext: (record: Record) => console.log(record),
  onError: (error: Error) => console.log(error),
  onCompleted: (summary: ResultSummary) => console.log(summary)
})
