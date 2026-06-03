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

const UUID_IDENTIFIER_PROPERTY = '__isUUID__'
const uuidV4DashLocations = [3, 5, 7, 9]

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
export default class UUID {
  _typedArray: Uint8Array
  constructor (typedArray: Uint8Array) {
    if (typedArray.length !== 16) {
      throw newError(`Uint8Array representation of UUID must be of length 16, got ${typedArray.toString()}`)
    }
    this._typedArray = typedArray
  }

  getTypedArray (): Uint8Array {
    return this._typedArray
  }

  toHexString (): string {
    console.log(this._typedArray)
    let string = ''
    for (let i = 0; i < this._typedArray.length; i++) {
      string += (('0' + this._typedArray[i].toString(16)).slice(-2))
      if (uuidV4DashLocations.indexOf(i) !== -1) {
        string += '-'
      }
    }
    console.log(string)
    return string
  }

  toString (): string {
    return this._typedArray.toString()
  }
}

Object.defineProperty(UUID.prototype, UUID_IDENTIFIER_PROPERTY, {
  value: true,
  enumerable: false,
  configurable: false,
  writable: false
})

export function uuid (typedArray: Uint8Array): UUID {
  return new UUID(typedArray)
}

/**
 * Test if given object is an instance of the {@link Vector} class.
 * @param {Object} obj the object to test.
 * @return {boolean} `true` if given object is a {@link Vector}, `false` otherwise.
 */
export function isUUID (obj: any): obj is UUID {
  return obj != null && obj[UUID_IDENTIFIER_PROPERTY] === true
}
