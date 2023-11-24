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

/* eslint-disable @typescript-eslint/no-unused-vars */

import RxSession from '../../types/session-rx'
import RxTransaction from '../../types/transaction-rx'
import { RxManagedTransaction } from '../../types'
import RxResult from '../../types/result-rx'
import {
  Integer,
  Record,
  ResultSummary,
  TransactionConfig
} from 'neo4j-driver-core'
import { Observable, of, Observer, throwError } from 'rxjs'
import { finalize, catchError, concatWith } from 'rxjs/operators'

const dummy: any = null
const intValue: Integer = Integer.fromInt(42)

const keysObserver: Observer<string[]> = {
  next: value => console.log(`keys: ${value.reduce((acc, curr) => acc + ', ' + curr, '')}`),
  complete: () => console.log('keys complete'),
  // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
  error: error => console.log(`keys error: ${error}`)
}

const recordsObserver: Observer<Record> = {
  // eslint-disable-next-line @typescript-eslint/no-base-to-string
  next: value => console.log(`record: ${value.toString()}`),
  complete: () => console.log('records complete'),
  // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
  error: error => console.log(`records error: ${error}`)
}

const summaryObserver: Observer<ResultSummary> = {
  // eslint-disable-next-line @typescript-eslint/no-base-to-string
  next: value => console.log(`summary: ${value.toString()}`),
  complete: () => console.log('summary complete'),
  // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
  error: error => console.log(`summary error: ${error}`)
}

const rxSession: RxSession = dummy

const txConfig1: TransactionConfig = {}
const txConfig2: TransactionConfig = { timeout: 5000 }
const txConfig3: TransactionConfig = { timeout: intValue }
const txConfig4: TransactionConfig = { metadata: {} }
const txConfig5: TransactionConfig = {
  metadata: {
    key1: 'value1',
    key2: 5,
    key3: { a: 'a', b: 'b' },
    key4: [1, 2, 3]
  }
}
const txConfig6: TransactionConfig = {
  timeout: 2000,
  metadata: { key1: 'value1', key2: 2 }
}
const txConfig7: TransactionConfig = {
  timeout: intValue,
  metadata: { key1: 'value1', key2: 2 }
}

const tx1: Observable<RxTransaction> = rxSession.beginTransaction()
const bookmarks: string[] = rxSession.lastBookmarks()
const bookmark: string[] = rxSession.lastBookmark()

const observable1: Observable<number> = rxSession.readTransaction(
  (tx: RxTransaction) => {
    return of(10)
  }
)

const observable2: Observable<string> = rxSession.readTransaction(
  (tx: RxTransaction) => {
    return of('42')
  }
)

const observable3: Observable<number> = rxSession.writeTransaction(
  (tx: RxTransaction) => {
    return of(10)
  }
)

const observable4: Observable<string> = rxSession.writeTransaction(
  (tx: RxTransaction) => {
    return of('42')
  }
)

const close1: Observable<void> = rxSession.close()
const close2: Observable<void> = rxSession
  .close()
  .pipe(finalize(() => 'session closed'))

const result1: RxResult = rxSession.run('RETURN 1')
result1.keys().subscribe(keysObserver)
result1.records().subscribe(recordsObserver)
result1
  .consume()
  .pipe(
    concatWith(close1),
    catchError(err => close1.pipe(concatWith(throwError(() => err))))
  )
  .subscribe(summaryObserver)

const result2: RxResult = rxSession.run('RETURN $value', { value: '42' })
result2.keys().subscribe(keysObserver)
result2.records().subscribe(recordsObserver)
result2
  .consume()
  .pipe(
    concatWith(close1),
    catchError(err => close1.pipe(concatWith(throwError(() => err))))
  )
  .subscribe(summaryObserver)

const result3: RxResult = rxSession.run(
  'RETURN $value',
  { value: '42' },
  txConfig1
)
result3.keys().subscribe(keysObserver)
result3.records().subscribe(recordsObserver)
result3
  .consume()
  .pipe(
    concatWith(close1),
    catchError(err => close1.pipe(concatWith(throwError(() => err))))
  )
  .subscribe(summaryObserver)

const tx2: Observable<RxTransaction> = rxSession.beginTransaction(txConfig2)
const observable5: Observable<string> = rxSession.readTransaction(
  (tx: RxTransaction) => of(''),
  txConfig3
)
const observable6: Observable<number> = rxSession.writeTransaction(
  (tx: RxTransaction) => of(42),
  txConfig4
)

const observable7: Observable<number> = rxSession.executeRead(
  (tx: RxManagedTransaction) => {
    return of(10)
  }
)

const observable8: Observable<string> = rxSession.executeRead(
  (tx: RxManagedTransaction) => {
    return of('42')
  }
)

const observable9: Observable<number> = rxSession.executeWrite(
  (tx: RxManagedTransaction) => {
    return of(10)
  }
)

const observable10: Observable<string> = rxSession.executeWrite(
  (tx: RxManagedTransaction) => {
    return of('42')
  }
)
