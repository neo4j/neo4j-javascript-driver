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
import VERSION from './version'
import { logging } from './logging'

import {
  auth,
  AuthTokenManagers,
  authTokenManagers,
  BookmarkManager,
  bookmarkManager,
  BookmarkManagerConfig,
  Connection,
  ConnectionProvider,
  Date,
  DateTime,
  Driver,
  driver as coreDriver,
  Duration,
  EagerResult,
  error,
  inSafeRange,
  int,
  Integer,
  internal,
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
  isTime,
  isUnboundRelationship,
  LocalDateTime,
  LocalTime,
  ManagedTransaction,
  Neo4jError,
  Node,
  Notification,
  notificationCategory,
  NotificationCategory,
  notificationClassification,
  NotificationClassification,
  NotificationFilter,
  NotificationFilterDisabledCategory,
  notificationFilterDisabledCategory,
  NotificationFilterDisabledClassification,
  notificationFilterDisabledClassification,
  AuthTokenManager,
  AuthTokenAndExpiration,
  staticAuthTokenManager,
  NotificationFilterMinimumSeverityLevel,
  notificationFilterMinimumSeverityLevel,
  NotificationPosition,
  notificationSeverityLevel,
  NotificationSeverityLevel,
  Path,
  PathSegment,
  Plan,
  Point,
  ProfiledPlan,
  QueryConfig,
  QueryResult,
  QueryStatistics,
  Record,
  RecordShape,
  Relationship,
  Result,
  ResultObserver,
  ResultSummary,
  ResultTransformer,
  resultTransformers,
  routing,
  RoutingControl,
  ServerInfo,
  Session,
  SessionConfig,
  Time,
  toNumber,
  toString,
  Transaction,
  TransactionPromise,
  types as coreTypes,
  UnboundRelationship,
  ClientCertificate,
  ClientCertificateProvider,
  ClientCertificateProviders,
  RotatingClientCertificateProvider,
  clientCertificateProviders,
  resolveCertificateProvider
} from 'neo4j-driver-core'
import { DirectConnectionProvider, RoutingConnectionProvider } from 'neo4j-driver-bolt-connection'

type AuthToken = coreTypes.AuthToken
type Config = coreTypes.Config
type InternalConfig = coreTypes.InternalConfig
type TrustStrategy = coreTypes.TrustStrategy
type EncryptionLevel = coreTypes.EncryptionLevel
type SessionMode = coreTypes.SessionMode
type Logger = internal.logger.Logger
type ConfiguredCustomResolver = internal.resolver.ConfiguredCustomResolver

const { READ, WRITE } = coreDriver

const {
  util: { ENCRYPTION_ON, assertString, isEmptyObjectOrNull },
  serverAddress: { ServerAddress },
  urlUtil
} = internal

const USER_AGENT = 'neo4j-javascript/' + VERSION

function isAuthTokenManager (value: unknown): value is AuthTokenManager {
  if (typeof value === 'object' &&
    value != null &&
    'getToken' in value &&
    'handleSecurityException' in value) {
    const manager = value as AuthTokenManager

    return typeof manager.getToken === 'function' &&
      typeof manager.handleSecurityException === 'function'
  }

  return false
}

function createAuthManager (authTokenOrProvider: AuthToken | AuthTokenManager): AuthTokenManager {
  if (isAuthTokenManager(authTokenOrProvider)) {
    return authTokenOrProvider
  }

  let authToken: AuthToken = authTokenOrProvider
  // Sanitize authority token. Nicer error from server when a scheme is set.
  authToken = authToken ?? {}
  authToken.scheme = authToken.scheme ?? 'none'
  return staticAuthTokenManager({ authToken })
}

/**
 * Construct a new Neo4j Driver. This is your main entry point for this
 * library.
 *
 * @param {string} url The URL for the Neo4j database, for instance "neo4j://localhost" and/or "bolt://localhost"
 * @param {Map<string,string>| function()} authToken Authentication credentials. See {@link auth} for helpers.
 * @param {Config} config Configuration object. See the configuration section above for details.
 * @returns {Driver}
 */
function driver (
  url: string,
  authToken: AuthToken | AuthTokenManager,
  config: Config = {}
): Driver {
  assertString(url, 'Bolt URL')
  const parsedUrl = urlUtil.parseDatabaseUrl(url)

  // enabling set boltAgent
  const _config = config as unknown as InternalConfig

  // Determine entryption/trust options from the URL.
  let routing = false
  let encrypted = false
  let trust: TrustStrategy | undefined
  switch (parsedUrl.scheme) {
    case 'bolt':
      break
    case 'bolt+s':
      encrypted = true
      trust = 'TRUST_SYSTEM_CA_SIGNED_CERTIFICATES'
      break
    case 'bolt+ssc':
      encrypted = true
      trust = 'TRUST_ALL_CERTIFICATES'
      break
    case 'neo4j':
      routing = true
      break
    case 'neo4j+s':
      encrypted = true
      trust = 'TRUST_SYSTEM_CA_SIGNED_CERTIFICATES'
      routing = true
      break
    case 'neo4j+ssc':
      encrypted = true
      trust = 'TRUST_ALL_CERTIFICATES'
      routing = true
      break
    default:
      throw new Error(`Unknown scheme: ${parsedUrl.scheme ?? 'null'}`)
  }

  // Encryption enabled on URL, propagate trust to the config.
  if (encrypted) {
    // Check for configuration conflict between URL and config.
    if ('encrypted' in _config || 'trust' in _config) {
      throw new Error(
        'Encryption/trust can only be configured either through URL or config, not both'
      )
    }
    _config.encrypted = ENCRYPTION_ON
    _config.trust = trust
    _config.clientCertificate = resolveCertificateProvider(config.clientCertificate)
  }

  const authTokenManager = createAuthManager(authToken)

  // Use default user agent or user agent specified by user.
  _config.userAgent = _config.userAgent ?? USER_AGENT
  _config.boltAgent = internal.boltAgent.fromVersion(VERSION)

  const address = ServerAddress.fromUrl(parsedUrl.hostAndPort)

  const meta = {
    address,
    typename: routing ? 'Routing' : 'Direct',
    routing
  }

  return new Driver(meta, _config, createConnectionProviderFunction())

  function createConnectionProviderFunction (): (id: number, config: Config, log: Logger, hostNameResolver: ConfiguredCustomResolver) => ConnectionProvider {
    if (routing) {
      return (
        id: number,
        config: InternalConfig,
        log: Logger,
        hostNameResolver: ConfiguredCustomResolver
      ): ConnectionProvider =>
        new RoutingConnectionProvider({
          id,
          config,
          log,
          hostNameResolver,
          authTokenManager,
          address,
          userAgent: config.userAgent,
          boltAgent: config.boltAgent,
          routingContext: parsedUrl.query
        })
    } else {
      if (!isEmptyObjectOrNull(parsedUrl.query)) {
        throw new Error(
          `Parameters are not supported with none routed scheme. Given URL: '${url}'`
        )
      }

      return (id: number, config: InternalConfig, log: Logger): ConnectionProvider =>
        new DirectConnectionProvider({
          id,
          config,
          log,
          authTokenManager,
          address,
          userAgent: config.userAgent,
          boltAgent: config.boltAgent
        })
    }
  }
}

/**
 * Verifies if the driver can reach a server at the given url.
 *
 * @experimental
 * @since 5.0.0
 * @param {string} url The URL for the Neo4j database, for instance "neo4j://localhost" and/or "bolt://localhost"
 * @param {Pick<Config, 'logging'>} config Configuration object. See the {@link driver}
 * @returns {true} When the server is reachable
 * @throws {Error} When the server is not reachable or the url is invalid
 */
async function hasReachableServer (url: string, config?: Pick<Config, 'logging'>): Promise<true> {
  const nonLoggedDriver = driver(url, { scheme: 'none', principal: '', credentials: '' }, config)
  try {
    await nonLoggedDriver.getNegotiatedProtocolVersion()
    return true
  } finally {
    await nonLoggedDriver.close()
  }
}

/**
 * Object containing constructors for all neo4j types.
 */
const types = {
  Node,
  Relationship,
  UnboundRelationship,
  PathSegment,
  Path,
  Result,
  EagerResult,
  ResultSummary,
  Record,
  Point,
  Date,
  DateTime,
  Duration,
  LocalDateTime,
  LocalTime,
  Time,
  Integer
}

/**
 * Object containing string constants representing session access modes.
 */
const session = {
  READ,
  WRITE
}

/**
 * Object containing functions to work with {@link Integer} objects.
 */
const integer = {
  toNumber,
  toString,
  inSafeRange
}

/**
 * Object containing functions to work with spatial types, like {@link Point}.
 */
const spatial = {
  isPoint
}

/**
 * Object containing functions to work with temporal types, like {@link Time} or {@link Duration}.
 */
const temporal = {
  isDuration,
  isLocalTime,
  isTime,
  isDate,
  isLocalDateTime,
  isDateTime
}

/**
 * Object containing functions to work with graph types, like {@link Node} or {@link Relationship}.
 */
const graph = {
  isNode,
  isPath,
  isPathSegment,
  isRelationship,
  isUnboundRelationship
}

/**
 * @private
 */
const forExport = {
  authTokenManagers,
  driver,
  hasReachableServer,
  int,
  isInt,
  isPoint,
  isDuration,
  isLocalTime,
  isTime,
  isDate,
  isLocalDateTime,
  isDateTime,
  isNode,
  isPath,
  isPathSegment,
  isRelationship,
  isUnboundRelationship,
  integer,
  Neo4jError,
  isRetriableError,
  auth,
  logging,
  types,
  session,
  routing,
  error,
  graph,
  spatial,
  temporal,
  Driver,
  Result,
  EagerResult,
  Record,
  ResultSummary,
  Node,
  Relationship,
  UnboundRelationship,
  PathSegment,
  Path,
  Integer,
  Plan,
  ProfiledPlan,
  QueryStatistics,
  Notification,
  ServerInfo,
  Session,
  Transaction,
  ManagedTransaction,
  TransactionPromise,
  Point,
  Duration,
  LocalTime,
  Time,
  Date,
  LocalDateTime,
  DateTime,
  ConnectionProvider,
  Connection,
  bookmarkManager,
  resultTransformers,
  notificationCategory,
  notificationClassification,
  notificationSeverityLevel,
  notificationFilterDisabledCategory,
  notificationFilterDisabledClassification,
  notificationFilterMinimumSeverityLevel,
  clientCertificateProviders
}

export {
  authTokenManagers,
  driver,
  hasReachableServer,
  int,
  isInt,
  isPoint,
  isDuration,
  isLocalTime,
  isTime,
  isDate,
  isLocalDateTime,
  isDateTime,
  isNode,
  isPath,
  isPathSegment,
  isRelationship,
  isUnboundRelationship,
  integer,
  Neo4jError,
  isRetriableError,
  auth,
  logging,
  types,
  session,
  routing,
  error,
  graph,
  spatial,
  temporal,
  Driver,
  Result,
  EagerResult,
  Record,
  ResultSummary,
  Node,
  Relationship,
  UnboundRelationship,
  PathSegment,
  Path,
  Integer,
  Plan,
  ProfiledPlan,
  QueryStatistics,
  Notification,
  ServerInfo,
  Session,
  Transaction,
  ManagedTransaction,
  TransactionPromise,
  Point,
  Duration,
  LocalTime,
  Time,
  Date,
  LocalDateTime,
  DateTime,
  ConnectionProvider,
  Connection,
  bookmarkManager,
  resultTransformers,
  notificationCategory,
  notificationClassification,
  notificationSeverityLevel,
  notificationFilterDisabledCategory,
  notificationFilterDisabledClassification,
  notificationFilterMinimumSeverityLevel,
  clientCertificateProviders
}
export type {
  QueryResult,
  AuthToken,
  AuthTokenManager,
  AuthTokenManagers,
  AuthTokenAndExpiration,
  Config,
  EncryptionLevel,
  TrustStrategy,
  SessionMode,
  ResultObserver,
  NotificationPosition,
  BookmarkManager,
  BookmarkManagerConfig,
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
