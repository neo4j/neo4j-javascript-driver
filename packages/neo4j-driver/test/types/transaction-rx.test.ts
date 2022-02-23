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

import RxTransaction from '../../types/transaction-rx'
import { Record, ResultSummary } from 'neo4j-driver-core'
import RxResult from '../../types/result-rx'
import { Observable, of, Observer, throwError } from 'rxjs'
import { concat, finalize, catchError } from 'rxjs/operators'

const dummy: any = null

const stringObserver: Observer<string> = {
  next: value => console.log(value),
  complete: () => console.log('complete'),
  error: error => console.log(`error: ${error}`)
}

const keysObserver: Observer<string[]> = {
  next: value => console.log(`keys: ${value}`),
  complete: () => console.log('keys complete'),
  error: error => console.log(`keys error: ${error}`)
}

const recordsObserver: Observer<Record> = {
  next: value => console.log(`record: ${value}`),
  complete: () => console.log('records complete'),
  error: error => console.log(`records error: ${error}`)
}

const summaryObserver: Observer<ResultSummary> = {
  next: value => console.log(`summary: ${value}`),
  complete: () => console.log('summary complete'),
  error: error => console.log(`summary error: ${error}`)
}

const tx: RxTransaction = dummy

const result1: RxResult = tx.run('RETURN 1')
result1.keys().subscribe(keysObserver)
result1.records().subscribe(recordsObserver)
result1.consume().subscribe(summaryObserver)

const result2: RxResult = tx.run('RETURN $value', { value: '42' })
result2.keys().subscribe(keysObserver)
result2.records().subscribe(recordsObserver)
result2.consume().subscribe(summaryObserver)

tx.commit()
  .pipe(concat(of('committed')))
  .subscribe(stringObserver)

tx.rollback()
  .pipe(concat(of('rolled back')))
  .subscribe(stringObserver)

tx.close()
  .pipe(concat(of('closed')))
  .subscribe(stringObserver)
