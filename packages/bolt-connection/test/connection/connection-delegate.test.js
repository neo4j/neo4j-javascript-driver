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

import Connection from '../../src/connection/connection'
import DelegateConnection from '../../src/connection/connection-delegate'
import { Connection as CoreConnection, internal } from 'neo4j-driver-core'
import ConnectionErrorHandler from '../../src/connection/connection-error-handler'
import { BoltProtocol } from '../../src/bolt'
import utils from '../test-utils'

const {
  serverAddress: { ServerAddress: BoltAddress }
} = internal

describe('DelegateConnection', () => {
  beforeEach(() => {
    expect.extend(utils.matchers)
  })

  const NON_DELEGATE_METHODS = [
    'constructor',
    // the delegate replaces the error handler of the original connection
    // and not delegate the requests to the previous connection until released
    'handleAndTransformError'
  ]

  it('should delegate get id', () => {
    const delegate = new Connection(null)
    const spy = jest.spyOn(delegate, 'id', 'get').mockReturnValue(5)
    const connection = new DelegateConnection(delegate, null)

    expect(connection.id).toBe(5)
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('should delegate get databaseId', () => {
    const delegate = new Connection(null)
    const spy = jest.spyOn(delegate, 'databaseId', 'get').mockReturnValue(
      '123-456'
    )
    const connection = new DelegateConnection(delegate, null)

    expect(connection.databaseId).toBe('123-456')
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('should delegate set databaseId', () => {
    const delegate = new Connection(null)
    const spy = jest.spyOn(delegate, 'databaseId', 'set').mockImplementation(() => {})
    const connection = new DelegateConnection(delegate, null)

    connection.databaseId = '345-678'

    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('should delegate get server', () => {
    const server = {
      address: BoltAddress.fromUrl('bolt://127.0.0.1:8798'),
      version: 'Neo4j/3.5.6'
    }
    const delegate = new Connection(null)
    const spy = jest.spyOn(delegate, 'server', 'get').mockReturnValue(server)
    const connection = new DelegateConnection(delegate, null)

    expect(connection.server).toBe(server)
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('should delegate get address', () => {
    const address = BoltAddress.fromUrl('bolt://127.0.0.1:8080')
    const delegate = new Connection(null)
    const spy = jest.spyOn(delegate, 'address', 'get').mockReturnValue(
      address
    )
    const connection = new DelegateConnection(delegate, null)

    expect(connection.address).toBe(address)
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('should delegate get version', () => {
    const version = 'Neo4j/3.5.6'
    const delegate = new Connection(null)
    const spy = jest.spyOn(delegate, 'version', 'get').mockReturnValue(
      version
    )
    const connection = new DelegateConnection(delegate, null)

    expect(connection.version).toBe(version)
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('should delegate set version', () => {
    const delegate = new Connection(null)
    const spy = jest.spyOn(delegate, 'version', 'set').mockImplementation(() => {})
    const connection = new DelegateConnection(delegate, null)

    connection.version = 'Neo4j/3.4.9'

    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('should delegate isOpen', () => {
    const delegate = new Connection(null)
    const spy = jest.spyOn(delegate, 'isOpen').mockReturnValue(true)
    const connection = new DelegateConnection(delegate, null)

    expect(connection.isOpen()).toBeTruthy()
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('should delegate protocol', () => {
    const protocol = new BoltProtocol()
    const delegate = new Connection(null)
    const spy = jest.spyOn(delegate, 'protocol').mockReturnValue(protocol)
    const connection = new DelegateConnection(delegate, null)

    expect(connection.protocol()).toBe(protocol)
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('should delegate connect', () => {
    const delegate = new Connection(null)
    const spy = jest.spyOn(delegate, 'connect').mockImplementation(() => {})
    const connection = new DelegateConnection(delegate, null)

    connection.connect('neo4j/js-driver', 'mydriver/0.0.0 some system info', {})

    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('should delegate write', () => {
    const delegate = new Connection(null)
    const spy = jest.spyOn(delegate, 'write').mockImplementation(() => {})
    const connection = new DelegateConnection(delegate, null)

    connection.write({}, null, true)

    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('should delegate resetAndFlush', () => {
    const delegate = new Connection(null)
    const spy = jest.spyOn(delegate, 'resetAndFlush').mockImplementation(() => {})
    const connection = new DelegateConnection(delegate, null)

    connection.resetAndFlush()

    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('should delegate close', async () => {
    const delegate = new Connection(null)
    const spy = jest.spyOn(delegate, 'close').mockReturnValue(Promise.resolve())
    const connection = new DelegateConnection(delegate, null)

    await connection.close()

    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('should delegate release', () => {
    const delegate = new Connection(null)
    delegate.release = () => {}
    const spy = jest.spyOn(delegate, 'release').mockImplementation(() => {})
    const connection = new DelegateConnection(delegate, null)

    connection.release()

    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('should override errorHandler on create and restore on release', () => {
    const errorHandlerOriginal = new ConnectionErrorHandler('code1')
    const delegate = new Connection(errorHandlerOriginal)
    delegate.release = () => {}

    expect(delegate._errorHandler).toBe(errorHandlerOriginal)

    const errorHandlerNew = new ConnectionErrorHandler('code2')
    const connection = new DelegateConnection(delegate, errorHandlerNew)

    expect(delegate._errorHandler).toBe(errorHandlerNew)

    connection.release()

    expect(delegate._errorHandler).toBe(errorHandlerOriginal)
  })

  it.each(getDelegatedMethods())('should delegate %s calls with exact args number and return value', (delegatedMethod) => {
    const result = 'the result'
    const method = CoreConnection.prototype[delegatedMethod] || Connection.prototype[delegatedMethod]
    const argsNumber = method.length // function.length returns the number of arguments expected by the function
    const args = [...Array(argsNumber).keys()]

    const connection = {
      [delegatedMethod]: jest.fn(() => result)
    }

    const delegatedConnection = new DelegateConnection(connection)

    expect(delegatedConnection[delegatedMethod](...args)).toBe(result)
    expect(connection[delegatedMethod]).toHaveBeenCalledTimes(1)
    expect(connection[delegatedMethod]).toBeCalledWith(...args)
    expect(connection[delegatedMethod]).toBeCalledWithThis(connection)
  })

  function getDelegatedMethods () {
    const allMethods = new Set([...Object.keys(Connection.prototype), ...Object.keys(CoreConnection.prototype)])
    return [...allMethods].filter(method => !NON_DELEGATE_METHODS.includes(method))
  }
})
