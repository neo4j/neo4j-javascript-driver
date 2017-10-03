/**
 * Copyright (c) 2002-2017 "Neo Technology,","
 * Network Engine for Objects in Lund AB [http://neotechnology.com]
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

const DEFAULT_SIZE = 50;
const DEFAULT_ACQUISITION_TIMEOUT = 60000;

export default class PoolConfig {

  constructor(maxIdleSize, maxSize, acquisitionTimeout) {
    this.maxIdleSize = valueOrDefault(maxIdleSize, DEFAULT_SIZE);
    this.maxSize = valueOrDefault(maxSize, DEFAULT_SIZE);
    this.acquisitionTimeout = valueOrDefault(acquisitionTimeout, DEFAULT_ACQUISITION_TIMEOUT);
  }

  static defaultConfig() {
    return new PoolConfig(DEFAULT_SIZE, DEFAULT_SIZE, DEFAULT_ACQUISITION_TIMEOUT);
  }

  static fromDriverConfig(config) {
    const maxIdleSizeConfigured = isConfigured(config.connectionPoolSize);
    const maxSizeConfigured = isConfigured(config.maxConnectionPoolSize);

    if (maxIdleSizeConfigured) {
      console.warn('WARNING: neo4j-driver setting "connectionPoolSize" is deprecated, please use "maxConnectionPoolSize" instead');
    }

    let maxIdleSize;
    let maxSize;

    if (maxIdleSizeConfigured && maxSizeConfigured) {
      // both settings are configured - use configured values
      maxIdleSize = config.connectionPoolSize;
      maxSize = config.maxConnectionPoolSize;
    } else if (!maxIdleSizeConfigured && maxSizeConfigured) {
      // only maxSize is configured - use it's value for both
      maxIdleSize = config.maxConnectionPoolSize;
      maxSize = config.maxConnectionPoolSize;
    } else if (maxIdleSizeConfigured && !maxSizeConfigured) {
      // only maxIdleSize is configured - use it's value for both
      maxIdleSize = config.connectionPoolSize;
      maxSize = config.connectionPoolSize;
    } else {
      // none configured - use default values
      maxIdleSize = DEFAULT_SIZE;
      maxSize = DEFAULT_SIZE;
    }

    const acquisitionTimeoutConfigured = isConfigured(config.connectionAcquisitionTimeout);
    const acquisitionTimeout = acquisitionTimeoutConfigured ? config.connectionAcquisitionTimeout : DEFAULT_ACQUISITION_TIMEOUT;

    return new PoolConfig(maxIdleSize, maxSize, acquisitionTimeout);
  }
}

function valueOrDefault(value, defaultValue) {
  return value === 0 || value ? value : defaultValue;
}

function isConfigured(value) {
  return value === 0 || value;
}

export {
  DEFAULT_SIZE,
  DEFAULT_ACQUISITION_TIMEOUT
};
