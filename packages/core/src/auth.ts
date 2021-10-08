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

/**
 * @property {function(username: string, password: string, realm: ?string)} basic the function to create a
 * basic authentication token.
 * @property {function(base64EncodedTicket: string)} kerberos the function to create a Kerberos authentication token.
 * Accepts a single string argument - base64 encoded Kerberos ticket.
 * @property {function(base64EncodedTicket: string)} bearer the function to create a Bearer authentication token.
 * Accepts a single string argument - base64 encoded Bearer ticket.
 * @property {function(principal: string, credentials: string, realm: string, scheme: string, parameters: ?object)} custom
 * the function to create a custom authentication token.
 */
 const auth = {
  basic: (username: string, password: string, realm?: string) => {
    if (realm) {
      return {
        scheme: 'basic',
        principal: username,
        credentials: password,
        realm: realm
      }
    } else {
      return { scheme: 'basic', principal: username, credentials: password }
    }
  },
  kerberos: (base64EncodedTicket: string) => {
    return {
      scheme: 'kerberos',
      principal: '', // This empty string is required for backwards compatibility.
      credentials: base64EncodedTicket
    }
  },
  bearer: (base64EncodedToken: string) => {
    return {
      scheme: 'bearer',
      credentials: base64EncodedToken
    }
  },
  custom: (
    principal: string,
    credentials: string,
    realm: string,
    scheme: string,
    parameters?: string
  ) => {
    if (parameters) {
      return {
        scheme: scheme,
        principal: principal,
        credentials: credentials,
        realm: realm,
        parameters: parameters
      }
    } else {
      return {
        scheme: scheme,
        principal: principal,
        credentials: credentials,
        realm: realm
      }
    }
  }
}

export default auth