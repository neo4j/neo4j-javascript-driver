/**
 * Copyright (c) 2002-2019 "Neo4j,"
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

import neo4j from '../../../src'
import sharedNeo4j from '../shared-neo4j'

describe('#integration encryption', () => {
  let originalTimeout

  beforeEach(() => {
    originalTimeout = jasmine.DEFAULT_TIMEOUT_INTERVAL
    jasmine.DEFAULT_TIMEOUT_INTERVAL = 90000
  })

  afterEach(() => {
    jasmine.DEFAULT_TIMEOUT_INTERVAL = originalTimeout
  })

  afterAll(() => {
    sharedNeo4j.restart()
  })

  it('should be able to connect when encryption is off and tls_level is DISABLED', () =>
    verifyEncryption(false, sharedNeo4j.tlsConfig.levels.disabled, null, true))

  it('should not be able to connect when encryption is on and tls_level is DISABLED', () =>
    verifyEncryption(true, sharedNeo4j.tlsConfig.levels.disabled, null, false))

  it('should be able to connect when encryption is off and tls_level is OPTIONAL', () =>
    verifyEncryption(false, sharedNeo4j.tlsConfig.levels.optional, null, true))

  it('should not be able to connect when encryption is on and tls_level is OPTIONAL', () =>
    verifyEncryption(true, sharedNeo4j.tlsConfig.levels.optional, null, false))

  it('should be able to connect when encryption is on, tls_level is OPTIONAL and trust is TRUST_ALL', () =>
    verifyEncryption(
      true,
      sharedNeo4j.tlsConfig.levels.optional,
      'TRUST_ALL_CERTIFICATES',
      true
    ))

  it('should not be able to connect when encryption is off and tls_level is REQUIRED', () =>
    verifyEncryption(false, sharedNeo4j.tlsConfig.levels.required, null, false))

  it('should not be able to connect when encryption is on and tls_level is REQUIRED', () =>
    verifyEncryption(true, sharedNeo4j.tlsConfig.levels.required, null, false))

  it('should be able to connect when encryption is on, tls_level is REQUIRED and trust is TRUST_ALL', () =>
    verifyEncryption(
      true,
      sharedNeo4j.tlsConfig.levels.required,
      'TRUST_ALL_CERTIFICATES',
      true
    ))

  async function verifyEncryption (encrypted, tlsLevel, trust, expectToSucceed) {
    sharedNeo4j.restart(tlsConfig(tlsLevel))

    const config = {
      encrypted: encrypted
    }
    if (trust) {
      config.trust = trust
    }
    const driver = neo4j.driver(
      'bolt://localhost',
      sharedNeo4j.authToken,
      config
    )
    const session = driver.session()

    if (expectToSucceed) {
      await expectAsync(session.run('CREATE (n) RETURN n')).toBeResolved()
    } else {
      await expectAsync(session.run('CREATE (n) RETURN n')).toBeRejected()
    }

    await session.close()
    await driver.close()
  }

  function tlsConfig (tlsLevel) {
    const config = {}
    config[sharedNeo4j.tlsConfig.key] = tlsLevel
    return config
  }
})
