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

import {
  authTokenManagers,
  AuthTokenManagers,
  Neo4jError,
  isRetriableError,
  isRetryableError,
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
  isNode,
  isPath,
  isPathSegment,
  isRelationship,
  isUnboundRelationship,
  isUnsupportedType,
  LocalDateTime,
  LocalTime,
  Time,
  Node,
  Path,
  PathSegment,
  Relationship,
  UnboundRelationship,
  Record,
  RecordShape,
  ResultSummary,
  Notification,
  GqlStatusObject,
  NotificationPosition,
  Plan,
  ProfiledPlan,
  ServerInfo,
  QueryStatistics,
  Result,
  EagerResult,
  ResultObserver,
  QueryResult,
  Transaction,
  ManagedTransaction,
  Session,
  BookmarkManager,
  bookmarkManager,
  BookmarkManagerConfig,
  SessionConfig,
  QueryConfig,
  RoutingControl,
  routing,
  resultTransformers,
  ResultTransformer,
  notificationCategory,
  notificationClassification,
  notificationSeverityLevel,
  NotificationCategory,
  NotificationClassification,
  NotificationSeverityLevel,
  NotificationFilter,
  NotificationFilterDisabledCategory,
  NotificationFilterDisabledClassification,
  NotificationFilterMinimumSeverityLevel,
  notificationFilterDisabledCategory,
  notificationFilterDisabledClassification,
  notificationFilterMinimumSeverityLevel,
  AuthTokenManager,
  AuthTokenAndExpiration,
  ClientCertificate,
  ClientCertificateProvider,
  ClientCertificateProviders,
  RotatingClientCertificateProvider,
  clientCertificateProviders,
  Rule,
  Rules,
  rule,
  RecordObjectMapping,
  StandardCase,
  MappedQueryResult,
  types as coreTypes,
  isVector,
  vector,
  Vector,
  mappingDecorators,
  ProtocolVersion,
  VectorType
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

/**
 * Object containing predefined logging configurations. These are expected to be used as values of the driver config's `logging` property.
 * @property {function(level: ?string): object} console the function to create a logging config that prints all messages to `console.log` with
 * timestamp, level and message. It takes an optional `level` parameter which represents the maximum log level to be logged. Default value is 'info'.
 */
declare const logging: {
  console: (level: coreTypes.LogLevel) => {
    level: coreTypes.LogLevel
    logger: (level: coreTypes.LogLevel, message: string) => void
  }
}

declare function driver (
  url: string,
  authToken?: AuthToken | AuthTokenManager,
  config?: Config
): Driver

declare function hasReachableServer (
  url: string,
  config?: Pick<Config, 'logging'>
): Promise<true>

declare const types: {
  Date: typeof Date
  DateTime: typeof DateTime
  Duration: typeof Duration
  EagerResult: typeof EagerResult
  Integer: typeof Integer
  LocalDateTime: typeof LocalDateTime
  LocalTime: typeof LocalTime
  Node: typeof Node
  Path: typeof Path
  PathSegment: typeof PathSegment
  Point: typeof Point
  Record: typeof Record
  Relationship: typeof Relationship
  Result: typeof Result
  ResultSummary: typeof ResultSummary
  RxManagedTransaction: typeof RxManagedTransaction
  RxResult: typeof RxResult
  RxSession: typeof RxSession
  RxTransaction: typeof RxTransaction
  Time: typeof Time
  UnboundRelationship: typeof UnboundRelationship
  Vector: typeof Vector
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

declare const graph: {
  isNode: typeof isNode
  isPath: typeof isPath
  isPathSegment: typeof isPathSegment
  isRelationship: typeof isRelationship
  isUnboundRelationship: typeof isUnboundRelationship
}

/*
 Both default and non-default exports declare all visible types so that they can be used in client code like this:

 import neo4j from "neo4j-driver";
 const driver: neo4j.Driver = neo4j.driver("bolt://localhost");
 const session: neo4j.Session = driver.session();
 ...
*/

declare const forExport: {
  auth: typeof auth
  AuthToken: AuthToken
  authTokenManagers: typeof authTokenManagers
  bookmarkManager: typeof bookmarkManager
  clientCertificateProviders: typeof clientCertificateProviders
  Config: Config
  Date: typeof Date
  DateTime: typeof DateTime
  Driver: typeof Driver
  driver: typeof driver
  Duration: typeof Duration
  EagerResult: typeof EagerResult
  EncryptionLevel: EncryptionLevel
  error: typeof error
  GqlStatusObject: typeof GqlStatusObject
  graph: typeof graph
  hasReachableServer: typeof hasReachableServer
  int: typeof int
  Integer: typeof Integer
  integer: typeof integer
  isDate: typeof isDate
  isDateTime: typeof isDateTime
  isDuration: typeof isDuration
  isInt: typeof isInt
  isLocalDateTime: typeof isLocalDateTime
  isLocalTime: typeof isLocalTime
  isNode: typeof isNode
  isPath: typeof isPath
  isPathSegment: typeof isPathSegment
  isPoint: typeof isPoint
  isRelationship: typeof isRelationship
  isRetriableError: typeof isRetriableError
  isRetryableError: typeof isRetryableError
  isTime: typeof isTime
  isUnboundRelationship: typeof isUnboundRelationship
  isUnsupportedType: typeof isUnsupportedType
  isVector: typeof isVector
  LocalDateTime: typeof LocalDateTime
  LocalTime: typeof LocalTime
  logging: typeof logging
  ManagedTransaction: typeof ManagedTransaction
  mappingDecorators: typeof mappingDecorators
  Neo4jError: typeof Neo4jError
  Node: typeof Node
  Notification: typeof Notification
  notificationCategory: typeof notificationCategory
  notificationClassification: typeof notificationClassification
  notificationFilterDisabledCategory: typeof notificationFilterDisabledCategory
  notificationFilterDisabledClassification: typeof notificationFilterDisabledClassification
  notificationFilterMinimumSeverityLevel: typeof notificationFilterMinimumSeverityLevel
  NotificationPosition: NotificationPosition
  notificationSeverityLevel: typeof notificationSeverityLevel
  Path: typeof Path
  PathSegment: typeof PathSegment
  Plan: typeof Plan
  Point: typeof Point
  ProfiledPlan: typeof ProfiledPlan
  QueryResult: QueryResult
  QueryStatistics: typeof QueryStatistics
  Record: typeof Record
  Relationship: typeof Relationship
  Result: typeof Result
  ResultObserver: ResultObserver
  ResultSummary: typeof ResultSummary
  resultTransformers: typeof resultTransformers
  routing: typeof routing
  RxManagedTransaction: typeof RxManagedTransaction
  RxResult: typeof RxResult
  RxSession: typeof RxSession
  RxTransaction: typeof RxTransaction
  ServerInfo: typeof ServerInfo
  Session: typeof Session
  session: typeof session
  SessionMode: SessionMode
  spatial: typeof spatial
  StandardCase: typeof StandardCase
  temporal: typeof temporal
  Time: typeof Time
  Transaction: typeof Transaction
  TrustStrategy: TrustStrategy
  types: typeof types
  UnboundRelationship: typeof UnboundRelationship
  Vector: typeof Vector
  vector: typeof vector
}

export {
  auth,
  authTokenManagers,
  bookmarkManager,
  clientCertificateProviders,
  Config,
  Date,
  DateTime,
  driver,
  Driver,
  Duration,
  EagerResult,
  error,
  GqlStatusObject,
  graph,
  hasReachableServer,
  int,
  integer,
  Integer,
  isDate,
  isDateTime,
  isDuration,
  isInt,
  isLocalDateTime,
  isLocalTime,
  isNode,
  isPath,
  isPathSegment,
  isPoint,
  isRelationship,
  isRetriableError,
  isRetryableError,
  isTime,
  isUnboundRelationship,
  isUnsupportedType,
  isVector,
  LocalDateTime,
  LocalTime,
  logging,
  ManagedTransaction,
  mappingDecorators,
  Neo4jError,
  Node,
  Notification,
  notificationCategory,
  notificationClassification,
  notificationFilterDisabledCategory,
  notificationFilterDisabledClassification,
  notificationFilterMinimumSeverityLevel,
  notificationSeverityLevel,
  Path,
  PathSegment,
  Plan,
  Point,
  ProfiledPlan,
  ProtocolVersion,
  QueryStatistics,
  Record,
  Relationship,
  Result,
  ResultSummary,
  resultTransformers,
  routing,
  rule,
  RxManagedTransaction,
  RxResult,
  RxSession,
  RxTransaction,
  ServerInfo,
  session,
  Session,
  spatial,
  temporal,
  Time,
  Transaction,
  types,
  UnboundRelationship,
  vector,
  Vector
}

export type {
  AuthToken,
  AuthTokenAndExpiration,
  AuthTokenManager,
  AuthTokenManagers,
  BookmarkManager,
  BookmarkManagerConfig,
  ClientCertificate,
  ClientCertificateProvider,
  ClientCertificateProviders,
  MappedQueryResult,
  NotificationCategory,
  NotificationClassification,
  NotificationFilter,
  NotificationFilterDisabledCategory,
  NotificationFilterDisabledClassification,
  NotificationFilterMinimumSeverityLevel,
  NotificationSeverityLevel,
  QueryConfig,
  RecordObjectMapping,
  RecordShape,
  ResultTransformer,
  RotatingClientCertificateProvider,
  RoutingControl,
  Rule,
  Rules,
  SessionConfig,
  StandardCase,
  VectorType
}

export default forExport
