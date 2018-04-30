/**
 * Copyright (c) 2002-2018 Neo4j Sweden AB [http://neo4j.com]
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

const ENCRYPTION_ON = "ENCRYPTION_ON";
const ENCRYPTION_OFF = "ENCRYPTION_OFF";

function isEmptyObjectOrNull(obj) {
  if (obj === null) {
    return true;
  }

  if (!isObject(obj)) {
    return false;
  }

  for (let prop in obj) {
    if (obj.hasOwnProperty(prop)) {
      return false;
    }
  }

  return true;
}

function isObject(obj) {
  const type = typeof obj;
  return type === 'function' || type === 'object' && Boolean(obj);
}

function assertString(obj, objName) {
  if (!isString(obj)) {
    throw new TypeError(objName + ' expected to be string but was: ' + JSON.stringify(obj));
  }
  return obj;
}

function assertCypherStatement(obj) {
  assertString(obj, 'Cypher statement');
  if (obj.trim().length == 0) {
    throw new TypeError('Cypher statement is expected to be a non-empty string.');
  }
  return obj;
}

function isString(str) {
  return Object.prototype.toString.call(str) === '[object String]';
}

export {
  isEmptyObjectOrNull,
  isString,
  assertString,
  assertCypherStatement,
  ENCRYPTION_ON,
  ENCRYPTION_OFF
}
