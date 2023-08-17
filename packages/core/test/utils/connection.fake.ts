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

import { Connection, ResultObserver, ResultSummary } from '../../src'
import { ResultStreamObserver } from '../../src/internal/observers'

/**
 * This class is like a mock of {@link Connection} that tracks invocations count.
 * It tries to maintain same "interface" as {@link Connection}.
 * It could be replaced with a proper mock by a library like testdouble.
 * At the time of writing such libraries require {@link Proxy} support but browser tests execute in
 * PhantomJS which does not support proxies.
 */
export default class FakeConnection extends Connection {
  private _open: boolean
  private readonly _id: number
  private _databaseId: string | null
  private _requestRoutingInformationMock: ((params: any) => void) | null
  public creationTimestamp: number
  public resetInvoked: number
  public releaseInvoked: number
  public seenQueries: string[]
  public seenParameters: any[]
  public seenProtocolOptions: any[]
  private readonly _server: any
  public protocolVersion: number | undefined
  public protocolErrorsHandled: number
  public seenProtocolErrors: string[]
  public seenRequestRoutingInformation: any[]
  public rollbackInvoked: number
  public _rollbackError: Error | null
  public seenBeginTransaction: any[]

  constructor () {
    super()

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
    this.rollbackInvoked = 0
    this._rollbackError = null
    this.seenBeginTransaction = []
  }

  get id (): string {
    return this._id.toString()
  }

  get databaseId (): string {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return this._databaseId!
  }

  set databaseId (value: string) {
    this._databaseId = value
  }

  get server (): any {
    return this._server
  }

  get version (): string {
    return this._server.version
  }

  set version (value: string) {
    this._server.version = value
  }

  protocol (): any {
    // return fake protocol object that simply records seen queries and parameters
    return {
      run: (query: string, parameters: any | undefined, protocolOptions: any | undefined): ResultStreamObserver => {
        this.seenQueries.push(query)
        this.seenParameters.push(parameters)
        this.seenProtocolOptions.push(protocolOptions)
        return mockResultStreamObserver(query, parameters)
      },
      commitTransaction: () => {
        return mockResultStreamObserver('COMMIT', {})
      },
      beginTransaction: async (...args: any) => {
        this.seenBeginTransaction.push(...args)
        return await Promise.resolve()
      },
      rollbackTransaction: () => {
        this.rollbackInvoked++
        if (this._rollbackError !== null) {
          return mockResultStreamObserverWithError('ROLLBACK', {}, this._rollbackError)
        }
        return mockResultStreamObserver('ROLLBACK', {})
      },
      requestRoutingInformation: (params: any | undefined) => {
        this.seenRequestRoutingInformation.push(params)
        if (this._requestRoutingInformationMock != null) {
          this._requestRoutingInformationMock(params)
        }
      },
      version: this.protocolVersion
    }
  }

  async resetAndFlush (): Promise<void> {
    this.resetInvoked++
  }

  async _release (): Promise<void> {
    this.releaseInvoked++
  }

  isOpen (): boolean {
    return this._open
  }

  isNeverReleased (): boolean {
    return this.isReleasedTimes(0)
  }

  isReleasedOnce (): boolean {
    return this.isReleasedTimes(1)
  }

  isReleasedTimes (times: number): boolean {
    return this.resetInvoked === times && this.releaseInvoked === times
  }

  _handleProtocolError (message: string): void {
    this.protocolErrorsHandled++
    this.seenProtocolErrors.push(message)
  }

  withProtocolVersion (version: number): FakeConnection {
    this.protocolVersion = version
    return this
  }

  withCreationTimestamp (value: number): FakeConnection {
    this.creationTimestamp = value
    return this
  }

  withRequestRoutingInformationMock (requestRoutingInformationMock: (params: any) => void): FakeConnection {
    this._requestRoutingInformationMock = requestRoutingInformationMock
    return this
  }

  withRollbackError (error: Error): FakeConnection {
    this._rollbackError = error
    return this
  }

  closed (): FakeConnection {
    this._open = false
    return this
  }

  hasOngoingObservableRequests (): boolean {
    return true
  }
}

function mockResultStreamObserverWithError (query: string, parameters: any | undefined, error: Error): ResultStreamObserver {
  const observer = mockResultStreamObserver(query, parameters)
  observer.subscribe = (observer: ResultObserver) => {
    if (observer?.onError != null) {
      observer.onError(error)
    }
  }
  return observer
}

function mockResultStreamObserver (query: string, parameters: any | undefined): ResultStreamObserver {
  return {
    onError: (e: any) => { },
    onCompleted: () => { },
    onNext: (result: any) => { },
    cancel: () => { },
    prepareToHandleSingleResponse: () => { },
    pause: () => { },
    resume: () => { },
    markCompleted: () => { },
    subscribe: (observer: ResultObserver) => {
      if (observer?.onCompleted != null) {
        observer.onCompleted(new ResultSummary(query, parameters, {}))
      }
    }
  }
}
