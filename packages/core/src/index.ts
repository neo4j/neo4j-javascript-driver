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
  newError,
  Neo4jError,
  isRetriableError,
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
import Record, { RecordShape } from './record'
import { isPoint, Point } from './spatial-types'
import ResultSummary, {
  queryType,
  ServerInfo,
  Notification,
  NotificationPosition,
  Plan,
  ProfiledPlan,
  QueryStatistics,
  Stats,
  NotificationSeverityLevel,
  NotificationCategory,
  notificationCategory,
  notificationSeverityLevel
} from './result-summary'
import NotificationFilter, {
  notificationFilterDisabledCategory,
  NotificationFilterDisabledCategory,
  notificationFilterMinimumSeverityLevel,
  NotificationFilterMinimumSeverityLevel
} from './notification-filter'
import Result, { QueryResult, ResultObserver } from './result'
import EagerResult from './result-eager'
import ConnectionProvider from './connection-provider'
import Connection from './connection'
import Transaction from './transaction'
import ManagedTransaction from './transaction-managed'
import TransactionPromise from './transaction-promise'
import Session, { TransactionConfig } from './session'
import Driver, * as driver from './driver'
import auth from './auth'
import BookmarkManager, { BookmarkManagerConfig, bookmarkManager } from './bookmark-manager'
import AuthTokenManager, { authTokenManagers, AuthTokenManagers, staticAuthTokenManager, AuthTokenAndExpiration } from './auth-token-manager'
import { SessionConfig, QueryConfig, RoutingControl, routing } from './driver'
import { Config } from './types'
import * as types from './types'
import * as json from './json'
import resultTransformers, { ResultTransformer } from './result-transformers'
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
  authTokenManagers,
  newError,
  Neo4jError,
  isRetriableError,
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
  Record,
  ResultSummary,
  queryType,
  ServerInfo,
  Notification,
  Plan,
  ProfiledPlan,
  QueryStatistics,
  Stats,
  Result,
  EagerResult,
  Transaction,
  ManagedTransaction,
  TransactionPromise,
  Session,
  Driver,
  Connection,
  types,
  driver,
  json,
  auth,
  bookmarkManager,
  routing,
  resultTransformers,
  notificationCategory,
  notificationSeverityLevel,
  notificationFilterDisabledCategory,
  notificationFilterMinimumSeverityLevel
}

export {
  authTokenManagers,
  newError,
  Neo4jError,
  isRetriableError,
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
  Record,
  ResultSummary,
  queryType,
  ServerInfo,
  Notification,
  Plan,
  ProfiledPlan,
  QueryStatistics,
  Stats,
  Result,
  EagerResult,
  ConnectionProvider,
  Connection,
  Transaction,
  ManagedTransaction,
  TransactionPromise,
  Session,
  Driver,
  types,
  driver,
  json,
  auth,
  bookmarkManager,
  staticAuthTokenManager,
  routing,
  resultTransformers,
  notificationCategory,
  notificationSeverityLevel,
  notificationFilterDisabledCategory,
  notificationFilterMinimumSeverityLevel
}

export type {
  StandardDate,
  NumberOrInteger,
  NotificationPosition,
  QueryResult,
  ResultObserver,
  TransactionConfig,
  BookmarkManager,
  BookmarkManagerConfig,
  AuthTokenManager,
  AuthTokenManagers,
  AuthTokenAndExpiration,
  Config,
  SessionConfig,
  QueryConfig,
  RoutingControl,
  RecordShape,
  ResultTransformer,
  NotificationCategory,
  NotificationSeverityLevel,
  NotificationFilter,
  NotificationFilterDisabledCategory,
  NotificationFilterMinimumSeverityLevel
}

export default forExport
