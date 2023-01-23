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

import { Dict } from './record.ts'
import Result from './result.ts'
import EagerResult from './result-eager.ts'

async function createEagerResultFromResult<Entries extends Dict> (result: Result): Promise<EagerResult<Entries>> {
  const { summary, records } = await result
  const keys = await result.keys()
  return new EagerResult<Entries>(keys, records, summary)
}

type ResultTransformer<T> = (result: Result) => Promise<T>
/**
 * Protocol for transforming {@link Result}.
 *
 * @typedef {function<T>(result:Result):Promise<T>} ResultTransformer
 * @interface
 * @experimental
 *
 * @see {@link resultTransformers} for provided implementations.
 * @see {@link Driver#executeQuery} for usage.
 *
 */
/**
 * Defines the object which holds the common {@link ResultTransformer} used with {@link Driver#executeQuery}.
 *
 * @experimental
 */
class ResultTransformers {
  /**
   * Creates a {@link ResultTransformer} which transforms {@link Result} to {@link EagerResult}
   * by consuming the whole stream.
   *
   * This is the default implementation used in {@link Driver#executeQuery}
   *
   * @example
   * // This:
   * const { keys, records, summary } = await driver.executeQuery('CREATE (p:Person{ name: $name }) RETURN p', { name: 'Person1'}, {
   *   resultTransformer: neo4j.resultTransformers.eagerResultTransformer()
   * })
   * // equivalent to:
   * const { keys, records, summary } = await driver.executeQuery('CREATE (p:Person{ name: $name }) RETURN p', { name: 'Person1'})
   *
   *
   * @experimental
   * @returns {ResultTransformer<EagerResult<Entries>>} The result transformer
   */
  eagerResultTransformer<Entries extends Dict = Dict>(): ResultTransformer<EagerResult<Entries>> {
    return createEagerResultFromResult
  }
}

/**
 * Holds the common {@link ResultTransformer} used with {@link Driver#executeQuery}.
 *
 * @experimental
 */
const resultTransformers = new ResultTransformers()

Object.freeze(resultTransformers)

export default resultTransformers

export type {
  ResultTransformer
}
