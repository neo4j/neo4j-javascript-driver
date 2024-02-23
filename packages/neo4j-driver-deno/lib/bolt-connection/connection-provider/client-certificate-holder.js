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
import { ClientCertificatesLoader } from '../channel/index.js'

export default class ClientCertificateHolder {
  constructor ({ clientCertificateProvider, loader }) {
    this._clientCertificateProvider = clientCertificateProvider
    this._loader = loader || ClientCertificatesLoader
    this._clientCertificate = null
  }

  async getClientCertificate () {
    if (this._clientCertificateProvider != null &&
      (this._clientCertificate == null || await this._clientCertificateProvider.hasUpdate())) {
      this._clientCertificate = Promise.resolve(this._clientCertificateProvider.getClientCertificate())
        .then(this._loader.load)
        .then(clientCertificate => {
          this._clientCertificate = clientCertificate
          return this._clientCertificate
        })
        .catch(error => {
          this._clientCertificate = null
          throw error
        })
    }

    return this._clientCertificate
  }
}
