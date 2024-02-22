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

/**
 * Holds the Client TLS certificate information.
 *
 * Browser instances of the driver should configure the certificate
 * in the system.
 *
 * @interface
 */
export default class ClientCertificate {
  public readonly certfile: string
  public readonly keyfile: string
  public readonly password?: string

  private constructor () {
    /**
     * The path to client certificate file.
     *
     * @type {string}
     */
    this.certfile = ''

    /**
     * The path to the key file.
     *
     * @type {string}
     */
    this.keyfile = ''

    /**
     * The certificate's password.
     *
     * @type {string|undefined}
     */
    this.password = undefined
  }
}

/**
 * Provides a client certificate to the driver for mutual TLS.
 *
 * The driver will call {@link ClientCertificateProvider#hasUpdate()} to check if the client wants to update the certificate.
 * If so, it will call {@link ClientCertificateProvider#getCertificate()} to get the new certificate.
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
   * Will be called by the driver after {@link ClientCertificateProvider#hasUpdate()} returned true
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
 *
 */
function isClientClientCertificate (maybeClientCertificate: unknown): maybeClientCertificate is ClientCertificate {
  return maybeClientCertificate != null &&
    typeof maybeClientCertificate === 'object' &&
    'certfile' in maybeClientCertificate && typeof maybeClientCertificate.certfile === 'string' &&
    'keyfile' in maybeClientCertificate && typeof maybeClientCertificate.keyfile === 'string' &&
    (!('password' in maybeClientCertificate) || maybeClientCertificate.password == null || typeof maybeClientCertificate.password === 'string')
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

  hasUpdate (): boolean | Promise<boolean> {
    try {
      return this._updated
    } finally {
      this._updated = false
    }
  }

  getClientCertificate (): ClientCertificate | Promise<ClientCertificate> {
    return this._certificate
  }

  updateCertificate (certificate: ClientCertificate): void {
    if (!isClientClientCertificate(certificate)) {
      throw new TypeError(`certificate should be ClientCertificate, but got ${json.stringify(certificate)}`)
    }
    this._certificate = { ...certificate }
    this._updated = true
  }
}
