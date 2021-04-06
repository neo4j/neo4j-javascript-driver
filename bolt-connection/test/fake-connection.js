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

import Connection from '../src/connection/connection'

/**
 * This class is like a mock of {@link Connection} that tracks invocations count.
 * It tries to maintain same "interface" as {@link Connection}.
 * It could be replaced with a proper mock by a library like testdouble.
 * At the time of writing such libraries require {@link Proxy} support but browser tests execute in
 * PhantomJS which does not support proxies.
 */
export default class FakeConnection extends Connection {
  constructor () {
    super(null)

    this._open = true
    this._id = 0
    this._databaseId = null
    this._requestRoutingInformationMock = null
    this.creationTimestamp = Date.now()

    this.resetInvoked = 0
    this.releaseInvoked = 0
    this.seenQueries = []
    this.seenParameters = []
    this.seenProtocolOptions = []
    this._server = {}
    this.protocolVersion = undefined
    this.protocolErrorsHandled = 0
    this.seenProtocolErrors = []
    this.seenRequestRoutingInformation = []
  }

  get id () {
    return this._id
  }

  get databaseId () {
    return this._databaseId
  }

  set databaseId (value) {
    this._databaseId = value
  }

  get server () {
    return this._server
  }

  get version () {
    return this._server.version
  }

  set version (value) {
    this._server.version = value
  }

  protocol () {
    // return fake protocol object that simply records seen queries and parameters
    return {
      run: (query, parameters, protocolOptions) => {
        this.seenQueries.push(query)
        this.seenParameters.push(parameters)
        this.seenProtocolOptions.push(protocolOptions)
      },
      requestRoutingInformation: params => {
        this.seenRequestRoutingInformation.push(params)
        if (this._requestRoutingInformationMock) {
          this._requestRoutingInformationMock(params)
        }
      },
      version: this.protocolVersion
    }
  }

  resetAndFlush () {
    this.resetInvoked++
    return Promise.resolve()
  }

  _release () {
    this.releaseInvoked++
    return Promise.resolve()
  }

  isOpen () {
    return this._open
  }

  isNeverReleased () {
    return this.isReleasedTimes(0)
  }

  isReleasedOnce () {
    return this.isReleasedTimes(1)
  }

  isReleasedTimes (times) {
    return this.resetInvoked === times && this.releaseInvoked === times
  }

  _handleProtocolError (message) {
    this.protocolErrorsHandled++
    this.seenProtocolErrors.push(message)
  }

  withProtocolVersion (version) {
    this.protocolVersion = version
    return this
  }

  withCreationTimestamp (value) {
    this.creationTimestamp = value
    return this
  }

  withRequestRoutingInformationMock (requestRoutingInformationMock) {
    this._requestRoutingInformationMock = requestRoutingInformationMock
    return this
  }

  closed () {
    this._open = false
    return this
  }
}
