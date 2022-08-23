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
  Neo4jError,
  isRetriableError,
  error,
  Integer,
  inSafeRange,
  int,
  isInt,
  toNumber,
  toString,
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
  Path,
  PathSegment,
  Relationship,
  UnboundRelationship,
  Record,
  ResultSummary,
  Notification,
  NotificationPosition,
  Plan,
  ProfiledPlan,
  ServerInfo,
  QueryStatistics,
  Result,
  ResultObserver,
  QueryResult,
  Transaction,
  ManagedTransaction,
  Session,
  ConnectionProvider,
  BookmarkManager,
  bookmarkManager,
  BookmarkManagerConfig,
  SessionConfig
} from 'neo4j-driver-core'
import {
  AuthToken,
  Config,
  Driver,
  EncryptionLevel,
  READ,
  SessionMode,
  TrustStrategy,
  WRITE
} from './driver'
import RxSession from './session-rx'
import RxTransaction from './transaction-rx'
import RxManagedTransaction from './transaction-managed-rx'
import RxResult from './result-rx'
import { Parameters } from './query-runner'

declare const auth: {
  basic: (username: string, password: string, realm?: string) => AuthToken

  kerberos: (base64EncodedTicket: string) => AuthToken

  bearer: (base64EncodedToken: string) => AuthToken

  custom: (
    principal: string,
    credentials: string,
    realm: string,
    scheme: string,
    parameters?: Parameters
  ) => AuthToken
}

declare function driver (
  url: string,
  authToken?: AuthToken,
  config?: Config
): Driver

declare function hasReachableServer (
  url: string,
  config?: Pick<Config, 'logging'>
): Promise<true>

declare const types: {
  Node: typeof Node
  Relationship: typeof Relationship
  UnboundRelationship: typeof UnboundRelationship
  PathSegment: typeof PathSegment
  Path: typeof Path
  Result: typeof Result
  ResultSummary: typeof ResultSummary
  Record: typeof Record
  Point: typeof Point
  Duration: typeof Duration
  LocalTime: typeof LocalTime
  Time: typeof Time
  Date: typeof Date
  LocalDateTime: typeof LocalDateTime
  DateTime: typeof DateTime
  Integer: typeof Integer
  RxSession: RxSession
  RxTransaction: RxTransaction
  RxManagedTransaction: RxManagedTransaction
  RxResult: RxResult
}

declare const session: {
  READ: typeof READ
  WRITE: typeof WRITE
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
  hasReachableServer: typeof hasReachableServer
  int: typeof int
  isInt: typeof isInt
  integer: typeof integer
  auth: typeof auth
  types: typeof types
  session: typeof session
  error: typeof error
  spatial: typeof spatial
  temporal: typeof temporal
  Driver: Driver
  AuthToken: AuthToken
  Config: Config
  EncryptionLevel: EncryptionLevel
  TrustStrategy: TrustStrategy
  SessionMode: SessionMode
  Neo4jError: Neo4jError
  isRetriableError: typeof isRetriableError
  Node: Node
  Relationship: Relationship
  UnboundRelationship: UnboundRelationship
  PathSegment: PathSegment
  Path: Path
  Integer: Integer
  Record: Record
  Result: Result
  QueryResult: QueryResult
  ResultObserver: ResultObserver
  ResultSummary: ResultSummary
  Plan: Plan
  ProfiledPlan: ProfiledPlan
  QueryStatistic: QueryStatistics
  Notification: Notification
  ServerInfo: ServerInfo
  NotificationPosition: NotificationPosition
  Session: Session
  Transaction: Transaction
  ManagedTransaction: ManagedTransaction
  Point: Point
  isPoint: typeof isPoint
  Duration: Duration
  LocalTime: LocalTime
  Time: Time
  Date: Date
  LocalDateTime: LocalDateTime
  DateTime: DateTime
  RxSession: RxSession
  RxTransaction: RxTransaction
  RxManagedTransaction: RxManagedTransaction
  RxResult: RxResult
  ConnectionProvider: ConnectionProvider
  isDuration: typeof isDuration
  isLocalTime: typeof isLocalTime
  isTime: typeof isTime
  isDate: typeof isDate
  isLocalDateTime: typeof isLocalDateTime
  isDateTime: typeof isDateTime
  bookmarkManager: typeof bookmarkManager
}

export {
  driver,
  hasReachableServer,
  int,
  isInt,
  integer,
  auth,
  types,
  session,
  error,
  spatial,
  temporal,
  Driver,
  AuthToken,
  Config,
  EncryptionLevel,
  TrustStrategy,
  SessionMode,
  Neo4jError,
  isRetriableError,
  Node,
  Relationship,
  UnboundRelationship,
  PathSegment,
  Path,
  Integer,
  Record,
  Result,
  QueryResult,
  ResultObserver,
  ResultSummary,
  Plan,
  ProfiledPlan,
  QueryStatistics,
  Notification,
  ServerInfo,
  NotificationPosition,
  Session,
  Transaction,
  ManagedTransaction,
  Point,
  isPoint,
  Duration,
  LocalTime,
  Time,
  Date,
  LocalDateTime,
  DateTime,
  RxSession,
  RxTransaction,
  RxManagedTransaction,
  RxResult,
  ConnectionProvider,
  isDuration,
  isLocalTime,
  isTime,
  isDate,
  isLocalDateTime,
  isDateTime,
  bookmarkManager
}

export type {
  BookmarkManager,
  BookmarkManagerConfig,
  SessionConfig
}

export default forExport
