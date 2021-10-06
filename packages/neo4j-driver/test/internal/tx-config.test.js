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
import { int } from '../../src'
import { internal } from 'neo4j-driver-core'

const {
  txConfig: { TxConfig }
} = internal

describe('#unit TxConfig', () => {
  it('should be possible to construct from null', () => {
    testEmptyConfigCreation(null)
  })

  it('should be possible to construct from undefined', () => {
    testEmptyConfigCreation(undefined)
  })

  it('should be possible to construct from empty object', () => {
    testEmptyConfigCreation({})
  })

  it('should fail to construct from array', () => {
    expect(() => new TxConfig([])).toThrowError(TypeError)
  })

  it('should fail to construct from function', () => {
    const func = () => {}
    expect(() => new TxConfig(func)).toThrowError(TypeError)
  })

  it('should expose empty config', () => {
    const config = TxConfig.empty()
    expect(config).toBeDefined()
    expect(config.isEmpty()).toBeTruthy()
  })

  it('should fail to construct with invalid timeout', () => {
    const invalidTimeoutValues = ['15s', [15], {}, 0, int(0), -42, int(-42)]

    invalidTimeoutValues.forEach(invalidValue =>
      expect(() => new TxConfig({ timeout: invalidValue })).toThrow()
    )
  })

  it('should construct with valid timeout', () => {
    testConfigCreationWithTimeout(1)
    testConfigCreationWithTimeout(42000)

    testConfigCreationWithTimeout(int(1))
    testConfigCreationWithTimeout(int(424242))
  })

  it('should fail to construct with invalid metadata', () => {
    const invalidMetadataValues = ['hello', [1, 2, 3], () => 'Hello', 42]

    invalidMetadataValues.forEach(invalidValue =>
      expect(() => new TxConfig({ metadata: invalidValue })).toThrow()
    )
  })

  it('should construct with valid metadata', () => {
    testEmptyConfigCreation({ metadata: {} })

    testConfigCreationWithMetadata({ key: 'value' })
    testConfigCreationWithMetadata({
      map: { key1: 1, key2: '2', key3: [] },
      array: [1, 2, 3, '4']
    })
  })

  function testEmptyConfigCreation (value) {
    const config = new TxConfig(value)
    expect(config).toBeDefined()
    expect(config.isEmpty()).toBeTruthy()
  }

  function testConfigCreationWithTimeout (value) {
    const config = new TxConfig({ timeout: value })
    expect(config).toBeDefined()
    expect(config.isEmpty()).toBeFalsy()
    expect(config.timeout).toEqual(int(value))
  }

  function testConfigCreationWithMetadata (value) {
    const config = new TxConfig({ metadata: value })
    expect(config).toBeDefined()
    expect(config.isEmpty()).toBeFalsy()
    expect(config.metadata).toEqual(value)
  }
})
