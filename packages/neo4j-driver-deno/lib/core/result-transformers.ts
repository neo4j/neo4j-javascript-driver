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

import Record, { RecordShape } from './record.ts'
import Result from './result.ts'
import EagerResult from './result-eager.ts'
import ResultSummary from './result-summary.ts'
import { newError } from './error.ts'
import { NumberOrInteger } from './graph-types.ts'
import Integer from './integer.ts'

type ResultTransformer<T> = (result: Result) => Promise<T>
/**
 * Protocol for transforming {@link Result}.
 *
 * @typedef {function<T>(result:Result):Promise<T>} ResultTransformer
 * @interface
 *
 * @see {@link resultTransformers} for provided implementations.
 * @see {@link Driver#executeQuery} for usage.
 */
/**
 * Defines the object which holds the common {@link ResultTransformer} used with {@link Driver#executeQuery}.
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
   * // is equivalent to:
   * const { keys, records, summary } = await driver.executeQuery('CREATE (p:Person{ name: $name }) RETURN p', { name: 'Person1'})
   *
   * @returns {ResultTransformer<EagerResult<Entries>>} The result transformer
   */
  eagerResultTransformer<Entries extends RecordShape = RecordShape>(): ResultTransformer<EagerResult<Entries>> {
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
   * @param {object} config The result transformer configuration
   * @param {function(record:Record):R} [config.map=function(record) {  return record }] Method called for mapping each record
   * @param {function(records:R[], summary:ResultSummary, keys:string[]):T} [config.collect=function(records, summary, keys) { return { records, summary, keys }}] Method called for mapping
   * the result data to the transformer output.
   * @returns {ResultTransformer<T>} The result transformer
   * @see {@link Driver#executeQuery}
   */
  mappedResultTransformer <
    R = Record, T = { records: R[], keys: string[], summary: ResultSummary }
  >(config: { map?: (rec: Record) => R | undefined, collect?: (records: R[], summary: ResultSummary, keys: string[]) => T }): ResultTransformer<T> {
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
              const mappedRecord = config.map(record)
              if (mappedRecord !== undefined) {
                state.records.push(mappedRecord)
              }
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

  /**
   * Creates a {@link ResultTransformer} which collects the first record {@link Record} of {@link Result}
   * and discard the rest of the records, if existent.
   *
   * @example
   * // Using in executeQuery
   * const maybeFirstRecord = await driver.executeQuery('MATCH (p:Person{ age: $age }) RETURN p.name as name', { age: 25 }, {
   *   resultTransformer: neo4j.resultTransformers.first()
   * })
   *
   * @example
   * // Using in other results
   * const record = await neo4j.resultTransformers.first()(result)
   *
   *
   * @template Entries The shape of the record.
   * @returns {ResultTransformer<Record<Entries>|undefined>} The result transformer
   * @see {@link Driver#executeQuery}
   * @experimental This is a preview feature.
   * @since 5.22.0
   */
  first<Entries extends RecordShape = RecordShape>(): ResultTransformer<Record<Entries> | undefined> {
    return first
  }

  /**
   * Creates a {@link ResultTransformer} which consumes the result and returns the {@link ResultSummary}.
   *
   * This result transformer is a shortcut to `(result) => result.summary()`.
   *
   * @example
   * const summary = await driver.executeQuery('CREATE (p:Person{ name: $name }) RETURN p', { name: 'Person1'}, {
   *   resultTransformer: neo4j.resultTransformers.summary()
   * })
   *
   * @returns {ResultTransformer<ResultSummary<T>>} The result transformer
   * @see {@link Driver#executeQuery}
   * @experimental This is a preview feature
   */
  summary <T extends NumberOrInteger = Integer> (): ResultTransformer<ResultSummary<T>> {
    return summary
  }
}

/**
 * Holds the common {@link ResultTransformer} used with {@link Driver#executeQuery}.
 */
const resultTransformers = new ResultTransformers()

Object.freeze(resultTransformers)

export default resultTransformers

export type {
  ResultTransformer
}

async function createEagerResultFromResult<Entries extends RecordShape> (result: Result): Promise<EagerResult<Entries>> {
  const { summary, records } = await result
  const keys = await result.keys()
  return new EagerResult<Entries>(keys, records, summary)
}

async function first<Entries extends RecordShape> (result: Result): Promise<Record<Entries> | undefined> {
  // The async iterator is not used in the for await fashion
  // because the transpiler is generating a code which
  // doesn't call it.return when break the loop
  // causing the method hanging when fetchSize > recordNumber.
  const it = result[Symbol.asyncIterator]()
  const { value, done } = await it.next()

  try {
    if (done === true) {
      return undefined
    }
    return value
  } finally {
    if (it.return != null) {
      await it.return()
    }
  }
}

async function summary<T extends NumberOrInteger = Integer> (result: Result): Promise<ResultSummary<T>> {
  return await result.summary()
}
