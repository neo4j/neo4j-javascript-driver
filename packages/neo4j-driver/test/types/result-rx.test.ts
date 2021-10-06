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

import RxResult from '../../types/result-rx'

const dummy: any = null

const res: RxResult = dummy

res.keys().subscribe({
  next: value => console.log(`keys: ${value}`),
  complete: () => console.log('keys complete'),
  error: error => console.log(`keys error: ${error}`)
})

res.records().subscribe({
  next: value => console.log(`record: ${value}`),
  complete: () => console.log('records complete'),
  error: error => console.log(`records error: ${error}`)
})

res.consume().subscribe({
  next: value => console.log(`summary: ${value}`),
  complete: () => console.log('summary complete'),
  error: error => console.log(`summary error: ${error}`)
})
