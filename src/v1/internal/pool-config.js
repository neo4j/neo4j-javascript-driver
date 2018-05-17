/**
 * Copyright (c) 2002-2018 "Neo4j,"
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

const DEFAULT_MAX_SIZE = 100;
const DEFAULT_ACQUISITION_TIMEOUT = 60 * 1000; // 60 seconds

export default class PoolConfig {

  constructor(maxSize, acquisitionTimeout) {
    this.maxSize = valueOrDefault(maxSize, DEFAULT_MAX_SIZE);
    this.acquisitionTimeout = valueOrDefault(acquisitionTimeout, DEFAULT_ACQUISITION_TIMEOUT);
  }

  static defaultConfig() {
    return new PoolConfig(DEFAULT_MAX_SIZE, DEFAULT_ACQUISITION_TIMEOUT);
  }

  static fromDriverConfig(config) {
    const maxIdleSizeConfigured = isConfigured(config.connectionPoolSize);
    const maxSizeConfigured = isConfigured(config.maxConnectionPoolSize);

    let maxSize;

    if (maxSizeConfigured) {
      // correct size setting is set - use it's value
      maxSize = config.maxConnectionPoolSize;
    } else if (maxIdleSizeConfigured) {
      // deprecated size setting is set - use it's value
      console.warn('WARNING: neo4j-driver setting "connectionPoolSize" is deprecated, please use "maxConnectionPoolSize" instead');
      maxSize = config.connectionPoolSize;
    } else {
      maxSize = DEFAULT_MAX_SIZE;
    }

    const acquisitionTimeoutConfigured = isConfigured(config.connectionAcquisitionTimeout);
    const acquisitionTimeout = acquisitionTimeoutConfigured ? config.connectionAcquisitionTimeout : DEFAULT_ACQUISITION_TIMEOUT;

    return new PoolConfig(maxSize, acquisitionTimeout);
  }
}

function valueOrDefault(value, defaultValue) {
  return value === 0 || value ? value : defaultValue;
}

function isConfigured(value) {
  return value === 0 || value;
}

export {
  DEFAULT_MAX_SIZE,
  DEFAULT_ACQUISITION_TIMEOUT
};
