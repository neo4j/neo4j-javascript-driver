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

import { newError } from './error'

const UUID_IDENTIFIER_PROPERTY = '__isUUID__'
const uuidV4DashLocations = [3, 5, 7, 9]

/**
 * Represents a Neo4j
 * @access public
 * @exports UUID
 * @class A class writing/reading the Neo4j UUID type as a Uint8Array.
 * @param { Uint8Array } typedArray A Uint8Array of length 16 representing the UUID
 */
export default class UUID {
  _typedArray: Uint8Array
  constructor (typedArray: Uint8Array) {
    if (typedArray.length !== 16) {
      throw newError(`Uint8Array representation of UUID must be of length 16, got ${typedArray.toString()}`)
    }
    this._typedArray = typedArray
  }

  /**
   * Returns the internal Uint8Array, note that modifying this will modify the UUID.
   *
   * @returns {Uint8Array} a Uint8Array of 16 bytes, representing the UUID.
   */
  getTypedArray (): Uint8Array {
    return this._typedArray
  }

  /**
   * @returns {string} The UUID encoded in base16 in the format xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
   */
  toString (): string {
    let string = ''
    for (let i = 0; i < this._typedArray.length; i++) {
      string += (('0' + this._typedArray[i].toString(16)).slice(-2))
      if (uuidV4DashLocations.indexOf(i) !== -1) {
        string += '-'
      }
    }
    return string
  }

  /**
   * Parses a string representation of a uuid and creates a {@link UUID} from it.
   *
   * @param {string} uuidString a base-16 encoded uuid string of the format xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx or without any dashes
   * @returns {UUID}
   */
  static fromString (uuidString: string): UUID {
    if (
      uuidString.match(/^[\da-fA-F]{32}$/) === null &&
      uuidString.match(/^[\da-fA-F]{8}-[\da-fA-F]{4}-[\da-fA-F]{4}-[\da-fA-F]{4}-[\da-fA-F]{12}$/) === null
    ) {
      throw newError(`UUID string base16 encoded should be of format xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx or without any dashes, got: ${uuidString}`)
    }
    uuidString = uuidString.replace(/-/g, '')
    const result = []
    for (let i = 0; i < uuidString.length; i += 2) {
      result.push(parseInt(uuidString.substring(i, i + 2), 16))
    }
    return new UUID(Uint8Array.from(result))
  }
}

Object.defineProperty(UUID.prototype, UUID_IDENTIFIER_PROPERTY, {
  value: true,
  enumerable: false,
  configurable: false,
  writable: false
})

export function uuid (rawUUID: Uint8Array | string): UUID {
  if (typeof rawUUID === 'string') {
    return UUID.fromString(rawUUID)
  }
  if (rawUUID instanceof Uint8Array) {
    return new UUID(rawUUID)
  }
  // @ts-expect-error
  throw newError(`Invalid argument type passed to UUID constructor function: expected Uint8Array or uuid string, got: ${rawUUID?.constructor?.name as string ?? 'undefined or type without constructor name'}`)
}

/**
 * Test if given object is an instance of the {@link Vector} class.
 * @param {Object} obj the object to test.
 * @return {boolean} `true` if given object is a {@link Vector}, `false` otherwise.
 */
export function isUUID (obj: any): obj is UUID {
  return obj != null && obj[UUID_IDENTIFIER_PROPERTY] === true
}
