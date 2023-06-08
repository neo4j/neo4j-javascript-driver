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
  isRetriableError,
  PROTOCOL_ERROR,
  SERVICE_UNAVAILABLE,
  SESSION_EXPIRED
} from './error.ts'
import Integer, { int, isInt, inSafeRange, toNumber, toString } from './integer.ts'
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
} from './temporal-types.ts'
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
} from './graph-types.ts'
import Record from './record.ts'
import { isPoint, Point } from './spatial-types.ts'
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
} from './result-summary.ts'
import NotificationFilter, {
  notificationFilterDisabledCategory,
  NotificationFilterDisabledCategory,
  notificationFilterMinimumSeverityLevel,
  NotificationFilterMinimumSeverityLevel
} from './notification-filter.ts'
import Result, { QueryResult, ResultObserver } from './result.ts'
import EagerResult from './result-eager.ts'
import ConnectionProvider from './connection-provider.ts'
import Connection from './connection.ts'
import Transaction from './transaction.ts'
import ManagedTransaction from './transaction-managed.ts'
import TransactionPromise from './transaction-promise.ts'
import Session, { TransactionConfig } from './session.ts'
import Driver, * as driver from './driver.ts'
import auth from './auth.ts'
import BookmarkManager, { BookmarkManagerConfig, bookmarkManager } from './bookmark-manager.ts'
import AuthTokenManager, { expirationBasedAuthTokenManager, staticAuthTokenManager, isStaticAuthTokenManger, AuthTokenAndExpiration } from './auth-token-manager.ts'
import { SessionConfig, QueryConfig, RoutingControl, routing } from './driver.ts'
import { Config } from './types.ts'
import * as types from './types.ts'
import * as json from './json.ts'
import resultTransformers, { ResultTransformer } from './result-transformers.ts'
import * as internal from './internal/index.ts'

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
  expirationBasedAuthTokenManager,
  routing,
  resultTransformers,
  notificationCategory,
  notificationSeverityLevel,
  notificationFilterDisabledCategory,
  notificationFilterMinimumSeverityLevel
}

export {
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
  expirationBasedAuthTokenManager,
  staticAuthTokenManager,
  isStaticAuthTokenManger,
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
  AuthTokenAndExpiration,
  Config,
  SessionConfig,
  QueryConfig,
  RoutingControl,
  ResultTransformer,
  NotificationCategory,
  NotificationSeverityLevel,
  NotificationFilter,
  NotificationFilterDisabledCategory,
  NotificationFilterMinimumSeverityLevel
}

export default forExport
