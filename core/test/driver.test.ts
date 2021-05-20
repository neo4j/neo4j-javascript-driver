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
import { ConnectionProvider, newError } from '../src'
import Driver from '../src/driver'
import { Logger } from '../src/internal/logger'
import { ConfiguredCustomResolver } from '../src/internal/resolver'

describe('Driver', () => {
  let driver: Driver | null
  let connectionProvider: ConnectionProvider
  const META_INFO = {
    routing: false,
    typename: '',
    address: 'localhost'
  }
  const CONFIG = {}

  beforeEach(() => {
    connectionProvider = new ConnectionProvider()
    connectionProvider.close = jest.fn(() => Promise.resolve())
    driver = new Driver(
      META_INFO,
      CONFIG,
      mockCreateConnectonProvider(connectionProvider)
    )
  })

  afterEach(async () => {
    if (driver) {
      await driver.close()
      driver = null
    }
  })

  it.each([
    ['Promise.resolve(true)', Promise.resolve(true)],
    ['Promise.resolve(false)', Promise.resolve(false)],
    [
      "Promise.reject(newError('something went wrong'))",
      Promise.reject(newError('something went wrong'))
    ]
  ])('.supportsMultiDb() => %s', (_, expectedPromise) => {
    connectionProvider.supportsMultiDb = jest.fn(() => expectedPromise)

    const promise: Promise<boolean> = driver!.supportsMultiDb()

    expect(promise).toBe(expectedPromise)

    promise.catch(_ => 'Do nothing').finally(() => {})
  })

  it.each([
    ['Promise.resolve(true)', Promise.resolve(true)],
    ['Promise.resolve(false)', Promise.resolve(false)],
    [
      "Promise.reject(newError('something went wrong'))",
      Promise.reject(newError('something went wrong'))
    ]
  ])('.supportsTransactionConfig() => %s', (_, expectedPromise) => {
    connectionProvider.supportsTransactionConfig = jest.fn(
      () => expectedPromise
    )

    const promise: Promise<boolean> = driver!.supportsTransactionConfig()

    expect(promise).toBe(expectedPromise)

    promise.catch(_ => 'Do nothing').finally(() => {})
  })

  function mockCreateConnectonProvider(connectionProvider: ConnectionProvider) {
    return (
      id: number,
      config: Object,
      log: Logger,
      hostNameResolver: ConfiguredCustomResolver
    ) => connectionProvider
  }
})
