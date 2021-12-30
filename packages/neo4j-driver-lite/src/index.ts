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
import VERSION from './version'
import { logging } from './logging'

import {
  Neo4jError,
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
  Result,
  ConnectionProvider,
  Driver,
  QueryResult,
  ResultObserver,
  Plan,
  ProfiledPlan,
  QueryStatistics,
  Notification,
  NotificationPosition,
  Session,
  Transaction,
  ServerInfo,
  Connection,
  driver as coreDriver,
  types as coreTypes,
  auth
} from 'neo4j-driver-core'
import {
  DirectConnectionProvider,
  RoutingConnectionProvider
} from 'neo4j-driver-bolt-connection'

type AuthToken = coreTypes.AuthToken
type Config = coreTypes.Config
type TrustStrategy = coreTypes.TrustStrategy
type EncryptionLevel = coreTypes.EncryptionLevel
type SessionMode = coreTypes.SessionMode
type Logger = internal.logger.Logger
type ConfiguredCustomResolver = internal.resolver.ConfiguredCustomResolver

const { READ, WRITE } = coreDriver

const {
  util: { ENCRYPTION_ON, ENCRYPTION_OFF, assertString, isEmptyObjectOrNull },
  serverAddress: { ServerAddress },
  urlUtil
} = internal

/**
 * Construct a new Neo4j Driver. This is your main entry point for this
 * library.
 *
 * ## Configuration
 *
 * This function optionally takes a configuration argument. Available configuration
 * options are as follows:
 *
 *     {
 *       // Encryption level: ENCRYPTION_ON or ENCRYPTION_OFF.
 *       encrypted: ENCRYPTION_ON|ENCRYPTION_OFF
 *
 *       // Trust strategy to use if encryption is enabled. There is no mode to disable
 *       // trust other than disabling encryption altogether. The reason for
 *       // this is that if you don't know who you are talking to, it is easy for an
 *       // attacker to hijack your encrypted connection, rendering encryption pointless.
 *       //
 *       // TRUST_SYSTEM_CA_SIGNED_CERTIFICATES is the default choice. For NodeJS environments, this
 *       // means that you trust whatever certificates are in the default trusted certificate
 *       // store of the underlying system. For Browser environments, the trusted certificate
 *       // store is usually managed by the browser. Refer to your system or browser documentation
 *       // if you want to explicitly add a certificate as trusted.
 *       //
 *       // TRUST_CUSTOM_CA_SIGNED_CERTIFICATES is another option for trust verification -
 *       // whenever we establish an encrypted connection, we ensure the host is using
 *       // an encryption certificate that is in, or is signed by, a certificate given
 *       // as trusted through configuration. This option is only available for NodeJS environments.
 *       //
 *       // TRUST_ALL_CERTIFICATES means that you trust everything without any verifications
 *       // steps carried out.  This option is only available for NodeJS environments and should not
 *       // be used on production systems.
 *       trust: "TRUST_SYSTEM_CA_SIGNED_CERTIFICATES" | "TRUST_CUSTOM_CA_SIGNED_CERTIFICATES" |
 *       "TRUST_ALL_CERTIFICATES",
 *
 *       // List of one or more paths to trusted encryption certificates. This only
 *       // works in the NodeJS bundle, and only matters if you use "TRUST_CUSTOM_CA_SIGNED_CERTIFICATES".
 *       // The certificate files should be in regular X.509 PEM format.
 *       // For instance, ['./trusted.pem']
 *       trustedCertificates: [],
 *
 *       // The maximum total number of connections allowed to be managed by the connection pool, per host.
 *       // This includes both in-use and idle connections. No maximum connection pool size is imposed
 *       // by default.
 *       maxConnectionPoolSize: 100,
 *
 *       // The maximum allowed lifetime for a pooled connection in milliseconds. Pooled connections older than this
 *       // threshold will be closed and removed from the pool. Such discarding happens during connection acquisition
 *       // so that new session is never backed by an old connection. Setting this option to a low value will cause
 *       // a high connection churn and might result in a performance hit. It is recommended to set maximum lifetime
 *       // to a slightly smaller value than the one configured in network equipment (load balancer, proxy, firewall,
 *       // etc. can also limit maximum connection lifetime). No maximum lifetime limit is imposed by default. Zero
 *       // and negative values result in lifetime not being checked.
 *       maxConnectionLifetime: 60 * 60 * 1000, // 1 hour
 *
 *       // The maximum amount of time to wait to acquire a connection from the pool (to either create a new
 *       // connection or borrow an existing one.
 *       connectionAcquisitionTimeout: 60000, // 1 minute
 *
 *       // Specify the maximum time in milliseconds transactions are allowed to retry via
 *       // `Session#readTransaction()` and `Session#writeTransaction()` functions.
 *       // These functions will retry the given unit of work on `ServiceUnavailable`, `SessionExpired` and transient
 *       // errors with exponential backoff using initial delay of 1 second.
 *       // Default value is 30000 which is 30 seconds.
 *       maxTransactionRetryTime: 30000, // 30 seconds
 *
 *       // Specify socket connection timeout in milliseconds. Numeric values are expected. Negative and zero values
 *       // result in no timeout being applied. Connection establishment will be then bound by the timeout configured
 *       // on the operating system level. Default value is 30000, which is 30 seconds.
 *       connectionTimeout: 30000, // 30 seconds
 *
 *       // Make this driver always return native JavaScript numbers for integer values, instead of the
 *       // dedicated {@link Integer} class. Values that do not fit in native number bit range will be represented as
 *       // `Number.NEGATIVE_INFINITY` or `Number.POSITIVE_INFINITY`.
 *       // **Warning:** ResultSummary It is not always safe to enable this setting when JavaScript applications are not the only ones
 *       // interacting with the database. Stored numbers might in such case be not representable by native
 *       // {@link Number} type and thus driver will return lossy values. This might also happen when data was
 *       // initially imported using neo4j import tool and contained numbers larger than
 *       // `Number.MAX_SAFE_INTEGER`. Driver will then return positive infinity, which is lossy.
 *       // Default value for this option is `false` because native JavaScript numbers might result
 *       // in loss of precision in the general case.
 *       disableLosslessIntegers: false,
 *
 *       // Make this driver always return native Javascript {@link BigInt} for integer values, instead of the dedicated {@link Integer} class or {@link Number}.
 *       //
 *       // Default value for this option is `false` for backwards compatibility.
 *       //
 *       // **Warning:** `BigInt` doesn't implement the method `toJSON`. In maner of serialize it as `json`, It's needed to add a custom implementation of the `toJSON` on the
 *       // `BigInt.prototype` {@see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/BigInt#use_within_json}
 *       useBigInt: false,
 *
 *       // Specify the logging configuration for the driver. Object should have two properties `level` and `logger`.
 *       //
 *       // Property `level` represents the logging level which should be one of: 'error', 'warn', 'info' or 'debug'. This property is optional and
 *       // its default value is 'info'. Levels have priorities: 'error': 0, 'warn': 1, 'info': 2, 'debug': 3. Enabling a certain level also enables all
 *       // levels with lower priority. For example: 'error', 'warn' and 'info' will be logged when 'info' level is configured.
 *       //
 *       // Property `logger` represents the logging function which will be invoked for every log call with an acceptable level. The function should
 *       // take two string arguments `level` and `message`. The function should not execute any blocking or long-running operations
 *       // because it is often executed on a hot path.
 *       //
 *       // No logging is done by default. See `neo4j.logging` object that contains predefined logging implementations.
 *       logging: {
 *         level: 'info',
 *         logger: (level, message) => console.log(level + ' ' + message)
 *       },
 *
 *       // Specify a custom server address resolver function used by the routing driver to resolve the initial address used to create the driver.
 *       // Such resolution happens:
 *       //  * during the very first rediscovery when driver is created
 *       //  * when all the known routers from the current routing table have failed and driver needs to fallback to the initial address
 *       //
 *       // In NodeJS environment driver defaults to performing a DNS resolution of the initial address using 'dns' module.
 *       // In browser environment driver uses the initial address as-is.
 *       // Value should be a function that takes a single string argument - the initial address. It should return an array of new addresses.
 *       // Address is a string of shape '<host>:<port>'. Provided function can return either a Promise resolved with an array of addresses
 *       // or array of addresses directly.
 *       resolver: function(address) {
 *         return ['127.0.0.1:8888', 'fallback.db.com:7687'];
 *       },
 *
 *      // Optionally override the default user agent name.
 *       userAgent: USER_AGENT
 *     }
 *
 * @param {string} url The URL for the Neo4j database, for instance "neo4j://localhost" and/or "bolt://localhost"
 * @param {Map<string,string>} authToken Authentication credentials. See {@link auth} for helpers.
 * @param {Object} config Configuration object. See the configuration section above for details.
 * @returns {Driver}
 */
function driver (
  url: string,
  authToken: AuthToken,
  config: Config = {}
): Driver {
  assertString(url, 'Bolt URL')
  const parsedUrl = urlUtil.parseDatabaseUrl(url)

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

  // Sanitize authority token. Nicer error from server when a scheme is set.
  authToken = authToken || {}
  authToken.scheme = authToken.scheme || 'none'

  // Use default user agent or user agent specified by user.
  config.userAgent = config.userAgent || USER_AGENT
  const address = ServerAddress.fromUrl(parsedUrl.hostAndPort)

  const meta = {
    address,
    typename: routing ? 'Routing' : 'Direct',
    routing
  }

  return new Driver(meta, config, createConnectionProviderFunction())

  function createConnectionProviderFunction () {
    if (routing) {
      return (
        id: number,
        config: Config,
        log: Logger,
        hostNameResolver: ConfiguredCustomResolver
      ): ConnectionProvider =>
        new RoutingConnectionProvider({
          id,
          config,
          log,
          hostNameResolver,
          authToken,
          address,
          userAgent: config.userAgent,
          routingContext: parsedUrl.query
        })
    } else {
      if (!isEmptyObjectOrNull(parsedUrl.query)) {
        throw new Error(
          `Parameters are not supported with none routed scheme. Given URL: '${url}'`
        )
      }

      return (id: number, config: Config, log: Logger): ConnectionProvider =>
        new DirectConnectionProvider({
          id,
          config,
          log,
          authToken,
          address,
          userAgent: config.userAgent
        })
    }
  }
}

const USER_AGENT: string = 'neo4j-javascript/' + VERSION

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
 * @private
 */
const forExport = {
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
  logging,
  types,
  session,
  error,
  spatial,
  temporal,
  Driver,
  Result,
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
  Point,
  Duration,
  LocalTime,
  Time,
  Date,
  LocalDateTime,
  DateTime,
  ConnectionProvider,
  Connection
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
  logging,
  types,
  session,
  error,
  spatial,
  temporal,
  Driver,
  Result,
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
  Point,
  Duration,
  LocalTime,
  Time,
  Date,
  LocalDateTime,
  DateTime,
  ConnectionProvider,
  Connection
}
export type {
  QueryResult,
  AuthToken,
  Config,
  EncryptionLevel,
  TrustStrategy,
  SessionMode,
  ResultObserver,
  NotificationPosition,
}
export default forExport
