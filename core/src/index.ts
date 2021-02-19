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

import {
  newError,
  Neo4jError,
  PROTOCOL_ERROR,
  SERVICE_UNAVAILABLE,
  SESSION_EXPIRED
} from './error'
import Integer, { int, isInt, inSafeRange, toNumber, toString } from './integer'
import {
  Date,
  DateTime,
  Duration,
  isDate,
  isDateTime,
  isDuration,
  isLocalDateTime,
  isLocalTime,
  isTime,
  LocalDateTime,
  LocalTime,
  Time
} from './temporal-types'
import {
  StandardDate,
  NumberOrInteger,
  Node,
  isNode,
  Relationship,
  isRelationship,
  UnboundRelationship,
  isUnboundRelationship,
  Path,
  isPath,
  PathSegment,
  isPathSegment
} from './graph-types'
import Record from './record'
import { isPoint, Point } from './spatial-types'
import * as internal from './internal' // todo: removed afterwards

/**
 * Object containing string constants representing predefined {@link Neo4jError} codes.
 */
const error = {
  SERVICE_UNAVAILABLE,
  SESSION_EXPIRED,
  PROTOCOL_ERROR
}

/**
 * @private
 */
const forExport = {
  newError,
  Neo4jError,
  error,
  Integer,
  int,
  isInt,
  inSafeRange,
  toNumber,
  toString,
  internal,
  isPoint,
  Point,
  Date,
  DateTime,
  Duration,
  isDate,
  isDateTime,
  isDuration,
  isLocalDateTime,
  isLocalTime,
  isTime,
  LocalDateTime,
  LocalTime,
  Time,
  Node,
  isNode,
  Relationship,
  isRelationship,
  UnboundRelationship,
  isUnboundRelationship,
  Path,
  isPath,
  PathSegment,
  isPathSegment,
  Record
}

export {
  newError,
  Neo4jError,
  error,
  Integer,
  int,
  isInt,
  inSafeRange,
  toNumber,
  toString,
  internal,
  isPoint,
  Point,
  Date,
  DateTime,
  Duration,
  isDate,
  isDateTime,
  isDuration,
  isLocalDateTime,
  isLocalTime,
  isTime,
  LocalDateTime,
  LocalTime,
  Time,
  StandardDate,
  NumberOrInteger,
  Node,
  isNode,
  Relationship,
  isRelationship,
  UnboundRelationship,
  isUnboundRelationship,
  Path,
  isPath,
  PathSegment,
  isPathSegment,
  Record
}

export default forExport
