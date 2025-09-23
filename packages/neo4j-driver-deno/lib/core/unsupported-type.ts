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

const UNSUPPORTED_TYPE_IDENTIFIER_PROPERTY = '__isUnsupportedType__'

/**
 * Represents a type unknown to the driver, received from the server.
 * This type is used for instance when a newer DBMS produces a result containing a type that the current version of the driver does not yet understand.
 *
 * Note that this type may only be received from the server, but cannot be sent to the server (e.g., as a query parameter).
 *
 * The attributes exposed by this type are meant for displaying and debugging purposes.
 * They may change in future versions of the server, and should not be relied upon for any logic in your application.
 * If your application requires handling this type, you must upgrade your driver to a version that supports it.
 * @access public
 * @exports UnsupportedType
 */
export default class UnsupportedType {
  name: string
  minimumProtocolVersion: string
  message: string | undefined
  constructor (name: string, minimumProtocolMajor: number, minimumProtocolMinor: number, message: string | undefined) {
    /**
     * The name of the type that could not be transmitted.
     *
     * @type {string}
     */
    this.name = name
    /**
     * The minimum required Bolt protocol version that supports this type.
     * To understand which driver version this corresponds to, refer to the driver's release notes or documentation.
     *
     * @type {string}
     */
    this.minimumProtocolVersion = `${minimumProtocolMajor}.${minimumProtocolMinor}`
    /**
     * An optional message, including additional information regarding the untransmittable value.
     *
     * @type {string | undefined}
     */
    this.message = message
  }

  toString (): string {
    return `UnsupportedType<${this.name}>`
  }
}

Object.defineProperty(UnsupportedType.prototype, UNSUPPORTED_TYPE_IDENTIFIER_PROPERTY, {
  value: true,
  enumerable: false,
  configurable: false,
  writable: false
})

/**
 * Test if given object is an instance of the {@link UnsupportedType} class.
 * @param {Object} obj the object to test.
 * @return {boolean} `true` if given object is an {@link UnsupportedType}, `false` otherwise.
 */
export function isUnsupportedType (obj: any): obj is UnsupportedType {
  return obj != null && obj[UNSUPPORTED_TYPE_IDENTIFIER_PROPERTY] === true
}
