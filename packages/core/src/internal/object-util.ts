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
// eslint-disable-next-line @typescript-eslint/naming-convention
const __isBrokenObject__ = '__isBrokenObject__'
// eslint-disable-next-line @typescript-eslint/naming-convention
const __reason__ = '__reason__'

/**
 * Creates a object on which all method calls will throw the given error
 *
 * @param {Error} error The error
 * @param {any} object The object. Default: {}
 * @returns {any} A broken object
 */
function createBrokenObject<T extends object> (error: Error, object: any = {}): T {
  const fail: <T>() => T = () => {
    throw error
  }

  return new Proxy(object, {
    get: (_: T, p: string | Symbol): any => {
      if (p === __isBrokenObject__) {
        return true
      } else if (p === __reason__) {
        return error
      } else if (p === 'toJSON') {
        return undefined
      }
      fail()
    },
    set: fail,
    apply: fail,
    construct: fail,
    defineProperty: fail,
    deleteProperty: fail,
    getOwnPropertyDescriptor: fail,
    getPrototypeOf: fail,
    has: fail,
    isExtensible: fail,
    ownKeys: fail,
    preventExtensions: fail,
    setPrototypeOf: fail
  })
}

/**
 * Verifies if it is a Broken Object
 * @param {any} object The object
 * @returns {boolean} If it was created with createBrokenObject
 */
function isBrokenObject (object: any): boolean {
  return object !== null && typeof object === 'object' && object[__isBrokenObject__] === true
}

/**
 * Returns if the reason the object is broken.
 *
 * This method should only be called with instances create with {@link createBrokenObject}
 *
 * @param {any} object The object
 * @returns {Error} The reason the object is broken
 */
function getBrokenObjectReason (object: any): Error {
  return object[__reason__]
}

export {
  createBrokenObject,
  isBrokenObject,
  getBrokenObjectReason
}
