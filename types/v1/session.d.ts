/**
 * Copyright (c) 2002-2018 Neo4j Sweden AB [http://neo4j.com]
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

import Transaction from "./transaction";
import StatementRunner from "./statement-runner";

declare type TransactionWork<T> = (tx: Transaction) => T | Promise<T>;

declare interface Session extends StatementRunner {
  beginTransaction(): Transaction;

  lastBookmark(): string | null;

  readTransaction<T>(work: TransactionWork<T>): Promise<T>;

  writeTransaction<T>(work: TransactionWork<T>): Promise<T>;

  close(callback?: () => void): void;
}

export default Session;
