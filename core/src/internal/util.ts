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

import Integer, { isInt } from '../integer'

const ENCRYPTION_ON: string = 'ENCRYPTION_ON'
const ENCRYPTION_OFF: string = 'ENCRYPTION_OFF'

/**
 * Verifies if the object is null or empty
 * @param obj The subject object
 * @returns {boolean} True if it's empty object or null
 */
function isEmptyObjectOrNull(obj?: any): boolean {
  if (obj === null) {
    return true
  }

  if (!isObject(obj)) {
    return false
  }

  for (const prop in obj) {
    if (Object.prototype.hasOwnProperty.bind(obj, prop)) {
      return false
    }
  }

  return true
}

/**
 * Verify if it's an object
 * @param obj The subject
 * @returns {boolean} True if it's an object
 */
function isObject(obj: any): boolean {
  return typeof obj === 'object' && !Array.isArray(obj) && obj !== null
}

/**
 * Check and normalize given query and parameters.
 * @param {string|{text: string, parameters: Object}} query the query to check.
 * @param {Object} parameters
 * @return {{validatedQuery: string|{text: string, parameters: Object}, params: Object}} the normalized query with parameters.
 * @throws TypeError when either given query or parameters are invalid.
 */
function validateQueryAndParameters(
  query: string | { text: string; parameters: Object },
  parameters: Object
): {
  validatedQuery: string | { text: string; parameters: Object }
  params: Object
} {
  let validatedQuery = query
  let params = parameters || {}

  if (typeof query === 'object' && query.text) {
    validatedQuery = query.text
    params = query.parameters || {}
  }

  assertCypherQuery(validatedQuery)
  assertQueryParameters(params)

  return { validatedQuery, params }
}

/**
 * Assert it's a object
 * @param {any} obj The subject
 * @param {string} objName The object name
 * @returns {object} The subject object
 * @throws {TypeError} when the supplied param is not an object
 */
function assertObject(obj: any, objName: string): Object {
  if (!isObject(obj)) {
    throw new TypeError(
      objName + ' expected to be an object but was: ' + JSON.stringify(obj)
    )
  }
  return obj
}

/**
 * Assert it's a string
 * @param {any} obj The subject
 * @param {string} objName The object name
 * @returns {string} The subject string
 * @throws {TypeError} when the supplied param is not a string
 */
function assertString(obj: any, objName: Object): string {
  if (!isString(obj)) {
    throw new TypeError(
      objName + ' expected to be string but was: ' + JSON.stringify(obj)
    )
  }
  return obj
}

/**
 * Assert it's a number
 * @param {any} obj The subject
 * @param {string} objName The object name
 * @returns {number} The number
 * @throws {TypeError} when the supplied param is not a number
 */
function assertNumber(obj: any, objName: string): Number {
  if (typeof obj !== 'number') {
    throw new TypeError(
      objName + ' expected to be a number but was: ' + JSON.stringify(obj)
    )
  }
  return obj
}

/**
 * Assert it's a number or integer
 * @param {any} obj The subject
 * @param {string} objName The object name
 * @returns {number|Integer} The subject object
 * @throws {TypeError} when the supplied param is not a number or integer
 */
function assertNumberOrInteger(obj: any, objName: string): number | Integer {
  if (typeof obj !== 'number' && !isInt(obj)) {
    throw new TypeError(
      objName +
        ' expected to be either a number or an Integer object but was: ' +
        JSON.stringify(obj)
    )
  }
  return obj
}

/**
 * Assert it's a valid datae
 * @param {any} obj The subject
 * @param {string} objName The object name
 * @returns {Date} The valida date
 * @throws {TypeError} when the supplied param is not a valid date
 */
function assertValidDate(obj: any, objName: string): Date {
  if (Object.prototype.toString.call(obj) !== '[object Date]') {
    throw new TypeError(
      objName +
        ' expected to be a standard JavaScript Date but was: ' +
        JSON.stringify(obj)
    )
  }
  if (Number.isNaN(obj.getTime())) {
    throw new TypeError(
      objName +
        ' expected to be valid JavaScript Date but its time was NaN: ' +
        JSON.stringify(obj)
    )
  }
  return obj
}

/**
 * Validates a cypher query string
 * @param {any} obj The query
 * @returns {void}
 * @throws {TypeError} if the query is not valid
 */
function assertCypherQuery(obj: any): void {
  assertString(obj, 'Cypher query')
  if (obj.trim().length === 0) {
    throw new TypeError('Cypher query is expected to be a non-empty string.')
  }
}

/**
 * Validates if the query parameters is an object
 * @param {any} obj The parameters
 * @returns {void}
 * @throws {TypeError} if the parameters is not valid
 */
function assertQueryParameters(obj: any): void {
  if (!isObject(obj)) {
    // objects created with `Object.create(null)` do not have a constructor property
    const constructor = obj.constructor ? ' ' + obj.constructor.name : ''
    throw new TypeError(
      `Query parameters are expected to either be undefined/null or an object, given:${constructor} ${obj}`
    )
  }
}

/**
 * Verify if the supplied object is a string
 *
 * @param str The string
 * @returns {boolean} True if the supplied object is an string
 */
function isString(str: any): boolean {
  return Object.prototype.toString.call(str) === '[object String]'
}

export {
  isEmptyObjectOrNull,
  isObject,
  isString,
  assertObject,
  assertString,
  assertNumber,
  assertNumberOrInteger,
  assertValidDate,
  validateQueryAndParameters,
  ENCRYPTION_ON,
  ENCRYPTION_OFF
}
