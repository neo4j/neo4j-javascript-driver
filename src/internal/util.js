/**
 * Copyright (c) 2002-2020 "Neo4j,"
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

import { isInt } from '../integer'

const ENCRYPTION_ON = 'ENCRYPTION_ON'
const ENCRYPTION_OFF = 'ENCRYPTION_OFF'

function isEmptyObjectOrNull (obj) {
  if (obj === null) {
    return true
  }

  if (!isObject(obj)) {
    return false
  }

  for (const prop in obj) {
    if (obj.hasOwnProperty(prop)) {
      return false
    }
  }

  return true
}

function isObject (obj) {
  return typeof obj === 'object' && !Array.isArray(obj) && obj !== null
}

/**
 * Check and normalize given query and parameters.
 * @param {string|{text: string, parameters: object}} query the query to check.
 * @param {Object} parameters
 * @return {{query: string, params: object}} the normalized query with parameters.
 * @throws TypeError when either given query or parameters are invalid.
 */
function validateQueryAndParameters (query, parameters) {
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

function assertObject (obj, objName) {
  if (!isObject(obj)) {
    throw new TypeError(
      objName + ' expected to be an object but was: ' + JSON.stringify(obj)
    )
  }
  return obj
}

function assertString (obj, objName) {
  if (!isString(obj)) {
    throw new TypeError(
      objName + ' expected to be string but was: ' + JSON.stringify(obj)
    )
  }
  return obj
}

function assertNumber (obj, objName) {
  if (typeof obj !== 'number') {
    throw new TypeError(
      objName + ' expected to be a number but was: ' + JSON.stringify(obj)
    )
  }
  return obj
}

function assertNumberOrInteger (obj, objName) {
  if (typeof obj !== 'number' && !isInt(obj)) {
    throw new TypeError(
      objName +
        ' expected to be either a number or an Integer object but was: ' +
        JSON.stringify(obj)
    )
  }
  return obj
}

function assertValidDate (obj, objName) {
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

function assertCypherQuery (obj) {
  assertString(obj, 'Cypher query')
  if (obj.trim().length === 0) {
    throw new TypeError('Cypher query is expected to be a non-empty string.')
  }
}

function assertQueryParameters (obj) {
  if (!isObject(obj)) {
    // objects created with `Object.create(null)` do not have a constructor property
    const constructor = obj.constructor ? ' ' + obj.constructor.name : ''
    throw new TypeError(
      `Query parameters are expected to either be undefined/null or an object, given:${constructor} ${obj}`
    )
  }
}

function isString (str) {
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
