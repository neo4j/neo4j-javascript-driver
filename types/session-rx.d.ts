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
import RxResult from './result-rx'
import RxTransaction from './transaction-rx'
import { TransactionConfig } from './session'
import { Parameters } from './query-runner'
import { Observable } from 'rxjs'

declare type RxTransactionWork<T> = (tx: RxTransaction) => Observable<T>

declare interface RxSession {
  run(
    query: string,
    parameters?: Parameters,
    config?: TransactionConfig
  ): RxResult

  beginTransaction(config?: TransactionConfig): Observable<RxTransaction>

  lastBookmark(): string | null

  readTransaction<T>(
    work: RxTransactionWork<T>,
    config?: TransactionConfig
  ): Observable<T>

  writeTransaction<T>(
    work: RxTransactionWork<T>,
    config?: TransactionConfig
  ): Observable<T>

  close(): Observable<any>
}

export default RxSession
