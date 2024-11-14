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

import * as json from './json.ts'

type KeyFile = string | { path: string, password?: string }

/**
 * Represents KeyFile represented as file.
 *
 * @typedef {object} KeyFileObject
 * @property {string} path - The path of the file
 * @property {string|undefined} password - the password of the key. If none,
 * the password defined at {@link ClientCertificate} will be used.
 */
/**
 * Holds the Client TLS certificate information.
 *
 * Browser instances of the driver should configure the certificate
 * in the system.
 *
 * Files defined in the {@link ClientCertificate#certfile}
 * and {@link ClientCertificate#keyfile} will read and loaded to
 * memory to fill the fields `cert` and `key` in security context.
 *
 * @interface
 * @see https://nodejs.org/api/tls.html#tlscreatesecurecontextoptions
 * @since 5.27
 */
export default class ClientCertificate {
  public readonly certfile: string | string[]
  public readonly keyfile: KeyFile | KeyFile[]
  public readonly password?: string

  private constructor () {
    /**
     * The path to client certificate file.
     *
     * @type {string|string[]}
     */
    this.certfile = ''

    /**
     * The path to the key file.
     *
     * @type {string|string[]|KeyFileObject|KeyFileObject[]}
     */
    this.keyfile = ''

    /**
     * The key's password.
     *
     * @type {string|undefined}
     */
    this.password = undefined
  }
}

/**
 * Provides a client certificate to the driver for mutual TLS.
 *
 * The driver will call {@link ClientCertificateProvider#hasUpdate} to check if the client wants to update the certificate.
 * If so, it will call {@link ClientCertificateProvider#getClientCertificate} to get the new certificate.
 *
 * The certificate is only used as a second factor for authentication authenticating the client.
 * The DMBS user still needs to authenticate with an authentication token.
 *
 * All implementations of this interface must be thread-safe and non-blocking for caller threads.
 * For instance, IO operations must not be done on the calling thread.
 *
 * Note that the work done in the methods of this interface count towards the connectionAcquisition.
 * Should fetching the certificate be particularly slow, it might be necessary to increase the timeout.
 *
 * @interface
 * @since 5.27
 */
export class ClientCertificateProvider {
  /**
   * Indicates whether the client wants the driver to update the certificate.
   *
   * @returns {Promise<boolean>|boolean} true if the client wants the driver to update the certificate
   */
  hasUpdate (): boolean | Promise<boolean> {
    throw new Error('Not Implemented')
  }

  /**
   * Returns the certificate to use for new connections.
   *
   * Will be called by the driver after {@link ClientCertificateProvider#hasUpdate} returned true
   * or when the driver establishes the first connection.
   *
   * @returns {Promise<ClientCertificate>|ClientCertificate} the certificate to use for new connections
   */
  getClientCertificate (): ClientCertificate | Promise<ClientCertificate> {
    throw new Error('Not Implemented')
  }
}

/**
 * Interface for  {@link ClientCertificateProvider} which provides update certificate function.
 * @interface
 * @since 5.27
 */
export class RotatingClientCertificateProvider extends ClientCertificateProvider {
  /**
   * Updates the certificate stored in the provider.
   *
   * To be called by user-code when a new client certificate is available.
   *
   * @param {ClientCertificate} certificate - the new certificate
   * @throws {TypeError} If initialCertificate is not a ClientCertificate.
   */
  updateCertificate (certificate: ClientCertificate): void {
    throw new Error('Not implemented')
  }
}

/**
 * Defines the object which holds the common {@link ClientCertificateProviders} used in the Driver
 *
 * @since 5.27
 */
class ClientCertificateProviders {
  /**
   *
   * @param {object} param0 - The params
   * @param {ClientCertificate} param0.initialCertificate - The certificated used by the driver until {@link RotatingClientCertificateProvider#updateCertificate} get called.
   *
   * @returns {RotatingClientCertificateProvider} The rotating client certificate provider
   * @throws {TypeError} If initialCertificate is not a ClientCertificate.
   */
  rotating ({ initialCertificate }: { initialCertificate: ClientCertificate }): RotatingClientCertificateProvider {
    if (initialCertificate == null || !isClientClientCertificate(initialCertificate)) {
      throw new TypeError(`initialCertificate should be ClientCertificate, but got ${json.stringify(initialCertificate)}`)
    }

    const certificate = { ...initialCertificate }
    return new InternalRotatingClientCertificateProvider(certificate)
  }
}

/**
 * Holds the common {@link ClientCertificateProviders} used in the Driver.
 *
 * @since 5.27
 */
const clientCertificateProviders: ClientCertificateProviders = new ClientCertificateProviders()

Object.freeze(clientCertificateProviders)

export {
  clientCertificateProviders
}

export type {
  ClientCertificateProviders
}

/**
 * Resolves ClientCertificate or ClientCertificateProvider to a ClientCertificateProvider
 *
 * Method validates the input.
 *
 * @private
 * @param input
 * @returns {ClientCertificateProvider?} A client certificate provider if provided a ClientCertificate or a ClientCertificateProvider
 * @throws {TypeError} If input is not a ClientCertificate, ClientCertificateProvider, undefined or null.
 */
export function resolveCertificateProvider (input: unknown): ClientCertificateProvider | undefined {
  if (input == null) {
    return undefined
  }

  if (typeof input === 'object' && 'hasUpdate' in input && 'getClientCertificate' in input &&
      typeof input.getClientCertificate === 'function' && typeof input.hasUpdate === 'function') {
    return input as ClientCertificateProvider
  }

  if (isClientClientCertificate(input)) {
    const certificate = { ...input } as unknown as ClientCertificate
    return {
      getClientCertificate: () => certificate,
      hasUpdate: () => false
    }
  }

  throw new TypeError(`clientCertificate should be configured with ClientCertificate or ClientCertificateProvider, but got ${json.stringify(input)}`)
}

/**
 * Verify if object is a client certificate
 * @private
 * @param maybeClientCertificate - Maybe the certificate
 * @returns {boolean} if maybeClientCertificate is a client certificate object
 */
function isClientClientCertificate (maybeClientCertificate: unknown): maybeClientCertificate is ClientCertificate {
  return maybeClientCertificate != null &&
    typeof maybeClientCertificate === 'object' &&
    'certfile' in maybeClientCertificate && isCertFile(maybeClientCertificate.certfile) &&
    'keyfile' in maybeClientCertificate && isKeyFile(maybeClientCertificate.keyfile) &&
    isStringOrNotPresent('password', maybeClientCertificate)
}

/**
 * Check value is a cert file
 * @private
 * @param {any} value the value
 * @returns {boolean} is a cert file
 */
function isCertFile (value: unknown): value is string | string [] {
  return isString(value) || isArrayOf(value, isString)
}

/**
 * Check if the value is a keyfile.
 *
 * @private
 * @param {any} maybeKeyFile might be a keyfile value
 * @returns {boolean} the value is a KeyFile
 */
function isKeyFile (maybeKeyFile: unknown): maybeKeyFile is KeyFile {
  function check (obj: unknown): obj is KeyFile {
    return typeof obj === 'string' ||
      (obj != null &&
      typeof obj === 'object' &&
      'path' in obj && typeof obj.path === 'string' &&
      isStringOrNotPresent('password', obj))
  }

  return check(maybeKeyFile) || isArrayOf(maybeKeyFile, check)
}

/**
 * Verify if value is string
 *
 * @private
 * @param {any} value the value
 * @returns {boolean} is string
 */
function isString (value: unknown): value is string {
  return typeof value === 'string'
}

/**
 * Verifies if value is a array of type
 *
 * @private
 * @param {any} value the value
 * @param {function} isType the type checker
 * @returns {boolean} value is array of type
 */
function isArrayOf<T> (value: unknown, isType: (val: unknown) => val is T, allowEmpty: boolean = false): value is T[] {
  return Array.isArray(value) &&
    (allowEmpty || value.length > 0) &&
    value.filter(isType).length === value.length
}

/**
 * Verify if valueName is present in the object and is a string, or not present at all.
 *
 * @private
 * @param {string} valueName The value in the object
 * @param {object} obj The object
 * @returns {boolean} if the value is present in object as string or not present
 */
function isStringOrNotPresent (valueName: string, obj: Record<string, any>): boolean {
  return !(valueName in obj) || obj[valueName] == null || typeof obj[valueName] === 'string'
}

/**
 * Internal implementation
 *
 * @private
 */
class InternalRotatingClientCertificateProvider {
  constructor (
    private _certificate: ClientCertificate,
    private _updated: boolean = false) {
  }

  /**
   *
   * @returns {boolean|Promise<boolean>}
   */

  hasUpdate (): boolean | Promise<boolean> {
    try {
      return this._updated
    } finally {
      this._updated = false
    }
  }

  /**
   *
   * @returns {ClientCertificate|Promise<ClientCertificate>}
   */
  getClientCertificate (): ClientCertificate | Promise<ClientCertificate> {
    return this._certificate
  }

  /**
   *
   * @param certificate
   * @returns {void}
   */
  updateCertificate (certificate: ClientCertificate): void {
    if (!isClientClientCertificate(certificate)) {
      throw new TypeError(`certificate should be ClientCertificate, but got ${json.stringify(certificate)}`)
    }
    this._certificate = { ...certificate }
    this._updated = true
  }
}
