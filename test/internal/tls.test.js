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

import NodeChannel from '../../src/v1/internal/ch-node';
import neo4j from '../../src/v1';
import fs from 'fs';
import path from 'path';
import hasFeature from '../../src/v1/internal/features';
import sharedNeo4j from '../internal/shared-neo4j';

describe('trust-signed-certificates', function() {

  var driver;
  var log;
  beforeEach(function() {
    log = muteConsoleLog();
  });
  it('should reject unknown certificates', function(done) {
    // Assuming we only run this test on NodeJS
    if( !NodeChannel.available ) {
      done();
      return;
    }

    // Given
    driver = neo4j.driver("bolt://localhost", sharedNeo4j.authToken, {
      encrypted: "ENCRYPTION_ON",
      trust: "TRUST_SIGNED_CERTIFICATES",
      trustedCertificates: ["test/resources/random.certificate"]
    });

    // When
    driver.session().run( "RETURN 1").catch( function(err) {
      expect( err.message ).toContain( "Server certificate is not trusted" );
      done();
    });
  });

  it('should accept known certificates', function (done) {
    // Assuming we only run this test on NodeJS with TOFU support
    if( !NodeChannel.available ) {
      done();
      return;
    }

    // Given
    driver = neo4j.driver("bolt://localhost", sharedNeo4j.authToken, {
      encrypted: "ENCRYPTION_ON",
      trust: "TRUST_SIGNED_CERTIFICATES",
      trustedCertificates: [neo4jCertPath()]
    });

    // When
    driver.session().run( "RETURN 1").then( done );
  });

  it('should handle multiple certificates', function(done) {
    // Assuming we only run this test on NodeJS with TOFU support
    if( !NodeChannel.available ) {
      done();
      return;
    }

    // Given
    driver = neo4j.driver("bolt://localhost", sharedNeo4j.authToken, {
      encrypted: true,
      trust: "TRUST_SIGNED_CERTIFICATES",
      trustedCertificates: [neo4jCertPath(), neo4jCertPath()]
    });

    // When
    driver.session().run( "RETURN 1").then( done );
  });

  afterEach(function(){
    if( driver ) {
      driver.close();
    }
    unMuteConsoleLog(log);
  });
});

describe('trust-all-certificates', function () {

  var driver;
  it('should work with default certificate', function (done) {
    // Assuming we only run this test on NodeJS with TAC support
    if (!hasFeature("trust_all_certificates")) {
      done();
      return;
    }

    // Given
    driver = neo4j.driver("bolt://localhost", sharedNeo4j.authToken, {
      encrypted: "ENCRYPTION_ON",
      trust: "TRUST_ALL_CERTIFICATES"
    });

    // When
    driver.session().run("RETURN 1").then(function (result) {
      expect(result.records[0].get(0).toNumber()).toBe(1);
      done();
    });
  });

  afterEach(function () {
    if (driver) {
      driver.close();
    }
  });
});

describe('trust-custom-ca-signed-certificates', function() {

  var driver;
  it('should reject unknown certificates', function(done) {
    // Assuming we only run this test on NodeJS
    if( !NodeChannel.available ) {
      done();
      return;
    }

    // Given
    driver = neo4j.driver("bolt://localhost", sharedNeo4j.authToken, {
      encrypted: true,
      trust: "TRUST_CUSTOM_CA_SIGNED_CERTIFICATES",
      trustedCertificates: ["test/resources/random.certificate"]
    });

    // When
    driver.session().run( "RETURN 1").catch( function(err) {
      expect( err.message ).toContain( "Server certificate is not trusted" );
      done();
    });
  });

  it('should accept known certificates', function(done) {
    // Assuming we only run this test on NodeJS with TOFU support
    if( !NodeChannel.available ) {
      done();
      return;
    }

    // Given
    driver = neo4j.driver("bolt://localhost", sharedNeo4j.authToken, {
      encrypted: true,
      trust: "TRUST_CUSTOM_CA_SIGNED_CERTIFICATES",
      trustedCertificates: [neo4jCertPath()]
    });

    // When
    driver.session().run( "RETURN 1").then( done );
  });

  afterEach(function(){
    if( driver ) {
      driver.close();
    }
  });
});

describe('trust-system-ca-signed-certificates', function() {

  var driver;

  it('should reject unknown certificates', function(done) {
    // Assuming we only run this test on NodeJS
    if( !NodeChannel.available ) {
      done();
      return;
    }

    // Given
    driver = neo4j.driver("bolt://localhost", sharedNeo4j.authToken, {
      encrypted: true,
      trust: "TRUST_SYSTEM_CA_SIGNED_CERTIFICATES"
    });

    // When
    driver.session().run( "RETURN 1").catch( function(err) {
      expect( err.message ).toContain( "Server certificate is not trusted" );
      done();
    });
  });

  afterEach(function () {
    if (driver) {
      driver.close();
    }
  });
});

describe('trust-on-first-use', function() {

  var driver;
  var log;
  beforeEach(function() {
    log = muteConsoleLog();
  });
  afterEach(function(){
    unMuteConsoleLog(log);
    if( driver ) {
      driver.close();
    }
  });
  it("should create known_hosts file including full path if it doesn't exist", function(done) {
    // Assuming we only run this test on NodeJS with TOFU support
    if( !hasFeature("trust_on_first_use") ) {
      done();
      return;
    }

    // Given
    // Non existing directory
    var knownHostsDir = path.join("build", "hosts");
    var knownHostsPath = path.join(knownHostsDir, "known_hosts");
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
    driver.session().run( "RETURN 1").then( function() {
      // Then we get to here.
      // And then the known_hosts file should have been created
      expect( function() { fs.accessSync(knownHostsPath) }).not.toThrow()
      done();
    }).catch( function(){
      // Just here to gracefully exit test on failure so we don't get timeouts
      // when done() isn't called.
      expect( 'this' ).toBe( 'to never happen' );
      done();
    });
  });

  it('should not throw an error if the host file contains two host duplicates', function(done) {
    'use strict';
    // Assuming we only run this test on NodeJS with TOFU support
    if( !hasFeature("trust_on_first_use") ) {
      done();
      return;
    }

    // Given
    var knownHostsPath = "build/known_hosts";
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
    setTimeout(function() {
      var text = fs.readFileSync(knownHostsPath, 'utf8');
      fs.writeFileSync(knownHostsPath, text + text);
    }, 1000);

    // When
    setTimeout(function() {
      driver.session().run("RETURN true AS a").then( function(data) {
        // Then we get to here.
        expect( data.records[0].get('a') ).toBe( true );
        done();
      });
    }, 2000);
  });

  it('should accept previously un-seen hosts', function(done) {
    // Assuming we only run this test on NodeJS with TOFU support
    if( !hasFeature("trust_on_first_use") ) {
      done();
      return;
    }

    // Given
    var knownHostsPath = "build/known_hosts";
    if( fs.existsSync(knownHostsPath) ) {
      fs.unlinkSync(knownHostsPath);
    }

    driver = neo4j.driver("bolt://localhost", sharedNeo4j.authToken, {
      encrypted: "ENCRYPTION_ON",
      trust: "TRUST_ON_FIRST_USE",
      knownHosts: knownHostsPath
    });

    // When
    driver.session().run( "RETURN 1").then( function() {
      // Then we get to here.
      // And then the known_hosts file should have correct contents
      expect( fs.readFileSync(knownHostsPath, 'utf8') ).toContain( "localhost:7687" );
      done();
    });
  });

  it('should not duplicate fingerprint entries', function(done) {
    // Assuming we only run this test on NodeJS with TOFU support
    if( !hasFeature("trust_on_first_use") ) {
      done();
      return;
    }

    // Given
    var knownHostsPath = "build/known_hosts";
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
    setTimeout(function() {
      var lines = {};
      fs.readFileSync(knownHostsPath, 'utf8')
          .split('\n')
          .filter(function(line) {
            return !! (line.trim());
          })
          .forEach(function(line) {
            if (!lines[line]) {
              lines[line] = 0;
            }
            lines[line]++;
          });

      var duplicatedLines = Object
          .keys(lines)
          .map(function(line) {
            return lines[line];
          })
          .filter(function(count) {
            return count > 1;
          })
          .length;

      expect( duplicatedLines ).toBe( 0 );
      done();
    }, 1000);
  });

  it('should should give helpful error if database cert does not match stored certificate', function(done) {
    // Assuming we only run this test on NodeJS with TOFU support
    if( !hasFeature("trust_on_first_use") ) {
      done();
      return;
    }

    // Given
    var knownHostsPath = "test/resources/random_known_hosts";

    driver = neo4j.driver("bolt://localhost", sharedNeo4j.authToken, {
      encrypted: "ENCRYPTION_ON",
      trust: "TRUST_ON_FIRST_USE",
      knownHosts: knownHostsPath
    });

    // When
    driver.session().run( "RETURN 1").catch( function(error) {
      expect(error.message).toContain("Database encryption certificate has changed, " +
        "and no longer matches the certificate stored for localhost:7687");
      done();
    });
  });

  afterEach(function(){
    if( driver ) {
      driver.close();
    }
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
