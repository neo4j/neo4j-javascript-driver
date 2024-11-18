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
    if (realm != null) {
      return {
        scheme: 'basic',
        principal: username,
        credentials: password,
        cacheKey: 'basic:' + username,
        realm
      }
    } else {
      return { scheme: 'basic', principal: username, credentials: password, cacheKey: 'basic:' + username }
    }
  },
  kerberos: (base64EncodedTicket: string) => {
    return {
      scheme: 'kerberos',
      principal: '', // This empty string is required for backwards compatibility.
      credentials: base64EncodedTicket,
      cacheKey: 'kerberos:' + base64EncodedTicket
    }
  },
  bearer: (base64EncodedToken: string) => {
    return {
      scheme: 'bearer',
      credentials: base64EncodedToken,
      cacheKey: 'bearer:' + base64EncodedToken
    }
  },
  none: () => {
    return {
      scheme: 'none'
    }
  },
  custom: (
    principal: string,
    credentials: string,
    realm: string,
    scheme: string,
    parameters?: any
  ) => {
    const output: any = {
      scheme,
      principal
    }
    if (isNotEmpty(credentials)) {
      output.credentials = credentials
    }
    if (isNotEmpty(realm)) {
      output.realm = realm
    }
    let ordered = ''
    if (isNotEmpty(parameters) && parameters !== undefined) {
      output.parameters = parameters
      Object.keys(parameters).sort().forEach((key: string) => {
        //eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        ordered += `${key}:${parameters[key]}`
      })
    }


    output.cacheKey = scheme + ':' + principal + (isNotEmpty(credentials) ? credentials : '') + (isNotEmpty(realm) ? realm : '') + ordered
    return output
  }
}

function isNotEmpty<T extends object | string> (value: T | null | undefined): boolean {
  return !(
    value === null ||
    value === undefined ||
    value === '' ||
    (Object.getPrototypeOf(value) === Object.prototype && Object.keys(value).length === 0)
  )
}

export default auth
