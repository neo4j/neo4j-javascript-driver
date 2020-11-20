/**
 * Copyright (c) 2002-2020 "Neo4j,"
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
/** Types */
interface AuthToken {
  scheme: string
  principal: string
  credentials: string
  realm?: string
  parameters?: any
}
declare type EncryptionLevel = 'ENCRYPTION_ON' | 'ENCRYPTION_OFF'
declare type TrustStrategy =
  | 'TRUST_ALL_CERTIFICATES'
  | 'TRUST_CUSTOM_CA_SIGNED_CERTIFICATES'
  | 'TRUST_SYSTEM_CA_SIGNED_CERTIFICATES'
declare type LogLevel = 'error' | 'warn' | 'info' | 'debug'
interface LoggingConfig {
  level?: LogLevel
  logger: (level: LogLevel, message: string) => void
}
interface Config {
  encrypted?: boolean | EncryptionLevel
  trust?: TrustStrategy
  trustedCertificates?: string[]
  knownHosts?: string
  fetchSize?: number
  maxConnectionPoolSize?: number
  maxTransactionRetryTime?: number
  maxConnectionLifetime?: number
  connectionAcquisitionTimeout?: number
  connectionTimeout?: number
  disableLosslessIntegers?: boolean
  logging?: LoggingConfig
  resolver?: (address: string) => string[] | Promise<string[]>
  userAgent?: string
}
declare type SessionMode = 'READ' | 'WRITE'
/**
 * Constant that represents read session access mode.
 * Should be used like this: `driver.session({ defaultAccessMode: neo4j.session.READ })`.
 * @type {SessionMode}
 */
declare const READ: SessionMode
/**
 * Constant that represents write session access mode.
 * Should be used like this: `driver.session({ defaultAccessMode: neo4j.session.WRITE })`.
 * @type {SessionMode}
 */
declare const WRITE: SessionMode
interface VerifyConnectivityInput {
  database?: string
}
/**
 * A driver maintains one or more {@link Session}s with a remote
 * Neo4j instance. Through the {@link Session}s you can send queries
 * and retrieve results from the database.
 *
 * Drivers are reasonably expensive to create - you should strive to keep one
 * driver instance around per Neo4j Instance you connect to.
 *
 * @access public
 */
declare class Driver {
  private _id
  private _address
  private _userAgent
  private _authToken
  private _config
  private _log
  private _connectionProvider
  /**
   * You should not be calling this directly, instead use {@link driver}.
   * @constructor
   * @protected
   * @param {ServerAddress} address
   * @param {string} userAgent
   * @param {Object} authToken
   * @param {Object} config
   */
  constructor(
    address: any,
    userAgent: string,
    authToken: AuthToken,
    config?: Config
  )
  /**
   * Verifies connectivity of this driver by trying to open a connection with the provided driver options.
   *
   * @public
   * @param {Object} param - The object parameter
   * @param {string} param.database - The target database to verify connectivity for.
   * @returns {Promise<void>} promise resolved with server info or rejected with error.
   */
  verifyConnectivity({ database }?: VerifyConnectivityInput): Promise<any>
  /**
   * Returns whether the server supports multi database capabilities based on the protocol
   * version negotiated via handshake.
   *
   * Note that this function call _always_ causes a round-trip to the server.
   *
   * @returns {Promise<boolean>} promise resolved with a boolean or rejected with error.
   */
  supportsMultiDb(): Promise<boolean>
  /**
   * Returns whether the server supports transaction config capabilities based on the protocol
   * version negotiated via handshake.
   *
   * Note that this function call _always_ causes a round-trip to the server.
   *
   * @returns {Promise<boolean>} promise resolved with a boolean or rejected with error.
   */
  supportsTransactionConfig(): Promise<boolean>
  /**
   * @protected
   * @returns {boolean}
   */
  _supportsRouting(): boolean
  /**
   * Returns boolean to indicate if driver has been configured with encryption enabled.
   *
   * @protected
   * @returns {boolean}
   */
  _isEncrypted(): boolean
  /**
   * Returns the configured trust strategy that the driver has been configured with.
   *
   * @protected
   * @returns {TrustStrategy}
   */
  _getTrust(): any
  /**
   * Acquire a session to communicate with the database. The session will
   * borrow connections from the underlying connection pool as required and
   * should be considered lightweight and disposable.
   *
   * This comes with some responsibility - make sure you always call
   * {@link close} when you are done using a session, and likewise,
   * make sure you don't close your session before you are done using it. Once
   * it is closed, the underlying connection will be released to the connection
   * pool and made available for others to use.
   *
   * @public
   * @param {Object} param - The object parameter
   * @param {string} param.defaultAccessMode=WRITE - The access mode of this session, allowed values are {@link READ} and {@link WRITE}.
   * @param {string|string[]} param.bookmarks - The initial reference or references to some previous
   * transactions. Value is optional and absence indicates that that the bookmarks do not exist or are unknown.
   * @param {number} param.fetchSize - The record fetch size of each batch of this session.
   * Use {@link ALL} to always pull all records in one batch. This will override the config value set on driver config.
   * @param {string} param.database - The database this session will operate on.
   * @return {Session} new session.
   */
  session({
    defaultAccessMode,
    bookmarks: bookmarkOrBookmarks,
    database,
    fetchSize
  }?: {
    defaultAccessMode?: SessionMode
    bookmarks?: string | string[]
    fetchSize?: number
    database?: string
  }): any
  /**
   * Acquire a reactive session to communicate with the database. The session will
   * borrow connections from the underlying connection pool as required and
   * should be considered lightweight and disposable.
   *
   * This comes with some responsibility - make sure you always call
   * {@link close} when you are done using a session, and likewise,
   * make sure you don't close your session before you are done using it. Once
   * it is closed, the underlying connection will be released to the connection
   * pool and made available for others to use.
   *
   * @public
   * @param {Object} param
   * @param {string} param.defaultAccessMode=WRITE - The access mode of this session, allowed values are {@link READ} and {@link WRITE}.
   * @param {string|string[]} param.bookmarks - The initial reference or references to some previous transactions. Value is optional and
   * absence indicates that the bookmarks do not exist or are unknown.
   * @param {string} param.database - The database this session will operate on.
   * @returns {RxSession} new reactive session.
   */
  rxSession({
    defaultAccessMode,
    bookmarks: bookmarkOrBookmarks,
    database,
    fetchSize
  }?: {
    defaultAccessMode?: SessionMode
    bookmarks?: string | string[]
    fetchSize?: number
    database?: string
  }): any
  /**
   * Close all open sessions and other associated resources. You should
   * make sure to use this when you are done with this driver instance.
   * @public
   * @return {Promise<void>} promise resolved when the driver is closed.
   */
  close(): Promise<void>
  /**
   * @protected
   */
  _afterConstruction(): void
  /**
   * @protected
   */
  _createConnectionProvider(
    address: any,
    userAgent: string,
    authToken: AuthToken
  ): any
  /**
   * @protected
   */
  static _validateSessionMode(rawMode?: SessionMode): SessionMode
  /**
   * @private
   */
  _newSession({
    defaultAccessMode,
    bookmarkOrBookmarks,
    database,
    reactive,
    fetchSize
  }: {
    defaultAccessMode?: SessionMode
    bookmarkOrBookmarks?: string | string[]
    fetchSize: number
    database: string
    reactive: boolean
  }): any
  /**
   * @private
   */
  _getOrCreateConnectionProvider(): any
}
export {
  Driver,
  READ,
  WRITE,
  Config,
  AuthToken,
  EncryptionLevel,
  TrustStrategy,
  SessionMode
}
export default Driver
