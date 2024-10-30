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

import ClientCertificate, { ClientCertificateProvider } from './client-certificate.ts'
import NotificationFilter from './notification-filter.ts'

/**
 * @private
 */
export type Query = string | String | { text: string, parameters?: any }

export type EncryptionLevel = 'ENCRYPTION_ON' | 'ENCRYPTION_OFF'

export type LogLevel = 'error' | 'warn' | 'info' | 'debug'

export type LoggerFunction = (level: LogLevel, message: string) => unknown

export type SessionMode = 'READ' | 'WRITE'

export interface LoggingConfig {
  level?: LogLevel
  logger: LoggerFunction
}

export type TrustStrategy =
  | 'TRUST_ALL_CERTIFICATES'
  | 'TRUST_CUSTOM_CA_SIGNED_CERTIFICATES'
  | 'TRUST_SYSTEM_CA_SIGNED_CERTIFICATES'

export interface Parameters { [key: string]: any }
export interface AuthToken {
  scheme: string
  principal?: string
  credentials: string
  realm?: string
  parameters?: Parameters
}

export interface BoltAgent {
  product?: string
  platform?: string
  language?: string
  languageDetails?: string
}

/**
 * The Neo4j Driver configuration.
 *
 * @interface
 */
export class Config {
  encrypted?: boolean | EncryptionLevel
  trust?: TrustStrategy
  trustedCertificates?: string[]
  knownHosts?: string
  fetchSize?: number
  maxConnectionPoolSize?: number
  maxTransactionRetryTime?: number
  maxConnectionLifetime?: number
  connectionAcquisitionTimeout?: number
  connectionLivenessCheckTimeout?: number
  connectionTimeout?: number
  disableLosslessIntegers?: boolean
  notificationFilter?: NotificationFilter
  useBigInt?: boolean
  logging?: LoggingConfig
  resolver?: (address: string) => string[] | Promise<string[]>
  userAgent?: string
  telemetryDisabled?: boolean
  clientCertificate?: ClientCertificate | ClientCertificateProvider

  /**
   * @constructor
   * @private
   */
  protected constructor () {
    /**
     * Encryption level
     *
     * @type {'ENCRYPTION_ON'|'ENCRYPTION_OFF'|undefined}
     */
    this.encrypted = undefined

    /**
     * Trust strategy to use if encryption is enabled.
     *
     * There is no mode to disable trust other than disabling encryption altogether. The reason for
     * this is that if you don't know who you are talking to, it is easy for an
     * attacker to hijack your encrypted connection, rendering encryption pointless.
     *
     * TRUST_SYSTEM_CA_SIGNED_CERTIFICATES is the default choice. For NodeJS environments, this
     * means that you trust whatever certificates are in the default trusted certificate
     * store of the underlying system. For Browser environments, the trusted certificate
     * store is usually managed by the browser. Refer to your system or browser documentation
     * if you want to explicitly add a certificate as trusted.
     *
     * TRUST_CUSTOM_CA_SIGNED_CERTIFICATES is another option for trust verification -
     * whenever we establish an encrypted connection, we ensure the host is using
     * an encryption certificate that is in, or is signed by, a certificate given
     * as trusted through configuration. This option is only available for NodeJS environments.
     *
     * TRUST_ALL_CERTIFICATES means that you trust everything without any verifications
     * steps carried out.  This option is only available for NodeJS environments and should not
     * be used on production systems.
     *
     * @type {'TRUST_SYSTEM_CA_SIGNED_CERTIFICATES'|'TRUST_CUSTOM_CA_SIGNED_CERTIFICATES'|'TRUST_ALL_CERTIFICATES'|undefined}
     */
    this.trust = undefined

    /**
     * List of one or more paths to trusted encryption certificates.
     *
     * This only works in the NodeJS bundle,
     * and only matters if you use "TRUST_CUSTOM_CA_SIGNED_CERTIFICATES".
     *
     * The certificate files should be in regular X.509 PEM format.
     *
     * For instance, ['./trusted.pem']
     *
     * @type {?string[]}
     * @see {@link Config#trust}
     */
    this.trustedCertificates = []

    /**
     * The maximum total number of connections allowed to be managed by the connection pool, per host.
     *
     * This includes both in-use and idle connections.
     *
     * **Default**: ```100```
     *
     * @type {number|undefined}
     */
    this.maxConnectionPoolSize = 100

    /**
     * The maximum allowed lifetime for a pooled connection in milliseconds.
     *
     * Pooled connections older than this
     * threshold will be closed and removed from the pool. Such discarding happens during connection acquisition
     * so that new session is never backed by an old connection. Setting this option to a low value will cause
     * a high connection churn and might result in a performance hit. It is recommended to set maximum lifetime
     * to a slightly smaller value than the one configured in network equipment (load balancer, proxy, firewall,
     * etc. can also limit maximum connection lifetime). No maximum lifetime limit is imposed by default. Zero
     * and negative values result in lifetime not being checked.
     *
     * **Default**: ```60 * 60 * 1000``` (1 hour)
     *
     * @type {number|undefined}
     */
    this.maxConnectionLifetime = 60 * 60 * 1000 // 1 hour

    /**
     * The maximum amount of time to wait to acquire a connection from the pool (to either create a new
     * connection or borrow an existing one).
     *
     * **Default**: ```60000``` (1 minute)
     *
     * @type {number|undefined}
     */
    this.connectionAcquisitionTimeout = 60000 // 1 minute

    /**
     * Specify the maximum time in milliseconds transactions are allowed to retry via
     * {@link Session#executeRead} and {@link Session#executeWrite} functions.
     *
     * These functions will retry the given unit of work on `ServiceUnavailable`, `SessionExpired` and transient
     * errors with exponential backoff using an initial delay of 1 second.
     *
     * **Default**: ```30000``` (30 seconds)
     *
     * @type {number|undefined}
     */
    this.maxTransactionRetryTime = 30000 // 30 seconds

    /**
     * Specify the maximum time in milliseconds the connection can be idle without needing
     * to perform a liveness check on acquire from the pool.
     *
     * Pooled connections that have been idle in the pool for longer than this
     * timeout will be tested before they are used again, to ensure they are still live.
     * If this option is set too low, an additional network call will be incurred
     * when acquiring a connection, which causes a performance hit.
     *
     * If this is set high, you may receive sessions that are backed by no longer
     * live connections, which will lead to exceptions in your application.
     * Assuming the database is running, these exceptions will go away if you retry
     * acquiring sessions.
     *
     * Hence, this parameter tunes a balance between the likelihood of your application
     * seeing connection problems, and performance.
     *
     * You normally should not need to tune this parameter. No connection liveliness
     * check is done by default. Value 0 means connections will always be tested for
     * validity and negative values mean connections will never be tested.
     *
     * **Default**: ```undefined``` (Disabled)
     *
     * @type {number|undefined}
     */
    this.connectionLivenessCheckTimeout = undefined // Disabled

    /**
     * Specify socket connection timeout in milliseconds.
     *
     * Negative and zero values result in no timeout being applied.
     * Connection establishment will be then bound by the timeout configured
     * on the operating system level.
     *
     * **Default**: ```30000``` (30 seconds)
     *
     * @type {number|undefined}
     */
    this.connectionTimeout = 30000 // 30 seconds

    /**
     * Make this driver always return native JavaScript numbers for integer values, instead of the
     * dedicated {@link Integer} class.
     *
     * Values that do not fit in native number bit range will be represented as `Number.NEGATIVE_INFINITY` or `Number.POSITIVE_INFINITY`.
     *
     * **Warning:** {@link ResultSummary} It is not always safe to enable this setting when JavaScript applications are not the only ones
     * interacting with the database. Stored numbers might in such case be not representable by native
     * `Number` type and thus the driver will return lossy values. This might also happen when data was
     * initially imported using neo4j import tool and contained numbers larger than
     * `Number.MAX_SAFE_INTEGER`. Driver will then return positive infinity, which is lossy.
     *
     * **Default**: ```false```
     *
     * Default value for this option is `false` because native JavaScript numbers might result
     * in loss of precision in the general case.
     *
     * @type {boolean|undefined}
     */
    this.disableLosslessIntegers = false

    /**
     * Make this driver always return native Javascript `BigInt` for integer values,
     * instead of the dedicated {@link Integer} class or `Number`.
     *
     * **Warning:** `BigInt` doesn't implement the method `toJSON`. To serialize it as `json`,
     * it's needed to add a custom implementation of the `toJSON` on the
     * `BigInt.prototype`. See https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/BigInt#use_within_json.
     *
     * **Default**: ```false``` (for backwards compatibility)
     *
     * @type {boolean|undefined}
     */
    this.useBigInt = false

    /**
     * Specify the logging configuration for the driver. Object should have two properties `level` and `logger`.
     *
     * Property `level` represents the logging level which should be one of: 'error', 'warn', 'info' or 'debug'. This property is optional and
     * its default value is 'info'. Levels have priorities: 'error': 0, 'warn': 1, 'info': 2, 'debug': 3. Enabling a certain level also enables all
     * levels with lower priority. For example: 'error', 'warn' and 'info' will be logged when 'info' level is configured.
     *
     * Property `logger` represents the logging function which will be invoked for every log call with an acceptable level. The function should
     * take two string arguments `level` and `message`. The function should not execute any blocking or long-running operations
     * because it is often executed on a hot path.
     *
     * No logging is done by default. See `neo4j.logging` object that contains predefined logging implementations.
     *
     * @type {LoggingConfig|undefined}
     * @see {@link logging}
     */
    this.logging = undefined

    /**
     * Specify a custom server address resolver function used by the routing driver to resolve the initial address used to create the driver.
     *
     * Such resolution happens:
     *   * during the very first rediscovery when driver is created
     *   * when all the known routers from the current routing table have failed and driver needs to fallback to the initial address
     *
     *  In NodeJS environment driver defaults to performing a DNS resolution of the initial address using 'dns' module.
     *  In browser environment driver uses the initial address as-is.
     *  Value should be a function that takes a single string argument - the initial address. It should return an array of new addresses.
     *  Address is a string of shape '<host>:<port>'. Provided function can return either a Promise resolved with an array of addresses
     *  or array of addresses directly.
     *
     * @type {function(address: string) {} |undefined}
     */
    this.resolver = undefined

    /**
     * Configure filter for Notification objects returned in {@link ResultSummary#notifications}.
     *
     * See {@link SessionConfig#notificationFilter} for usage instructions.
     *
     * @type {NotificationFilter|undefined}
     */
    this.notificationFilter = undefined

    /**
     * Optionally override the default user agent name.
     *
     * **Default**: ```'neo4j-javascript/<version>'```
     *
     * @type {string|undefined}
     */
    this.userAgent = undefined

    /**
     * Specify if telemetry collection is disabled.
     *
     * By default, the driver will send anonymous usage statistics to the server it connects to if the server requests those.
     * By setting ``telemetryDisabled=true``, the driver will not send any telemetry data.
     *
     * The driver transmits the following information:
     *
     * Every time one of the following APIs is used to execute a query (for the first time), the server is informed of this
     * (without any further information like arguments, client identifiers, etc.):
     *
     * * {@link Driver#executeQuery}
     * * {@link Session#run}
     * * {@link Session#beginTransaction}
     * * {@link Session#executeRead}
     * * {@link Session#executeWrite}
     * * {@link Session#writeTransaction}
     * * {@link Session#readTransaction}
     * * The reactive counterparts of methods above.
     *
     * Metrics are only collected when enabled both in server and driver instances.
     *
     * **Default**: ```false```
     *
     * @type {boolean}
     */
    this.telemetryDisabled = false

    /**
     * Client Certificate used for mutual TLS.
     *
     * A {@link ClientCertificateProvider} can be configure for scenarios
     * where the {@link ClientCertificate} might change over time.
     *
     * @type {ClientCertificate|ClientCertificateProvider|undefined}
     * @experimental Exposed as preview feature.
     * @since 5.19
     */
    this.clientCertificate = undefined
  }
}

export class InternalConfig extends Config {
  boltAgent?: BoltAgent
}

/**
 * Extension interface for {@link AsyncIterator} with peek capabilities.
 *
 * @public
 */
export interface PeekableAsyncIterator<T, TReturn = any, TNext = undefined> extends AsyncIterator<T, TReturn, TNext> {
  /**
   * Returns the next element in the iteration without advancing the iterator.
   *
   * @return {IteratorResult<T, TReturn>} The next element in the iteration.
   */
  peek: () => Promise<IteratorResult<T, TReturn>>
}
