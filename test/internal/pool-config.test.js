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

import PoolConfig, {DEFAULT_ACQUISITION_TIMEOUT, DEFAULT_SIZE} from '../../src/v1/internal/pool-config';

describe('PoolConfig', () => {

  let originalConsoleWarn;

  beforeAll(() => {
    originalConsoleWarn = console.warn;
    console.warn = () => {
    };
  });

  afterAll(() => {
    console.warn = originalConsoleWarn;
  });

  it('should respect zero values', () => {
    const config = new PoolConfig(0, 0, 0);

    expect(config.maxIdleSize).toEqual(0);
    expect(config.maxSize).toEqual(0);
    expect(config.acquisitionTimeout).toEqual(0);
  });

  it('should expose default config', () => {
    const config = PoolConfig.defaultConfig();

    expect(config.maxIdleSize).toEqual(DEFAULT_SIZE);
    expect(config.maxSize).toEqual(DEFAULT_SIZE);
    expect(config.acquisitionTimeout).toEqual(DEFAULT_ACQUISITION_TIMEOUT);
  });

  it('should convert from empty driver config', () => {
    const driverConfig = {};
    const config = PoolConfig.fromDriverConfig(driverConfig);

    expect(config.maxIdleSize).toEqual(DEFAULT_SIZE);
    expect(config.maxSize).toEqual(DEFAULT_SIZE);
    expect(config.acquisitionTimeout).toEqual(DEFAULT_ACQUISITION_TIMEOUT);
  });

  it('should convert from full driver config', () => {
    const driverConfig = {
      connectionPoolSize: 42,
      maxConnectionPoolSize: 4242,
      connectionAcquisitionTimeout: 424242
    };
    const config = PoolConfig.fromDriverConfig(driverConfig);

    expect(config.maxIdleSize).toEqual(42);
    expect(config.maxSize).toEqual(4242);
    expect(config.acquisitionTimeout).toEqual(424242);
  });

  it('should convert from driver config with both connectionPoolSize and maxConnectionPoolSize', () => {
    const driverConfig = {
      connectionPoolSize: 42,
      maxConnectionPoolSize: 4242
    };
    const config = PoolConfig.fromDriverConfig(driverConfig);

    expect(config.maxIdleSize).toEqual(42);
    expect(config.maxSize).toEqual(4242);
    expect(config.acquisitionTimeout).toEqual(DEFAULT_ACQUISITION_TIMEOUT);
  });

  it('should convert from driver config without connectionPoolSize and maxConnectionPoolSize', () => {
    const driverConfig = {
      connectionAcquisitionTimeout: 42
    };
    const config = PoolConfig.fromDriverConfig(driverConfig);

    expect(config.maxIdleSize).toEqual(DEFAULT_SIZE);
    expect(config.maxSize).toEqual(DEFAULT_SIZE);
    expect(config.acquisitionTimeout).toEqual(42);
  });

  it('should convert from driver config with only connectionPoolSize', () => {
    const driverConfig = {
      connectionPoolSize: 42
    };
    const config = PoolConfig.fromDriverConfig(driverConfig);

    // both connectionPoolSize and maxConnectionPoolSize should be set to the same value
    expect(config.maxIdleSize).toEqual(42);
    expect(config.maxSize).toEqual(42);
    expect(config.acquisitionTimeout).toEqual(DEFAULT_ACQUISITION_TIMEOUT);
  });

  it('should convert from driver config with only maxConnectionPoolSize', () => {
    const driverConfig = {
      maxConnectionPoolSize: 42
    };
    const config = PoolConfig.fromDriverConfig(driverConfig);

    // both connectionPoolSize and maxConnectionPoolSize should be set to the same value
    expect(config.maxIdleSize).toEqual(42);
    expect(config.maxSize).toEqual(42);
    expect(config.acquisitionTimeout).toEqual(DEFAULT_ACQUISITION_TIMEOUT);
  });

});
