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

const DEFAULT_MAX_SIZE = 100
const DEFAULT_ACQUISITION_TIMEOUT = 60 * 1000 // 60 seconds

export default class PoolConfig {
  public readonly maxSize: number
  public readonly acquisitionTimeout: number

  constructor (maxSize: number, acquisitionTimeout: number) {
    this.maxSize = valueOrDefault(maxSize, DEFAULT_MAX_SIZE)
    this.acquisitionTimeout = valueOrDefault(
      acquisitionTimeout,
      DEFAULT_ACQUISITION_TIMEOUT
    )
  }

  static defaultConfig () {
    return new PoolConfig(DEFAULT_MAX_SIZE, DEFAULT_ACQUISITION_TIMEOUT)
  }

  static fromDriverConfig (config: { maxConnectionPoolSize?: number, connectionAcquisitionTimeout?: number} ) {
    const maxSize = isConfigured(config.maxConnectionPoolSize)
      ? config.maxConnectionPoolSize
      : DEFAULT_MAX_SIZE
      
    const acquisitionTimeout = isConfigured(
      config.connectionAcquisitionTimeout
    )
      ? config.connectionAcquisitionTimeout
      : DEFAULT_ACQUISITION_TIMEOUT

    return new PoolConfig(maxSize, acquisitionTimeout)
  }
}

function valueOrDefault (value: number | undefined, defaultValue: number) {
  return value === 0 || value ? value : defaultValue
}

function isConfigured (value?: number): value is number {
  return value === 0 || value != null
}

export { DEFAULT_MAX_SIZE, DEFAULT_ACQUISITION_TIMEOUT }
