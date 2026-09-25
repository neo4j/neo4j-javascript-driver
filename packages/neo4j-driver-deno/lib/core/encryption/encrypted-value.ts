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

import Integer from '../integer.ts'

export class EncryptedValue {
  public cipherOutput: Int8Array
  public profileName: string
  public profileType: string
  public profileVersion: Integer
  public typeName: string
  public typeProtocolMajor: Integer
  public typeProtocolMinor: Integer
  public metadata: Record<string, any>
  constructor (
    cipherOutput: Int8Array,
    profileName: string,
    profileType: string,
    profileVersion: Integer,
    typeName: string,
    typeProtocolMajor: Integer,
    typeProtocolMinor: Integer,
    metadata: Record<string, any>

  ) {
    this.cipherOutput = cipherOutput
    this.profileName = profileName
    this.profileType = profileType
    this.profileVersion = profileVersion
    this.typeName = typeName
    this.typeProtocolMajor = typeProtocolMajor
    this.typeProtocolMinor = typeProtocolMinor
    this.metadata = {}
    Object.keys(metadata).sort().forEach((val) => { this.metadata[val] = metadata[val] })
  }

  /**
   * An indicator used to reliably determine if an object is a EncryptedValue or not.
   * @type {boolean}
   * @const
   * @expose
   * @private
   */
  static __isEncryptedValue__: boolean = true

  /**
   * Tests if the specified object is a EncryptedValue.
   * @access private
   * @param {*} obj Object
   * @returns {boolean}
   * @expose
   */
  static isEncryptedValue (obj: any): obj is EncryptedValue {
    return obj?.__isEncryptedValue__ === true
  }
}

Object.defineProperty(EncryptedValue.prototype, '__isEncryptedValue__', {
  value: true,
  enumerable: false,
  configurable: false
})

/**
 * Check if a variable is of EncryptedValue type.
 * @access public
 * @param {Mixed} value - The variable to check.
 * @return {Boolean} - Is it of the EncryptedValue type?
 */
export const isEnc = EncryptedValue.isEncryptedValue
