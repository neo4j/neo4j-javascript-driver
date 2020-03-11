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

import Integer, { inSafeRange, int, isInt, toNumber, toString } from './integer'
import {
  Node,
  Path,
  PathSegment,
  Relationship,
  UnboundRelationship
} from './graph-types'
import { isPoint, Point } from './spatial-types'
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
  Neo4jError,
  PROTOCOL_ERROR,
  SERVICE_UNAVAILABLE,
  SESSION_EXPIRED
} from './error'
import Result, { ResultObserver, QueryResult } from './result'
import ResultSummary, {
  Notification,
  NotificationPosition,
  Plan,
  ProfiledPlan,
  ServerInfo,
  QueryStatistic
} from './result-summary'
import Record from './record'
import Session from './session'
import {
  Driver,
  READ,
  WRITE,
  AuthToken,
  Config,
  EncryptionLevel,
  TrustStrategy,
  SessionMode,
  LoggingConfig
} from './driver'
import Transaction from './transaction'
import { Parameters } from './query-runner'

declare const auth: {
  basic: (username: string, password: string, realm?: string) => AuthToken

  kerberos: (base64EncodedTicket: string) => AuthToken

  custom: (
    principal: string,
    credentials: string,
    realm: string,
    scheme: string,
    parameters?: Parameters
  ) => AuthToken
}

declare function driver(
  url: string,
  authToken?: AuthToken,
  config?: Config
): Driver

declare const types: {
  Node: Node
  Relationship: Relationship
  UnboundRelationship: UnboundRelationship
  PathSegment: PathSegment
  Path: Path
  Result: Result
  ResultSummary: ResultSummary
  Record: Record
  Point: typeof Point
  Date: typeof Date
  DateTime: typeof DateTime
  Duration: typeof Duration
  LocalDateTime: typeof LocalDateTime
  LocalTime: typeof LocalTime
  Time: typeof Time
  Integer: typeof Integer
}

declare const session: {
  READ: typeof READ
  WRITE: typeof WRITE
}

declare const error: {
  SERVICE_UNAVAILABLE: typeof SERVICE_UNAVAILABLE
  SESSION_EXPIRED: typeof SESSION_EXPIRED
  PROTOCOL_ERROR: typeof PROTOCOL_ERROR
}

declare const integer: {
  toNumber: typeof toNumber
  toString: typeof toString
  inSafeRange: typeof inSafeRange
}

declare const spatial: {
  isPoint: typeof isPoint
}

declare const temporal: {
  isDuration: typeof isDuration
  isLocalTime: typeof isLocalTime
  isTime: typeof isTime
  isDate: typeof isDate
  isLocalDateTime: typeof isLocalDateTime
  isDateTime: typeof isDateTime
}

/*
 Both default and non-default exports declare all visible types so that they can be used in client code like this:

 import neo4j from "neo4j-driver";
 const driver: neo4j.Driver = neo4j.driver("bolt://localhost");
 const session: neo4j.Session = driver.session();
 ...
*/

declare const forExport: {
  driver: typeof driver
  Driver: Driver
  EncryptionLevel: EncryptionLevel
  TrustStrategy: TrustStrategy
  SessionMode: SessionMode
  LoggingConfig: LoggingConfig
  int: typeof int
  isInt: typeof isInt
  isPoint: typeof isPoint
  isDuration: typeof isDuration
  isLocalTime: typeof isLocalTime
  isTime: typeof isTime
  isDate: typeof isDate
  isLocalDateTime: typeof isLocalDateTime
  isDateTime: typeof isDateTime
  integer: typeof integer
  Neo4jError: Neo4jError
  auth: typeof auth
  AuthToken: AuthToken
  types: typeof types
  session: typeof session
  error: typeof error
  spatial: typeof spatial
  temporal: typeof temporal
  Config: Config
}

export {
  driver,
  Driver,
  EncryptionLevel,
  TrustStrategy,
  SessionMode,
  LoggingConfig,
  int,
  isInt,
  isPoint,
  isDuration,
  isLocalTime,
  isTime,
  isDate,
  isLocalDateTime,
  isDateTime,
  integer,
  Neo4jError,
  auth,
  AuthToken,
  types,
  session,
  error,
  spatial,
  temporal,
  Config
}

export default forExport
