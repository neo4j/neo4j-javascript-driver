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

import { json } from '../../core/index.ts'

/**
 * Identity function.
 *
 * Identity functions are function which returns the input as output.
 *
 * @param {any} x
 * @returns {any} the x
 */
export function identity (x) {
  return x
}

/**
 * Makes the function able to share ongoing requests
 *
 * @param {function(...args): Promise} func The function to be decorated
 * @param {any} thisArg The `this` which should be used in the function call
 * @return {function(...args): Promise} The decorated function
 */
export function reuseOngoingRequest (func, thisArg = null) {
  const ongoingRequests = new Map()

  return function (...args) {
    const key = json.stringify(args)
    if (ongoingRequests.has(key)) {
      return ongoingRequests.get(key)
    }

    const promise = func.apply(thisArg, args)

    ongoingRequests.set(key, promise)

    return promise.finally(() => {
      ongoingRequests.delete(key)
    })
  }
}
