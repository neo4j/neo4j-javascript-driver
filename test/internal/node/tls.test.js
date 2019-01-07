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

import neo4j from '../../../src/v1';
import fs from 'fs';
import path from 'path';
import sharedNeo4j from '../shared-neo4j';

describe('trust-signed-certificates', () => {

  let driver;
  let log;

  beforeEach(() => {
    log = muteConsoleLog();
  });

  afterEach(() => {
    if (driver) {
      driver.close();
    }
    unMuteConsoleLog(log);
  });

  it('should reject unknown certificates', done => {
    // Given
    driver = neo4j.driver("bolt://localhost", sharedNeo4j.authToken, {
      encrypted: "ENCRYPTION_ON",
      trust: "TRUST_SIGNED_CERTIFICATES",
      trustedCertificates: ["test/resources/random.certificate"]
    });

    // When
    driver.session().run('RETURN 1').catch(err => {
      expect( err.message ).toContain( "Server certificate is not trusted" );
      done();
    });
  });

  it('should accept known certificates', done => {
    // Given
    driver = neo4j.driver("bolt://localhost", sharedNeo4j.authToken, {
      encrypted: "ENCRYPTION_ON",
      trust: "TRUST_SIGNED_CERTIFICATES",
      trustedCertificates: [neo4jCertPath()]
    });

    // When
    driver.session().run( "RETURN 1").then( done );
  });

  it('should handle multiple certificates', done => {
    // Given
    driver = neo4j.driver("bolt://localhost", sharedNeo4j.authToken, {
      encrypted: true,
      trust: "TRUST_SIGNED_CERTIFICATES",
      trustedCertificates: [neo4jCertPath(), neo4jCertPath()]
    });

    // When
    driver.session().run( "RETURN 1").then( done );
  });
});

describe('trust-all-certificates', () => {

  let driver;

  afterEach(() => {
    if (driver) {
      driver.close();
    }
  });

  it('should work with default certificate', done => {
    // Given
    driver = neo4j.driver("bolt://localhost", sharedNeo4j.authToken, {
      encrypted: "ENCRYPTION_ON",
      trust: "TRUST_ALL_CERTIFICATES"
    });

    // When
    driver.session().run('RETURN 1').then(result => {
      expect(result.records[0].get(0).toNumber()).toBe(1);
      done();
    });
  });
});

describe('trust-custom-ca-signed-certificates', () => {

  let driver;

  afterEach(() => {
    if (driver) {
      driver.close();
    }
  });

  it('should reject unknown certificates', done => {
    // Given
    driver = neo4j.driver("bolt://localhost", sharedNeo4j.authToken, {
      encrypted: true,
      trust: "TRUST_CUSTOM_CA_SIGNED_CERTIFICATES",
      trustedCertificates: ["test/resources/random.certificate"]
    });

    // When
    driver.session().run('RETURN 1').catch(err => {
      expect( err.message ).toContain( "Server certificate is not trusted" );
      done();
    });
  });

  it('should accept known certificates', done => {
    // Given
    driver = neo4j.driver("bolt://localhost", sharedNeo4j.authToken, {
      encrypted: true,
      trust: "TRUST_CUSTOM_CA_SIGNED_CERTIFICATES",
      trustedCertificates: [neo4jCertPath()]
    });

    // When
    driver.session().run( "RETURN 1").then( done );
  });
});

describe('trust-system-ca-signed-certificates', () => {

  let driver;

  afterEach(() => {
    if (driver) {
      driver.close();
    }
  });

  it('should reject unknown certificates', done => {
    // Given
    driver = neo4j.driver("bolt://localhost", sharedNeo4j.authToken, {
      encrypted: true,
      trust: "TRUST_SYSTEM_CA_SIGNED_CERTIFICATES"
    });

    // When
    driver.session().run('RETURN 1').catch(err => {
      expect( err.message ).toContain( "Server certificate is not trusted" );
      done();
    });
  });
});

describe('trust-on-first-use', () => {

  let driver;
  let log;

  beforeEach(() => {
    log = muteConsoleLog();
  });

  afterEach(() => {
    unMuteConsoleLog(log);
    if( driver ) {
      driver.close();
    }
  });

  it('should create known_hosts file including full path if it doesn\'t exist', done => {
    // Assuming we only run this test on NodeJS with TOFU support
    if (!trustOnFirstUseAvailable()) {
      done();
      return;
    }

    // Given
    // Non existing directory
    const knownHostsDir = path.join('build', 'hosts');
    const knownHostsPath = path.join(knownHostsDir, 'known_hosts');
    try {
      fs.unlinkSync(knownHostsPath);
    } catch (_) { }
    try {
      fs.rmdirSync(knownHostsDir);
    } catch (_) { }

    driver = neo4j.driver("bolt://localhost", sharedNeo4j.authToken, {
      encrypted: true,
      trust: "TRUST_ON_FIRST_USE",
      knownHosts: knownHostsPath
    });

    // When
    driver.session().run('RETURN 1').then(() => {
      // Then we get to here.
      // And then the known_hosts file should have been created
      expect(() => {
        fs.accessSync(knownHostsPath);
      }).not.toThrow();
      done();
    }).catch(() => {
      // Just here to gracefully exit test on failure so we don't get timeouts
      // when done() isn't called.
      expect( 'this' ).toBe( 'to never happen' );
      done();
    });
  });

  it('should not throw an error if the host file contains two host duplicates', done => {
    // Assuming we only run this test on NodeJS with TOFU support
    if (!trustOnFirstUseAvailable()) {
      done();
      return;
    }

    // Given
    const knownHostsPath = 'build/known_hosts';
    if( fs.existsSync(knownHostsPath) ) {
      fs.unlinkSync(knownHostsPath);
    }

    driver = neo4j.driver("bolt://localhost", sharedNeo4j.authToken, {
      encrypted: true,
      trust: "TRUST_ON_FIRST_USE",
      knownHosts: knownHostsPath
    });

    // create session and transaction to force creation of new connection and writing into the knownHost file
    const session = driver.session();
    expect(session.beginTransaction()).toBeDefined();

    // duplicate the same serverId twice
    setTimeout(() => {
      const text = fs.readFileSync(knownHostsPath, 'utf8');
      fs.writeFileSync(knownHostsPath, text + text);
    }, 1000);

    // When
    setTimeout(() => {
      driver.session().run('RETURN true AS a').then(data => {
        // Then we get to here.
        expect( data.records[0].get('a') ).toBe( true );
        done();
      });
    }, 2000);
  });

  it('should accept previously un-seen hosts', done => {
    // Assuming we only run this test on NodeJS with TOFU support
    if (!trustOnFirstUseAvailable()) {
      done();
      return;
    }

    // Given
    const knownHostsPath = 'build/known_hosts';
    if( fs.existsSync(knownHostsPath) ) {
      fs.unlinkSync(knownHostsPath);
    }

    driver = neo4j.driver("bolt://localhost", sharedNeo4j.authToken, {
      encrypted: "ENCRYPTION_ON",
      trust: "TRUST_ON_FIRST_USE",
      knownHosts: knownHostsPath
    });

    // When
    driver.session().run('RETURN 1').then(() => {
      // Then we get to here.
      // And then the known_hosts file should have correct contents
      expect( fs.readFileSync(knownHostsPath, 'utf8') ).toContain( "localhost:7687" );
      done();
    });
  });

  it('should not duplicate fingerprint entries', done => {
    // Assuming we only run this test on NodeJS with TOFU support
    if (!trustOnFirstUseAvailable()) {
      done();
      return;
    }

    // Given
    const knownHostsPath = 'build/known_hosts';
    if( fs.existsSync(knownHostsPath) ) {
      fs.unlinkSync(knownHostsPath);
    }
    fs.writeFileSync(knownHostsPath, '');

    driver = neo4j.driver("bolt://localhost", sharedNeo4j.authToken, {
      encrypted: true,
      trust: "TRUST_ON_FIRST_USE",
      knownHosts: knownHostsPath
    });

    // When
    driver.session();
    driver.session();

    // Then
    setTimeout(() => {
      const lines = {};
      fs.readFileSync(knownHostsPath, 'utf8')
          .split('\n')
        .filter(line => !!(line.trim()))
        .forEach(line => {
            if (!lines[line]) {
              lines[line] = 0;
            }
            lines[line]++;
          });

      const duplicatedLines = Object
        .keys(lines)
        .map(line => lines[line])
        .filter(count => count > 1)
        .length;

      expect( duplicatedLines ).toBe( 0 );
      done();
    }, 1000);
  });

  it('should should give helpful error if database cert does not match stored certificate', done => {
    // Assuming we only run this test on NodeJS with TOFU support
    if (!trustOnFirstUseAvailable()) {
      done();
      return;
    }

    // Given
    const knownHostsPath = 'test/resources/random_known_hosts';

    driver = neo4j.driver("bolt://localhost", sharedNeo4j.authToken, {
      encrypted: "ENCRYPTION_ON",
      trust: "TRUST_ON_FIRST_USE",
      knownHosts: knownHostsPath
    });

    // When
    driver.session().run('RETURN 1').catch(error => {
      expect(error.message).toContain("Database encryption certificate has changed, " +
        "and no longer matches the certificate stored for localhost:7687");
      done();
    });
  });
});

// To mute deprecation message in test output
function muteConsoleLog() {
  const originalLog = console.log;
  console.log = () => {};
  return originalLog;
}

function unMuteConsoleLog(originalLog) {
  console.log = originalLog;
}

function neo4jCertPath() {
  return sharedNeo4j.neo4jCertPath(path.join('build', 'neo4j'));
}

function trustOnFirstUseAvailable() {
  try {
    // We are verifying that we have a version of getPeerCertificate
    // that supports reading the whole certificate, eg this commit:
    // https://github.com/nodejs/node/commit/345c40b6
    require.resolve('tls');
    const getPeerCertificateFunction = require('tls').TLSSocket.prototype.getPeerCertificate;
    const numberOfParameters = getPeerCertificateFunction.length;
    return numberOfParameters >= 1;
  } catch (e) {
    return false;
  }
}
