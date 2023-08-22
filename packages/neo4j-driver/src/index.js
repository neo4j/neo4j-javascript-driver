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
import { Driver, READ, WRITE } from './driver'
import VERSION from './version'

import {
  authTokenManagers,
  Neo4jError,
  isRetryableError,
  error,
  Integer,
  inSafeRange,
  int,
  isInt,
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
  isNode,
  isPath,
  isPathSegment,
  isRelationship,
  isTime,
  isUnboundRelationship,
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
  Plan,
  ProfiledPlan,
  QueryStatistics,
  Notification,
  ServerInfo,
  Result,
  EagerResult,
  auth,
  Session,
  Transaction,
  ManagedTransaction,
  bookmarkManager,
  routing,
  resultTransformers,
  notificationCategory,
  notificationSeverityLevel,
  notificationFilterDisabledCategory,
  notificationFilterMinimumSeverityLevel,
  staticAuthTokenManager
} from 'neo4j-driver-core'
import {
  DirectConnectionProvider,
  RoutingConnectionProvider
} from 'neo4j-driver-bolt-connection'

import RxSession from './session-rx'
import RxTransaction from './transaction-rx'
import RxManagedTransaction from './transaction-managed-rx'
import RxResult from './result-rx'

const {
  util: { ENCRYPTION_ON, assertString, isEmptyObjectOrNull },
  serverAddress: { ServerAddress },
  urlUtil
} = internal

const USER_AGENT = 'neo4j-javascript/' + VERSION

function isAuthTokenManager (value) {
  return typeof value === 'object' &&
    value != null &&
    'getToken' in value &&
    'handleSecurityException' in value &&
    typeof value.getToken === 'function' &&
    typeof value.handleSecurityException === 'function'
}

function createAuthManager (authTokenOrManager) {
  if (isAuthTokenManager(authTokenOrManager)) {
    return authTokenOrManager
  }

  let authToken = authTokenOrManager
  // Sanitize authority token. Nicer error from server when a scheme is set.
  authToken = authToken || {}
  authToken.scheme = authToken.scheme || 'none'
  return staticAuthTokenManager({ authToken })
}

/**
 * Construct a new Neo4j Driver. This is your main entry point for this
 * library.
 *
 * @param {string} url The URL for the Neo4j database, for instance "neo4j://localhost" and/or "bolt://localhost"
 * @param {Map<string,string>} authToken Authentication credentials. See {@link auth} for helpers.
 * @param {Config} config Configuration object.
 * @returns {Driver}
 */
function driver (url, authToken, config = {}) {
  assertString(url, 'Bolt URL')
  const parsedUrl = urlUtil.parseDatabaseUrl(url)

  // Determine encryption/trust options from the URL.
  let routing = false
  let encrypted = false
  let trust
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
      throw new Error(`Unknown scheme: ${parsedUrl.scheme}`)
  }

  // Encryption enabled on URL, propagate trust to the config.
  if (encrypted) {
    // Check for configuration conflict between URL and config.
    if ('encrypted' in config || 'trust' in config) {
      throw new Error(
        'Encryption/trust can only be configured either through URL or config, not both'
      )
    }
    config.encrypted = ENCRYPTION_ON
    config.trust = trust
  }

  const authTokenManager = createAuthManager(authToken)

  // Use default user agent or user agent specified by user.
  config.userAgent = config.userAgent || USER_AGENT
  config.boltAgent = internal.boltAgent.fromVersion('neo4j-javascript/' + VERSION)
  const address = ServerAddress.fromUrl(parsedUrl.hostAndPort)

  const meta = {
    address,
    typename: routing ? 'Routing' : 'Direct',
    routing
  }

  return new Driver(meta, config, createConnectionProviderFunction())

  function createConnectionProviderFunction () {
    if (routing) {
      return (id, config, log, hostNameResolver) =>
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

      return (id, config, log) =>
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
 * @param {object} config Configuration object. See the {@link driver}
 * @returns {true} When the server is reachable
 * @throws {Error} When the server is not reachable or the url is invalid
 */
async function hasReachableServer (url, config) {
  const nonLoggedDriver = driver(url, { scheme: 'none', principal: '', credentials: '' }, config)
  try {
    await nonLoggedDriver.getNegotiatedProtocolVersion()
    return true
  } finally {
    await nonLoggedDriver.close()
  }
}

/**
 * Object containing predefined logging configurations. These are expected to be used as values of the driver config's `logging` property.
 * @property {function(level: ?string): object} console the function to create a logging config that prints all messages to `console.log` with
 * timestamp, level and message. It takes an optional `level` parameter which represents the maximum log level to be logged. Default value is 'info'.
 */
const logging = {
  console: level => {
    return {
      level,
      logger: (level, message) =>
        console.log(`${global.Date.now()} ${level.toUpperCase()} ${message}`)
    }
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
  isRetryableError,
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
  Session,
  Transaction,
  ManagedTransaction,
  Result,
  EagerResult,
  RxSession,
  RxTransaction,
  RxManagedTransaction,
  RxResult,
  ResultSummary,
  Plan,
  ProfiledPlan,
  QueryStatistics,
  Notification,
  ServerInfo,
  Record,
  Node,
  Relationship,
  UnboundRelationship,
  Path,
  PathSegment,
  Point,
  Integer,
  Duration,
  LocalTime,
  Time,
  Date,
  LocalDateTime,
  DateTime,
  bookmarkManager,
  resultTransformers,
  notificationCategory,
  notificationSeverityLevel,
  notificationFilterDisabledCategory,
  notificationFilterMinimumSeverityLevel
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
  isRetryableError,
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
  Session,
  Transaction,
  ManagedTransaction,
  Result,
  EagerResult,
  RxSession,
  RxTransaction,
  RxManagedTransaction,
  RxResult,
  ResultSummary,
  Plan,
  ProfiledPlan,
  QueryStatistics,
  Notification,
  ServerInfo,
  Record,
  Node,
  Relationship,
  UnboundRelationship,
  Path,
  PathSegment,
  Point,
  Integer,
  Duration,
  LocalTime,
  Time,
  Date,
  LocalDateTime,
  DateTime,
  bookmarkManager,
  resultTransformers,
  notificationCategory,
  notificationSeverityLevel,
  notificationFilterDisabledCategory,
  notificationFilterMinimumSeverityLevel
}
export default forExport
