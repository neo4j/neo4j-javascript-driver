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

/**
 * A representation of a value that could not be transmitted over the wire due to an outdated protocol version.
 * @access public
 * @exports UnknownType
 */
export default class UnknownType {
  name: string
  _minimumProtocolMajor: number
  _minimumProtocolMinor: number
  message: string | undefined
  constructor (name: string, minimumProtocolMajor: number, minimumProtocolMinor: number, message: string | undefined) {
    /**
     * The name of the type that could not be transmitted.
     *
     * @type {string}
     */
    this.name = name
    /**
     * The major version of the protocol needed to transmit the value.
     *
     * @type {number}
     * @access private
     */
    this._minimumProtocolMajor = minimumProtocolMajor
    /**
     * The minor version of the protocol needed to transmit the value.
     *
     * @type {number}
     * @access private
     */
    this._minimumProtocolMinor = minimumProtocolMinor
    /**
     * An optional message, including additional information regarding the untransmittable value.
     *
     * @type {string | undefined}
     */
    this.message = message
  }

  /**
   * @returns {string} The minimum version of the protocol needed to transmit this value.
   */
  minimumProtocolVersion (): string {
    return `${this._minimumProtocolMajor}.${this._minimumProtocolMinor}`
  }

  toString (): string {
    return `UnknownType<${this.name}>`
  }
}
