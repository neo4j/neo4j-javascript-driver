/**
 * Copyright (c) 2002-2020 "Neo4j,"
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

import neo4j from '../src'
import sharedNeo4j from './internal/shared-neo4j'
import lolex from 'lolex'
import {
  DEFAULT_ACQUISITION_TIMEOUT,
  DEFAULT_MAX_SIZE
} from '../src/internal/pool-config'
import { ServerVersion, VERSION_4_0_0 } from '../src/internal/server-version'
import testUtils from './internal/test-utils'

// As long as driver creation doesn't touch the network it's fine to run
// this as a unit test.
describe('#unit driver', () => {
  let driver

  afterEach(async () => {
    if (driver) {
      await driver.close()
    }
  })

  it('should create an unencrypted, non-routed driver for scheme: bolt', () => {
    driver = neo4j.driver('bolt://localhost', sharedNeo4j.authToken)
    expect(driver._isEncrypted()).toBeFalsy()
    expect(driver._supportsRouting()).toBeFalsy()
  })

  it('should create an encrypted, system CAs trusting, non-routed driver for scheme: bolt+s', () => {
    driver = neo4j.driver('bolt+s://localhost', sharedNeo4j.authToken)
    expect(driver._isEncrypted()).toBeTruthy()
    expect(driver._getTrust()).toEqual('TRUST_SYSTEM_CA_SIGNED_CERTIFICATES')
    expect(driver._supportsRouting()).toBeFalsy()
  })

  it('should create an encrypted, all trusting, non-routed driver for scheme: bolt+ssc', () => {
    driver = neo4j.driver('bolt+ssc://localhost', sharedNeo4j.authToken)
    expect(driver._isEncrypted()).toBeTruthy()
    expect(driver._getTrust()).toEqual('TRUST_ALL_CERTIFICATES')
    expect(driver._supportsRouting()).toBeFalsy()
  })

  it('should create an unencrypted, routed driver for scheme: neo4j', () => {
    driver = neo4j.driver('neo4j://localhost', sharedNeo4j.authToken)
    expect(driver._isEncrypted()).toBeFalsy()
    expect(driver._supportsRouting()).toBeTruthy()
  })

  it('should create an encrypted, system CAs trusting, routed driver for scheme: neo4j+s', () => {
    driver = neo4j.driver('neo4j+s://localhost', sharedNeo4j.authToken)
    expect(driver._isEncrypted()).toBeTruthy()
    expect(driver._getTrust()).toEqual('TRUST_SYSTEM_CA_SIGNED_CERTIFICATES')
    expect(driver._supportsRouting()).toBeTruthy()
  })

  it('should create an encrypted, all trusting, routed driver for scheme: neo4j+ssc', () => {
    driver = neo4j.driver('neo4j+ssc://localhost', sharedNeo4j.authToken)
    expect(driver._isEncrypted()).toBeTruthy()
    expect(driver._getTrust()).toEqual('TRUST_ALL_CERTIFICATES')
    expect(driver._supportsRouting()).toBeTruthy()
  })

  it('should throw when encryption in url AND in config', () => {
    expect(() =>
      neo4j.driver('neo4j+ssc://localhost', sharedNeo4j.authToken, {
        encrypted: 'ENCRYPTION_OFF'
      })
    ).toThrow()
    // Throw even in case where there is no conflict
    expect(() =>
      neo4j.driver('neo4j+s://localhost', sharedNeo4j.authToken, {
        encrypted: 'ENCRYPTION_ON'
      })
    ).toThrow()
  })
})

describe('#integration driver', () => {
  let driver
  let protocolVersion

  beforeAll(async () => {
    const tmpDriver = neo4j.driver('bolt://localhost', sharedNeo4j.authToken)
    protocolVersion = await sharedNeo4j.cleanupAndGetProtocolVersion(tmpDriver)
    await tmpDriver.close()
  })

  afterEach(async () => {
    if (driver) {
      await driver.close()
      driver = null
    }
  })

  it('should not decrease active connection count after driver close', done => {
    // Given
    const config = {
      maxConnectionPoolSize: 2,
      connectionAcquisitionTimeout: 0,
      encrypted: false
    }
    driver = neo4j.driver('bolt://localhost', sharedNeo4j.authToken, config)

    function beginTxWithoutCommit (driver) {
      const session = driver.session()
      const tx = session.beginTransaction()
      return tx.run('RETURN 1')
    }
    // When

    const result1 = beginTxWithoutCommit(driver)
    const result2 = beginTxWithoutCommit(driver)

    Promise.all([result1, result2]).then(results => {
      driver.close()
      beginTxWithoutCommit(driver).catch(() => {
        var pool = driver._connectionProvider._connectionPool
        var serverKey = Object.keys(pool._activeResourceCounts)[0]
        expect(pool._activeResourceCounts[serverKey]).toEqual(2)
        expect(serverKey in pool._pools).toBeFalsy()
        expect(
          Object.keys(driver._connectionProvider._openConnections).length
        ).toEqual(2)
        done()
      })
    })
  }, 10000)

  it('should expose sessions', () => {
    // Given
    driver = neo4j.driver('bolt://localhost', sharedNeo4j.authToken)

    // When
    const session = driver.session()

    // Then
    expect(session).not.toBeNull()
  })

  it('should handle connection errors', async () => {
    // Given
    driver = neo4j.driver('bolt://local-host', sharedNeo4j.authToken)
    const session = driver.session()
    const txc = session.beginTransaction()

    await expectAsync(txc.run('RETURN 1')).toBeRejectedWith(
      jasmine.objectContaining({
        code: neo4j.error.SERVICE_UNAVAILABLE
      })
    )

    await session.close()
  }, 10000)

  it('should fail with correct error message when connecting to port 80', done => {
    if (testUtils.isClient()) {
      // good error message is not available in browser
      done()
      return
    }

    driver = neo4j.driver('bolt://localhost:80', sharedNeo4j.authToken)

    driver
      .session()
      .run('RETURN 1')
      .then(result => {
        done.fail(
          'Should not be able to connect. Result: ' + JSON.stringify(result)
        )
      })
      .catch(error => {
        const doesNotContainAddress = error.message.indexOf(':80') < 0
        const doesNotContainBetterErrorMessage =
          error.message.indexOf('Failed to connect to server') < 0
        if (doesNotContainAddress) {
          done.fail(`Expected to contain ':80' but was: ${error.message}`)
        } else if (doesNotContainBetterErrorMessage) {
          done.fail(
            `Expected to contain 'Failed to connect to server' but was: ${error.message}`
          )
        } else {
          expect(error.code).toEqual(neo4j.error.SERVICE_UNAVAILABLE)
          done()
        }
      })
  })

  it('should handle wrong scheme', () => {
    expect(() =>
      neo4j.driver('tank://localhost', sharedNeo4j.authToken)
    ).toThrow(new Error('Unknown scheme: tank'))
  })

  it('should handle URL parameter string', () => {
    expect(() => neo4j.driver({ uri: 'bolt://localhost' })).toThrowError(
      TypeError
    )

    expect(() => neo4j.driver(['bolt:localhost'])).toThrowError(TypeError)

    expect(() => {
      const driver = neo4j.driver(
        String('bolt://localhost'),
        sharedNeo4j.authToken
      )
      return driver.session()
    }).toBeDefined()
  })

  it('should fail early on wrong credentials', async () => {
    // Given
    driver = neo4j.driver('bolt://localhost', wrongCredentials())
    const session = driver.session()
    const txc = session.beginTransaction()

    await expectAsync(txc.run('RETURN 1')).toBeRejectedWith(
      jasmine.objectContaining({
        code: 'Neo.ClientError.Security.Unauthorized'
      })
    )

    await session.close()
  })

  it('should fail queries on wrong credentials', done => {
    driver = neo4j.driver('bolt://localhost', wrongCredentials())

    const session = driver.session()
    session.run('RETURN 1').catch(error => {
      expect(error.code).toEqual('Neo.ClientError.Security.Unauthorized')
      done()
    })
  })

  it('should indicate success early on correct credentials', done => {
    // Given
    driver = neo4j.driver('bolt://localhost', sharedNeo4j.authToken)

    // Expect
    driver.verifyConnectivity().then(server => {
      expect(server.address).toBeDefined()
      done()
    })
  })

  it('should be possible to pass a realm with basic auth tokens', done => {
    // Given
    driver = neo4j.driver(
      'bolt://localhost',
      neo4j.auth.basic(sharedNeo4j.username, sharedNeo4j.password, 'native')
    )

    // Expect
    driver.verifyConnectivity().then(server => {
      expect(server.address).toBeDefined()
      done()
    })
  })

  it('should be possible to create custom auth tokens', done => {
    // Given
    driver = neo4j.driver(
      'bolt://localhost',
      neo4j.auth.custom(
        sharedNeo4j.username,
        sharedNeo4j.password,
        'native',
        'basic'
      )
    )

    // Expect
    driver.verifyConnectivity().then(server => {
      expect(server.address).toBeDefined()
      done()
    })
  })

  it('should be possible to create custom auth tokens with additional parameters', done => {
    // Given
    driver = neo4j.driver(
      'bolt://localhost',
      neo4j.auth.custom(
        sharedNeo4j.username,
        sharedNeo4j.password,
        'native',
        'basic',
        { secret: 42 }
      )
    )

    // Expect
    driver.verifyConnectivity().then(server => {
      expect(server.address).toBeDefined()
      done()
    })
  })

  it('should fail nicely when connecting with routing to standalone server', async () => {
    if (!routingProcedureOnlyAvailableOnCores()) {
      return Promise.resolve(null)
    }

    // Given
    driver = neo4j.driver('neo4j://localhost', sharedNeo4j.authToken)
    const session = driver.session()

    await expectAsync(session.run('RETURN 1')).toBeRejectedWith(
      jasmine.objectContaining({
        code: neo4j.error.SERVICE_UNAVAILABLE,
        message: jasmine.stringMatching(/No routing servers available/)
      })
    )

    await session.close()
  })

  it('should have correct user agent', async () => {
    const directDriver = neo4j.driver('bolt://localhost')
    expect(directDriver._userAgent).toBe('neo4j-javascript/0.0.0-dev')
    await directDriver.close()

    const routingDriver = neo4j.driver('neo4j://localhost')
    expect(routingDriver._userAgent).toBe('neo4j-javascript/0.0.0-dev')
    await routingDriver.close()
  })

  it('should fail when bolt:// scheme used with routing params', () => {
    expect(() =>
      neo4j.driver('bolt://localhost:7687/?policy=my_policy')
    ).toThrow()
  })

  it('should sanitize pool setting values in the config', async () => {
    await testConfigSanitizing('maxConnectionLifetime', 60 * 60 * 1000)
    await testConfigSanitizing('maxConnectionPoolSize', DEFAULT_MAX_SIZE)
    await testConfigSanitizing(
      'connectionAcquisitionTimeout',
      DEFAULT_ACQUISITION_TIMEOUT
    )
  })

  it('should validate fetch size in the config', async () => {
    await validateConfigSanitizing({}, 1000)
    await validateConfigSanitizing({ fetchSize: 42 }, 42)
    await validateConfigSanitizing({ fetchSize: -1 }, -1)
    await validateConfigSanitizing({ fetchSize: '42' }, 42)
    await validateConfigSanitizing({ fetchSize: '-1' }, -1)
  })

  it('should fail when fetch size is negative', () => {
    expect(() =>
      neo4j.driver('bolt://localhost', sharedNeo4j.authToken, {
        fetchSize: -77
      })
    ).toThrow()
  })

  it('should fail when fetch size is 0', () => {
    expect(() =>
      neo4j.driver('bolt://localhost', sharedNeo4j.authToken, { fetchSize: 0 })
    ).toThrow()
  })

  it('should discard closed connections', async () => {
    driver = neo4j.driver('bolt://localhost', sharedNeo4j.authToken)

    const session1 = driver.session()
    await session1.run('CREATE () RETURN 42')
    await session1.close()

    // one connection should be established
    const connections1 = openConnectionFrom(driver)
    expect(connections1.length).toEqual(1)

    // close/break existing pooled connection
    await Promise.all(connections1.map(connection => connection.close()))

    const session2 = driver.session()
    await session2.run('RETURN 1')
    await session2.close()

    // existing connection should be disposed and new one should be created
    const connections2 = openConnectionFrom(driver)
    expect(connections2.length).toEqual(1)

    expect(connections1[0]).not.toEqual(connections2[0])
  })

  it('should discard old connections', async () => {
    const maxLifetime = 100000
    driver = neo4j.driver('bolt://localhost', sharedNeo4j.authToken, {
      maxConnectionLifetime: maxLifetime
    })

    const session1 = driver.session()
    await session1.run('CREATE () RETURN 42')
    await session1.close()

    // one connection should be established
    const connections1 = openConnectionFrom(driver)
    expect(connections1.length).toEqual(1)

    // make existing connection look very old by advancing the `Date.now()` value
    const currentTime = Date.now()
    const clock = lolex.install()
    try {
      clock.setSystemTime(currentTime + maxLifetime * 2)

      const session2 = driver.session()
      await session2.run('RETURN 1')
      await session2.close()

      // old connection should be disposed and new one should be created
      const connections2 = openConnectionFrom(driver)
      expect(connections2.length).toEqual(1)

      expect(connections1[0]).not.toEqual(connections2[0])
    } finally {
      clock.uninstall()
    }
  })

  const exposedTypes = [
    'Node',
    'Path',
    'PathSegment',
    'Record',
    'Relationship',
    'Result',
    'ResultSummary',
    'UnboundRelationship'
  ]

  exposedTypes.forEach(type => {
    it(`should expose type ${type}`, () => {
      expect(undefined === neo4j.types[type]).toBe(false)
    })
  })

  it('should connect to IPv6 address without port', done => {
    testIPv6Connection('bolt://[::1]', done)
  })

  it('should connect to IPv6 address with port', done => {
    testIPv6Connection('bolt://[::1]:7687', done)
  })

  const nativeNumbers = [
    Number.NEGATIVE_INFINITY,
    Number.POSITIVE_INFINITY,
    Number.MIN_SAFE_INTEGER,
    Number.MAX_SAFE_INTEGER,
    -0,
    0,
    -42,
    42,
    -999,
    999,
    -1000,
    1000,
    -9000000,
    9000000,
    Number.MIN_SAFE_INTEGER + 1,
    Number.MAX_SAFE_INTEGER - 1
  ]

  nativeNumbers.forEach(number => {
    it(`should return native number ${number} when disableLosslessIntegers=true`, done => {
      testNumberInReturnedRecord(number, number, done)
    })
  })

  const integersWithNativeNumberEquivalent = [
    [neo4j.int(0), 0],
    [neo4j.int(42), 42],
    [neo4j.int(-100), -100],
    [neo4j.int(Number.MIN_SAFE_INTEGER), Number.MIN_SAFE_INTEGER],
    [neo4j.int(Number.MAX_SAFE_INTEGER), Number.MAX_SAFE_INTEGER],
    [neo4j.int('-9007199254740992'), Number.NEGATIVE_INFINITY], // Number.MIN_SAFE_INTEGER - 1
    [neo4j.int('9007199254740992'), Number.POSITIVE_INFINITY], // Number.MAX_SAFE_INTEGER + 1
    [neo4j.int('-9007199254749999'), Number.NEGATIVE_INFINITY], // Number.MIN_SAFE_INTEGER - 9007
    [neo4j.int('9007199254749999'), Number.POSITIVE_INFINITY] // Number.MAX_SAFE_INTEGER + 9008
  ]

  integersWithNativeNumberEquivalent.forEach(integerWithNativeNumber => {
    const integer = integerWithNativeNumber[0]
    const nativeNumber = integerWithNativeNumber[1]

    it(`should send Integer ${integer.toString()} and return native number ${nativeNumber} when disableLosslessIntegers=true`, done => {
      testNumberInReturnedRecord(integer, nativeNumber, done)
    })
  })

  function testIPv6Connection (url, done) {
    driver = neo4j.driver(url, sharedNeo4j.authToken)

    const session = driver.session()
    session
      .run('RETURN 42')
      .then(result => {
        expect(result.records[0].get(0).toNumber()).toEqual(42)
      })
      .then(() => session.close())
      .then(() => done())
  }

  function testNumberInReturnedRecord (inputNumber, expectedNumber, done) {
    driver = neo4j.driver('bolt://localhost', sharedNeo4j.authToken, {
      disableLosslessIntegers: true
    })

    const session = driver.session()
    session
      .run('RETURN $number AS n0, $number AS n1', { number: inputNumber })
      .then(result => {
        const records = result.records
        expect(records.length).toEqual(1)
        const record = records[0]

        expect(record.get('n0')).toEqual(expectedNumber)
        expect(record.get('n1')).toEqual(expectedNumber)

        expect(record.get(0)).toEqual(expectedNumber)
        expect(record.get(1)).toEqual(expectedNumber)

        expect(record.toObject()).toEqual({
          n0: expectedNumber,
          n1: expectedNumber
        })
      })
      .then(() => session.close())
      .then(() => done())
  }

  /**
   * Starts new transaction to force new network connection.
   * @param {Driver} driver - the driver to use.
   */
  function startNewTransaction (driver) {
    const session = driver.session()
    expect(session.beginTransaction()).toBeDefined()
  }

  function wrongCredentials () {
    return neo4j.auth.basic('neo4j', 'who would use such a password')
  }

  async function testConfigSanitizing (configProperty, defaultValue) {
    await validateConfigSanitizing({}, defaultValue)
    await validateConfigSanitizing({ [configProperty]: 42 }, 42)
    await validateConfigSanitizing({ [configProperty]: 0 }, 0)
    await validateConfigSanitizing({ [configProperty]: '42' }, 42)
    await validateConfigSanitizing({ [configProperty]: '042' }, 42)
    await validateConfigSanitizing(
      { [configProperty]: -42 },
      Number.MAX_SAFE_INTEGER
    )
  }

  async function validateConfigSanitizing (
    config,
    configProperty,
    expectedValue
  ) {
    const driver = neo4j.driver(
      'bolt://localhost',
      sharedNeo4j.authToken,
      config
    )
    try {
      expect(driver._config[configProperty]).toEqual(expectedValue)
    } finally {
      await driver.close()
    }
  }

  function openConnectionFrom (driver) {
    return Array.from(
      Object.values(driver._connectionProvider._openConnections)
    )
  }

  function routingProcedureOnlyAvailableOnCores () {
    return protocolVersion < 4.0
  }
})
