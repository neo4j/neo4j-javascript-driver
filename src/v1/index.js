/**
 * Copyright (c) 2002-2019 "Neo4j,"
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

import Integer, {inSafeRange, int, isInt, toNumber, toString} from './integer';
import {Node, Path, PathSegment, Relationship, UnboundRelationship} from './graph-types';
import {Neo4jError, PROTOCOL_ERROR, SERVICE_UNAVAILABLE, SESSION_EXPIRED} from './error';
import Result from './result';
import ResultSummary from './result-summary';
import Record from './record';
import {Driver, READ, WRITE} from './driver';
import RoutingDriver from './routing-driver';
import VERSION from '../version';
import {assertString, isEmptyObjectOrNull} from './internal/util';
import urlUtil from './internal/url-util';
import HttpDriver from './internal/http/http-driver';
import {isPoint, Point} from './spatial-types';
import {Date, DateTime, Duration, isDate, isDateTime, isDuration, isLocalDateTime, isLocalTime, isTime, LocalDateTime, LocalTime, Time} from './temporal-types';
import ServerAddress from './internal/server-address';

/**
 * @property {function(username: string, password: string, realm: ?string)} basic the function to create a
 * basic authentication token.
 * @property {function(base64EncodedTicket: string)} kerberos the function to create a Kerberos authentication token.
 * Accepts a single string argument - base64 encoded Kerberos ticket.
 * @property {function(principal: string, credentials: string, realm: string, scheme: string, parameters: ?object)} custom
 * the function to create a custom authentication token.
 */
const auth = {
  basic: (username, password, realm = undefined) => {
    if (realm) {
      return {scheme: 'basic', principal: username, credentials: password, realm: realm};
    } else {
      return {scheme: 'basic', principal: username, credentials: password};
    }
  },
  kerberos: (base64EncodedTicket) => {
    return {
      scheme: 'kerberos',
      principal: '', // This empty string is required for backwards compatibility.
      credentials: base64EncodedTicket
    };
  },
  custom: (principal, credentials, realm, scheme, parameters = undefined) => {
    if (parameters) {
      return {
        scheme: scheme, principal: principal, credentials: credentials, realm: realm,
        parameters: parameters
      };
    } else {
      return {scheme: scheme, principal: principal, credentials: credentials, realm: realm};
    }
  }
};
const USER_AGENT = "neo4j-javascript/" + VERSION;

/**
 * Object containing predefined logging configurations. These are expected to be used as values of the driver config's `logging` property.
 * @property {function(level: ?string): object} console the function to create a logging config that prints all messages to `console.log` with
 * timestamp, level and message. It takes an optional `level` parameter which represents the maximum log level to be logged. Default value is 'info'.
 */
const logging = {
  console: level => {
    return {
      level: level,
      logger: (level, message) => console.log(`${global.Date.now()} ${level.toUpperCase()} ${message}`)
    };
  }
};

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
 *       // TRUST_ALL_CERTIFICATES is the default choice for NodeJS deployments. It only requires
 *       // new host to provide a certificate and does no verification of the provided certificate.
 *       //
 *       // TRUST_ON_FIRST_USE is available for modern NodeJS deployments, and works
 *       // similarly to how `ssl` works - the first time we connect to a new host,
 *       // we remember the certificate they use. If the certificate ever changes, we
 *       // assume it is an attempt to hijack the connection and require manual intervention.
 *       // This means that by default, connections "just work" while still giving you
 *       // good encrypted protection.
 *       //
 *       // TRUST_CUSTOM_CA_SIGNED_CERTIFICATES is the classic approach to trust verification -
 *       // whenever we establish an encrypted connection, we ensure the host is using
 *       // an encryption certificate that is in, or is signed by, a certificate listed
 *       // as trusted. In the web bundle, this list of trusted certificates is maintained
 *       // by the web browser. In NodeJS, you configure the list with the next config option.
 *       //
 *       // TRUST_SYSTEM_CA_SIGNED_CERTIFICATES means that you trust whatever certificates
 *       // are in the default certificate chain of th
 *       trust: "TRUST_ALL_CERTIFICATES" | "TRUST_ON_FIRST_USE" | "TRUST_SIGNED_CERTIFICATES" |
 *       "TRUST_CUSTOM_CA_SIGNED_CERTIFICATES" | "TRUST_SYSTEM_CA_SIGNED_CERTIFICATES",
 *
 *       // List of one or more paths to trusted encryption certificates. This only
 *       // works in the NodeJS bundle, and only matters if you use "TRUST_CUSTOM_CA_SIGNED_CERTIFICATES".
 *       // The certificate files should be in regular X.509 PEM format.
 *       // For instance, ['./trusted.pem']
 *       trustedCertificates: [],
 *
 *       // Path to a file where the driver saves hosts it has seen in the past, this is
 *       // very similar to the ssl tool's known_hosts file. Each time we connect to a
 *       // new host, a hash of their certificate is stored along with the domain name and
 *       // port, and this is then used to verify the host certificate does not change.
 *       // This setting has no effect unless TRUST_ON_FIRST_USE is enabled.
 *       knownHosts:"~/.neo4j/known_hosts",
 *
 *       // The max number of connections that are allowed idle in the pool at any time.
 *       // Connection will be destroyed if this threshold is exceeded.
 *       // **Deprecated:** please use `maxConnectionPoolSize` instead.
 *       connectionPoolSize: 100,
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
 *       // Provide an alternative load balancing strategy for the routing driver to use.
 *       // Driver uses "least_connected" by default.
 *       // **Note:** We are experimenting with different strategies. This could be removed in the next minor
 *       // version.
 *       loadBalancingStrategy: "least_connected" | "round_robin",
 *
 *       // Specify socket connection timeout in milliseconds. Numeric values are expected. Negative and zero values
 *       // result in no timeout being applied. Connection establishment will be then bound by the timeout configured
 *       // on the operating system level. Default value is 5000, which is 5 seconds.
 *       connectionTimeout: 5000, // 5 seconds
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
 *     }
 *
 * @param {string} url The URL for the Neo4j database, for instance "bolt://localhost"
 * @param {Map<String,String>} authToken Authentication credentials. See {@link auth} for helpers.
 * @param {Object} config Configuration object. See the configuration section above for details.
 * @returns {Driver}
 */
function driver(url, authToken, config = {}) {
  assertString(url, 'Bolt URL');
  const parsedUrl = urlUtil.parseDatabaseUrl(url);
  if (['bolt+routing', 'neo4j'].indexOf(parsedUrl.scheme) !== -1) {
    return new RoutingDriver(ServerAddress.fromUrl(parsedUrl.hostAndPort), parsedUrl.query, USER_AGENT, authToken, config);
  } else if (parsedUrl.scheme === 'bolt') {
    if (!isEmptyObjectOrNull(parsedUrl.query)) {
      throw new Error(`Parameters are not supported with scheme 'bolt'. Given URL: '${url}'`);
    }
    return new Driver(ServerAddress.fromUrl(parsedUrl.hostAndPort), USER_AGENT, authToken, config);
  } else if (parsedUrl.scheme === 'http' || parsedUrl.scheme === 'https') {
    return new HttpDriver(parsedUrl, USER_AGENT, authToken, config);
  } else {
    throw new Error(`Unknown scheme: ${parsedUrl.scheme}`);
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
};

/**
 * Object containing string constants representing session access modes.
 */
const session = {
  READ,
  WRITE
};

/**
 * Object containing string constants representing predefined {@link Neo4jError} codes.
 */
const error = {
  SERVICE_UNAVAILABLE,
  SESSION_EXPIRED,
  PROTOCOL_ERROR
};

/**
 * Object containing functions to work with {@link Integer} objects.
 */
const integer = {
  toNumber,
  toString,
  inSafeRange
};

/**
 * Object containing functions to work with spatial types, like {@link Point}.
 */
const spatial = {
  isPoint
};

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
};


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
  temporal
};

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
  temporal
};
export default forExport;
