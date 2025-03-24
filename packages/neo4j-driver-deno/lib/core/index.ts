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
  newGQLError,
  GQLError,
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
import Record, { RecordShape } from './record.ts'
import { isPoint, Point } from './spatial-types.ts'
import ResultSummary, {
  queryType,
  ServerInfo,
  Plan,
  ProfiledPlan,
  QueryStatistics,
  Stats
} from './result-summary.ts'
import Notification, {
  NotificationPosition,
  NotificationSeverityLevel,
  NotificationClassification,
  NotificationCategory,
  GqlStatusObject,
  notificationCategory,
  notificationClassification,
  notificationSeverityLevel
} from './notification.ts'
import NotificationFilter, {
  notificationFilterDisabledCategory,
  NotificationFilterDisabledCategory,
  notificationFilterDisabledClassification,
  NotificationFilterDisabledClassification,
  notificationFilterMinimumSeverityLevel,
  NotificationFilterMinimumSeverityLevel
} from './notification-filter.ts'
import Result, { QueryResult, ResultObserver } from './result.ts'
import EagerResult from './result-eager.ts'
import ConnectionProvider, { Releasable } from './connection-provider.ts'
import Connection from './connection.ts'
import Transaction from './transaction.ts'
import ManagedTransaction from './transaction-managed.ts'
import TransactionPromise from './transaction-promise.ts'
import Session, { TransactionConfig } from './session.ts'
import Driver, * as driver from './driver.ts'
import auth from './auth.ts'
import BookmarkManager, { BookmarkManagerConfig, bookmarkManager } from './bookmark-manager.ts'
import AuthTokenManager, { authTokenManagers, AuthTokenManagers, staticAuthTokenManager, AuthTokenAndExpiration } from './auth-token-manager.ts'
import { SessionConfig, QueryConfig, RoutingControl, routing } from './driver.ts'
import { Config } from './types.ts'
import * as types from './types.ts'
import * as json from './json.ts'
import resultTransformers, { ResultTransformer } from './result-transformers.ts'
import ClientCertificate, { clientCertificateProviders, ClientCertificateProvider, ClientCertificateProviders, RotatingClientCertificateProvider, resolveCertificateProvider } from './client-certificate.ts'
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
  authTokenManagers,
  newError,
  Neo4jError,
  newGQLError,
  GQLError,
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
  GqlStatusObject,
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
  Releasable,
  types,
  driver,
  json,
  auth,
  bookmarkManager,
  routing,
  resultTransformers,
  notificationCategory,
  notificationClassification,
  notificationSeverityLevel,
  notificationFilterDisabledCategory,
  notificationFilterDisabledClassification,
  notificationFilterMinimumSeverityLevel,
  clientCertificateProviders,
  resolveCertificateProvider
}

export {
  authTokenManagers,
  newError,
  Neo4jError,
  newGQLError,
  GQLError,
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
  GqlStatusObject,
  Plan,
  ProfiledPlan,
  QueryStatistics,
  Stats,
  Result,
  EagerResult,
  ConnectionProvider,
  Releasable,
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
  notificationClassification,
  notificationSeverityLevel,
  notificationFilterDisabledCategory,
  notificationFilterDisabledClassification,
  notificationFilterMinimumSeverityLevel,
  clientCertificateProviders,
  resolveCertificateProvider
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
  NotificationClassification,
  NotificationSeverityLevel,
  NotificationFilter,
  NotificationFilterDisabledCategory,
  NotificationFilterDisabledClassification,
  NotificationFilterMinimumSeverityLevel,
  ClientCertificate,
  ClientCertificateProvider,
  ClientCertificateProviders,
  RotatingClientCertificateProvider
}

export default forExport
