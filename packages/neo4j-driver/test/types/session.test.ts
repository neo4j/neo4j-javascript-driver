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

import {
  Integer,
  Record,
  ResultSummary,
  QueryResult,
  Result,
  Transaction,
  Session,
  TransactionConfig
} from 'neo4j-driver-core'

const dummy: any = null
const intValue: Integer = Integer.fromInt(42)

const session: Session = dummy

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

const tx1: Transaction = session.beginTransaction()
const bookmark: string[] = session.lastBookmark()

const promise1: Promise<number> = session.readTransaction((tx: Transaction) => {
  return 10
})

const promise2: Promise<string> = session.readTransaction((tx: Transaction) => {
  return Promise.resolve('42')
})

const promise3: Promise<number> = session.writeTransaction(
  (tx: Transaction) => {
    return 10
  }
)

const promise4: Promise<string> = session.writeTransaction(
  (tx: Transaction) => {
    return Promise.resolve('42')
  }
)

const close1: Promise<void> = session.close()
const close2: Promise<void> = session.close().then(() => {
  console.log('Session closed')
})

const result1: Result = session.run('RETURN 1')
result1
  .then((res: QueryResult) => {
    const records: Record[] = res.records
    const summary: ResultSummary = res.summary
    console.log(records)
    console.log(summary)
  })
  .catch((error: Error) => {
    console.log(error)
  })

const result2: Result = session.run('RETURN 2')
result2.subscribe({})
result2.subscribe({
  onNext: (record: Record) => console.log(record)
})
result2.subscribe({
  onNext: (record: Record) => console.log(record),
  onError: (error: Error) => console.log(error)
})
result2.subscribe({
  onNext: (record: Record) => console.log(record),
  onError: (error: Error) => console.log(error),
  onCompleted: (summary: ResultSummary) => console.log(summary)
})

const result3: Result = session.run('RETURN $value', { value: '42' })
result3
  .then((res: QueryResult) => {
    const records: Record[] = res.records
    const summary: ResultSummary = res.summary
    console.log(records)
    console.log(summary)
  })
  .catch((error: Error) => {
    console.log(error)
  })

const result4: Result = session.run('RETURN $value', { value: '42' })
result4.subscribe({})
result4.subscribe({
  onNext: (record: Record) => console.log(record)
})
result4.subscribe({
  onNext: (record: Record) => console.log(record),
  onError: (error: Error) => console.log(error)
})
result4.subscribe({
  onNext: (record: Record) => console.log(record),
  onError: (error: Error) => console.log(error),
  onCompleted: (summary: ResultSummary) => console.log(summary)
})

const result5: Result = session.run('RETURN $value', { value: '42' }, txConfig1)
result5
  .then((res: QueryResult) => {
    const records: Record[] = res.records
    const summary: ResultSummary = res.summary
    console.log(records)
    console.log(summary)
  })
  .catch((error: Error) => {
    console.log(error)
  })

const result6: Result = session.run('RETURN $value', { value: '42' }, txConfig2)
result6.subscribe({})
result6.subscribe({
  onNext: (record: Record) => console.log(record)
})
result6.subscribe({
  onNext: (record: Record) => console.log(record),
  onError: (error: Error) => console.log(error)
})
result6.subscribe({
  onNext: (record: Record) => console.log(record),
  onError: (error: Error) => console.log(error),
  onCompleted: (summary: ResultSummary) => console.log(summary)
})

const tx2: Transaction = session.beginTransaction(txConfig2)
const promise5: Promise<string> = session.readTransaction(
  (tx: Transaction) => '',
  txConfig3
)
const promise6: Promise<number> = session.writeTransaction(
  (tx: Transaction) => 42,
  txConfig4
)

const lastBookmark: string[] = session.lastBookmark()
