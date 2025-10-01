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

import { newError } from './error.ts'

const VECTOR_IDENTIFIER_PROPERTY = '__isVector__'

type EnumRecord<T extends string | symbol> = { [key in T]: key }

export type VectorType = 'INT8' | 'INT16' | 'INT32' | 'INT64' | 'FLOAT32' | 'FLOAT64'
/**
 * @typedef {'INT8' | 'INT16' | 'INT32' | 'INT64' | 'FLOAT32' | 'FLOAT64'} VectorType
 */
const vectorTypes: EnumRecord<VectorType> = {
  INT8: 'INT8',
  INT16: 'INT16',
  INT32: 'INT32',
  INT64: 'INT64',
  FLOAT32: 'FLOAT32',
  FLOAT64: 'FLOAT64'
}
Object.freeze(vectorTypes)

/**
 * A wrapper class for JavaScript TypedArrays that makes the driver send them as a Vector type to the database.
 * @access public
 * @exports Vector
 * @class A Vector class that wraps a JavaScript TypedArray to enable writing/reading the Neo4j Vector type.
 * @param {Float32Array | Float64Array | Int8Array | Int16Array | Int32Array | BigInt64Array} typedArray The TypedArray to convert to a vector
 *
 * @constructor
 *
 */
export default class Vector<K extends Float32Array | Float64Array | Int8Array | Int16Array | Int32Array | BigInt64Array> {
  _typedArray: K
  _type: VectorType
  constructor (typedArray: K) {
    if (typedArray instanceof Int8Array) {
      this._type = vectorTypes.INT8
    } else if (typedArray instanceof Int16Array) {
      this._type = vectorTypes.INT16
    } else if (typedArray instanceof Int32Array) {
      this._type = vectorTypes.INT32
    } else if (typedArray instanceof BigInt64Array) {
      this._type = vectorTypes.INT64
    } else if (typedArray instanceof Float32Array) {
      this._type = vectorTypes.FLOAT32
    } else if (typedArray instanceof Float64Array) {
      this._type = vectorTypes.FLOAT64
    } else {
      throw newError(`Invalid argument type passed to Vector constructor: should be signed integer or float TypedArray, got: ${(typedArray as any)?.constructor?.name as string ?? 'undefined or type without constructor name'}`)
    }
    this._typedArray = typedArray
  }

  /**
   * Converts the Vector back to a typedArray
   * @returns {Float32Array | Float64Array | Int8Array | Int16Array | Int32Array | BigInt64Array} - a TypedArray of the Vectors type.
   */
  asTypedArray (): K {
    return this._typedArray
  }

  /**
   * Gets the type of the Vector
   * @returns {VectorType} - The type of the vector, corresponding to the type of the wrapped TypedArray.
   */
  getType (): VectorType {
    return this._type
  }

  toString (): string {
    return `vector([${this._typedArray.join(', ')}], ${this._typedArray.length}, ${getTypeString(this._type)})`
  }
}

function getTypeString (type: VectorType): string {
  switch (type) {
    case 'INT8':
      return 'INTEGER8 NOT NULL'
    case 'INT16':
      return 'INTEGER16 NOT NULL'
    case 'INT32':
      return 'INTEGER32 NOT NULL'
    case 'INT64':
      return 'INTEGER NOT NULL'
    case 'FLOAT32':
      return 'FLOAT32 NOT NULL'
    case 'FLOAT64':
      return 'FLOAT NOT NULL'
    default:
      throw newError(`Cannot stringify vector with unsupported type. Got type: ${type as string}`)
  }
}

Object.defineProperty(Vector.prototype, VECTOR_IDENTIFIER_PROPERTY, {
  value: true,
  enumerable: false,
  configurable: false,
  writable: false
})

/**
 * Cast a TypedArray to a {@link Vector}
 * @access public
 * @param {Float32Array | Float64Array | Int8Array | Int16Array | Int32Array | BigInt64Array} typedArray - The value to use.
 * @return {Vector} - The Neo4j Vector ready to be used as a query parameter
 */
export function vector<K extends Float32Array | Float64Array | Int8Array | Int16Array | Int32Array | BigInt64Array> (typedArray: K): Vector<K> {
  try {
    return new Vector(typedArray)
  } catch {
    throw newError(`Invalid argument type passed to vector constructor function: should be signed integer or float TypedArray, got: ${typedArray?.constructor?.name ?? 'undefined or type without constructor name'}`)
  }
}

/**
 * Test if given object is an instance of the {@link Vector} class.
 * @param {Object} obj the object to test.
 * @return {boolean} `true` if given object is a {@link Vector}, `false` otherwise.
 */
export function isVector<K extends Float32Array | Float64Array | Int8Array | Int16Array | Int32Array | BigInt64Array> (obj: any): obj is Vector<K> {
  return obj != null && obj[VECTOR_IDENTIFIER_PROPERTY] === true
}
