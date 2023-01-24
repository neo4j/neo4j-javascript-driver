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

import Record, { Dict } from './record.ts'
import Result from './result.ts'
import EagerResult from './result-eager.ts'
import ResultSummary from './result-summary.ts'
import { newError } from './error.ts'

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

  /**
   * Creates a {@link ResultTransformer} which maps the {@link Record} in the result and collects it
   * along with the {@link ResultSummary} and {@link Result#keys}.
   *
   * NOTE: The config object requires map or/and collect to be valid.
   *
   * @example
   * // Mapping the records
   * const { keys, records, summary } = await driver.executeQuery('MATCH (p:Person{ age: $age }) RETURN p.name as name', { age: 25 }, {
   *   resultTransformer: neo4j.resultTransformers.mappedResultTransformer({
   *     map(record) {
   *        return record.get('name')
   *     }
   *   })
   * })
   *
   * records.forEach(name => console.log(`${name} has 25`))
   *
   * @example
   * // Mapping records and collect result
   * const names = await driver.executeQuery('MATCH (p:Person{ age: $age }) RETURN p.name as name', { age: 25 }, {
   *   resultTransformer: neo4j.resultTransformers.mappedResultTransformer({
   *     map(record) {
   *        return record.get('name')
   *     },
   *     collect(records, summary, keys) {
   *        return records
   *     }
   *   })
   * })
   *
   * names.forEach(name => console.log(`${name} has 25`))
   *
   * @example
   * // The transformer can be defined one and used everywhere
   * const getRecordsAsObjects = neo4j.resultTransformers.mappedResultTransformer({
   *   map(record) {
   *      return record.toObject()
   *   },
   *   collect(objects) {
   *      return objects
   *   }
   * })
   *
   * // The usage in a driver.executeQuery
   * const objects = await driver.executeQuery('MATCH (p:Person{ age: $age }) RETURN p.name as name', { age: 25 }, {
   *   resultTransformer: getRecordsAsObjects
   * })
   * objects.forEach(object => console.log(`${object.name} has 25`))
   *
   *
   * // The usage in session.executeRead
   * const objects = await session.executeRead(tx => getRecordsAsObjects(tx.run('MATCH (p:Person{ age: $age }) RETURN p.name as name')))
   * objects.forEach(object => console.log(`${object.name} has 25`))
   *
   * @experimental
   * @param {object} config The result transformer configuration
   * @param {function(record:Record):R} [config.map=function(record) {  return record }] Method called for mapping each record
   * @param {function(records:R[], summary:ResultSummary, keys:string[]):T} [config.collect=function(records, summary, keys) { return { records, summary, keys }}] Method called for mapping
   * the result data to the transformer output.
   * @returns {ResultTransformer<T>} The result transformer
   * @see {@link Driver#executeQuery}
   */
  mappedResultTransformer <
    R = Record, T = { records: R[], keys: string[], summary: ResultSummary }
  >(config: { map?: (rec: Record) => R, collect?: (records: R[], summary: ResultSummary, keys: string[]) => T }): ResultTransformer<T> {
    if (config == null || (config.collect == null && config.map == null)) {
      throw newError('Requires a map or/and a collect functions.')
    }
    return async (result: Result) => {
      return await new Promise((resolve, reject) => {
        const state: { keys: string[], records: R[] } = { records: [], keys: [] }

        result.subscribe({
          onKeys (keys: string[]) {
            state.keys = keys
          },
          onNext (record: Record) {
            if (config.map != null) {
              state.records.push(config.map(record))
            } else {
              state.records.push(record as unknown as R)
            }
          },
          onCompleted (summary: ResultSummary) {
            if (config.collect != null) {
              resolve(config.collect(state.records, summary, state.keys))
            } else {
              const obj = { records: state.records, summary, keys: state.keys }
              resolve(obj as unknown as T)
            }
          },
          onError (error: Error) {
            reject(error)
          }
        })
      })
    }
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
