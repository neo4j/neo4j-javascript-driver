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
  Duration: typeof Duration
  LocalTime: typeof LocalTime
  Time: typeof Time
  Date: typeof Date
  LocalDateTime: typeof LocalDateTime
  DateTime: typeof DateTime
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
  // logging, missing
  types: typeof types
  session: typeof session
  error: typeof error
  spatial: typeof spatial
  temporal: typeof temporal
  Driver: Driver // remove in next major. index.js does not export this
  AuthToken: AuthToken // remove in next major. index.js does not export this
  Config: Config // remove in next major. index.js does not export this
  EncryptionLevel: EncryptionLevel // remove in next major. index.js does not export this
  TrustStrategy: TrustStrategy // remove in next major. index.js does not export this
  SessionMode: SessionMode // remove in next major. index.js does not export this
  LoggingConfig: LoggingConfig // remove in next major. index.js does not export this
  Node: Node // remove in next major. index.js does not export this
  Relationship: Relationship // remove in next major. index.js does not export this
  UnboundRelationship: UnboundRelationship // remove in next major. index.js does not export this
  PathSegment: PathSegment // remove in next major. index.js does not export this
  Path: Path // remove in next major. index.js does not export this
  Integer: Integer // remove in next major. index.js does not export this
  Record: Record // remove in next major. index.js does not export this
  Result: Result // remove in next major. index.js does not export this
  QueryResult: QueryResult // remove in next major. index.js does not export this
  ResultObserver: ResultObserver // remove in next major. index.js does not export this
  ResultSummary: ResultSummary // remove in next major. index.js does not export this
  Plan: Plan // remove in next major. index.js does not export this
  ProfiledPlan: ProfiledPlan // remove in next major. index.js does not export this
  QueryStatistic: QueryStatistic // remove in next major. index.js does not export this
  Notification: Notification // remove in next major. index.js does not export this
  ServerInfo: ServerInfo // remove in next major. index.js does not export this
  NotificationPosition: NotificationPosition // remove in next major. index.js does not export this
  Session: Session // remove in next major. index.js does not export this
  Transaction: Transaction // remove in next major. index.js does not export this
  Point: Point // remove in next major. index.js does not export this
  Duration: Duration // remove in next major. index.js does not export this
  LocalTime: LocalTime // remove in next major. index.js does not export this
  Time: Time // remove in next major. index.js does not export this
  Date: Date // remove in next major. index.js does not export this
  LocalDateTime: LocalDateTime // remove in next major. index.js does not export this
  DateTime: DateTime // remove in next major. index.js does not export this
}

export {
  driver,
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
  // logging, missing
  types,
  session,
  error,
  spatial,
  temporal,
  Driver, // remove in next major. index.js does not export this
  AuthToken, // remove in next major. index.js does not export this
  Config, // remove in next major. index.js does not export this
  EncryptionLevel, // remove in next major. index.js does not export this
  TrustStrategy, // remove in next major. index.js does not export this
  SessionMode, // remove in next major. index.js does not export this
  Node, // remove in next major. index.js does not export this
  Relationship, // remove in next major. index.js does not export this
  UnboundRelationship, // remove in next major. index.js does not export this
  PathSegment, // remove in next major. index.js does not export this
  Path, // remove in next major. index.js does not export this
  Integer, // remove in next major. index.js does not export this
  Record, // remove in next major. index.js does not export this
  Result, // remove in next major. index.js does not export this
  QueryResult, // remove in next major. index.js does not export this
  ResultObserver, // remove in next major. index.js does not export this
  ResultSummary, // remove in next major. index.js does not export this
  Plan, // remove in next major. index.js does not export this
  ProfiledPlan, // remove in next major. index.js does not export this
  QueryStatistic, // remove in next major. index.js does not export this
  Notification, // remove in next major. index.js does not export this
  ServerInfo, // remove in next major. index.js does not export this
  NotificationPosition, // remove in next major. index.js does not export this
  Session, // remove in next major. index.js does not export this
  Transaction, // remove in next major. index.js does not export this
  Point, // remove in next major. index.js does not export this
  Duration, // remove in next major. index.js does not export this
  LocalTime, // remove in next major. index.js does not export this
  Time, // remove in next major. index.js does not export this
  Date, // remove in next major. index.js does not export this
  LocalDateTime, // remove in next major. index.js does not export this
  DateTime // remove in next major. index.js does not export this
}

export default forExport
