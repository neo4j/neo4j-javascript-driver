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

import Transaction from './transaction'
import QueryRunner, { Parameters } from './query-runner'
import Result from './result'
import { NumberOrInteger } from './graph-types'

declare type TransactionWork<T> = (tx: Transaction) => T | Promise<T>

declare interface TransactionConfig {
  timeout?: NumberOrInteger
  metadata?: object
}

declare interface Session extends QueryRunner {
  run(
    query: string,
    parameters?: Parameters,
    config?: TransactionConfig
  ): Result

  beginTransaction(config?: TransactionConfig): Transaction

  lastBookmark(): string | null

  readTransaction<T>(
    work: TransactionWork<T>,
    config?: TransactionConfig
  ): Promise<T>

  writeTransaction<T>(
    work: TransactionWork<T>,
    config?: TransactionConfig
  ): Promise<T>

  close(): Promise<void>
}

export { TransactionConfig }

export default Session
