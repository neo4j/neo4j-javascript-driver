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
import DelegateConnection from '../../../bolt-connection/lib/connection/connection-delegate'
import Connection from '../../../bolt-connection/lib/connection/connection'
import { BoltProtocol } from '../../../bolt-connection/lib/bolt'
import ConnectionErrorHandler from '../../../bolt-connection/lib/connection/connection-error-handler'
import { internal } from 'neo4j-driver-core'

const {
  serverAddress: { ServerAddress: BoltAddress }
} = internal

describe('#unit DelegateConnection', () => {
  it('should delegate get id', () => {
    const delegate = new Connection(null)
    const spy = spyOnProperty(delegate, 'id', 'get').and.returnValue(5)
    const connection = new DelegateConnection(delegate, null)

    expect(connection.id).toBe(5)
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('should delegate get databaseId', () => {
    const delegate = new Connection(null)
    const spy = spyOnProperty(delegate, 'databaseId', 'get').and.returnValue(
      '123-456'
    )
    const connection = new DelegateConnection(delegate, null)

    expect(connection.databaseId).toBe('123-456')
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('should delegate set databaseId', () => {
    const delegate = new Connection(null)
    const spy = spyOnProperty(delegate, 'databaseId', 'set')
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
    const spy = spyOnProperty(delegate, 'server', 'get').and.returnValue(server)
    const connection = new DelegateConnection(delegate, null)

    expect(connection.server).toBe(server)
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('should delegate get address', () => {
    const address = BoltAddress.fromUrl('bolt://127.0.0.1:8080')
    const delegate = new Connection(null)
    const spy = spyOnProperty(delegate, 'address', 'get').and.returnValue(
      address
    )
    const connection = new DelegateConnection(delegate, null)

    expect(connection.address).toBe(address)
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('should delegate get version', () => {
    const version = 'Neo4j/3.5.6'
    const delegate = new Connection(null)
    const spy = spyOnProperty(delegate, 'version', 'get').and.returnValue(
      version
    )
    const connection = new DelegateConnection(delegate, null)

    expect(connection.version).toBe(version)
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('should delegate set version', () => {
    const delegate = new Connection(null)
    const spy = spyOnProperty(delegate, 'version', 'set')
    const connection = new DelegateConnection(delegate, null)

    connection.version = 'Neo4j/3.4.9'

    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('should delegate isOpen', () => {
    const delegate = new Connection(null)
    const spy = spyOn(delegate, 'isOpen').and.returnValue(true)
    const connection = new DelegateConnection(delegate, null)

    expect(connection.isOpen()).toBeTruthy()
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('should delegate protocol', () => {
    const protocol = new BoltProtocol()
    const delegate = new Connection(null)
    const spy = spyOn(delegate, 'protocol').and.returnValue(protocol)
    const connection = new DelegateConnection(delegate, null)

    expect(connection.protocol()).toBe(protocol)
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('should delegate connect', () => {
    const delegate = new Connection(null)
    const spy = spyOn(delegate, 'connect')
    const connection = new DelegateConnection(delegate, null)

    connection.connect('neo4j/js-driver', {})

    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('should delegate write', () => {
    const delegate = new Connection(null)
    const spy = spyOn(delegate, 'write')
    const connection = new DelegateConnection(delegate, null)

    connection.write({}, null, true)

    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('should delegate resetAndFlush', () => {
    const delegate = new Connection(null)
    const spy = spyOn(delegate, 'resetAndFlush')
    const connection = new DelegateConnection(delegate, null)

    connection.resetAndFlush()

    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('should delegate close', async () => {
    const delegate = new Connection(null)
    const spy = spyOn(delegate, 'close').and.returnValue(Promise.resolve())
    const connection = new DelegateConnection(delegate, null)

    await connection.close()

    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('should delegate _release', () => {
    const delegate = new Connection(null)
    delegate._release = () => {}
    const spy = spyOn(delegate, '_release')
    const connection = new DelegateConnection(delegate, null)

    connection._release()

    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('should override errorHandler on create and restore on release', () => {
    const errorHandlerOriginal = new ConnectionErrorHandler('code1')
    const delegate = new Connection(errorHandlerOriginal)
    delegate._release = () => {}

    expect(delegate._errorHandler).toBe(errorHandlerOriginal)

    const errorHandlerNew = new ConnectionErrorHandler('code2')
    const connection = new DelegateConnection(delegate, errorHandlerNew)

    expect(delegate._errorHandler).toBe(errorHandlerNew)

    connection._release()

    expect(delegate._errorHandler).toBe(errorHandlerOriginal)
  })
})
