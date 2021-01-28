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

/**
 * Configuration object containing settings for explicit and auto-commit transactions.
 * <p>
 * Configuration is supported for:
 * <ul>
 *   <li>queries executed in auto-commit transactions using {@link Session#run} and {@link RxSession#run}</li>
 *   <li>transactions started by transaction functions using {@link Session#readTransaction}, {@link RxSession#readTransaction},
 * {@link Session#writeTransaction} and {@link RxSession#writeTransaction}</li>
 *   <li>explicit transactions using {@link Session#beginTransaction} and {@link RxSession#beginTransaction}</li>
 * </ul>
 * @typedef {Object} TransactionConfig
 * @property {number} timeout - the transaction timeout in **milliseconds**. Transactions that execute longer than the configured timeout will
 * be terminated by the database. This functionality allows to limit query/transaction execution time. Specified timeout overrides the default timeout
 * configured in the database using `dbms.transaction.timeout` setting. Value should not represent a duration of zero or negative duration.
 * @property {Object} metadata - the transaction metadata. Specified metadata will be attached to the executing transaction and visible in the output of
 * `dbms.listQueries` and `dbms.listTransactions` procedures. It will also get logged to the `query.log`. This functionality makes it easier to tag
 * transactions and is equivalent to `dbms.setTXMetaData` procedure.
 */
