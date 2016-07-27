/**
 * Copyright (c) 2002-2016 "Neo Technology,"
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
var NodeChannel = require('../../lib/v1/internal/ch-node.js');
var neo4j = require("../../lib/v1");
var fs = require("fs");
var hasFeature = require("../../lib/v1/internal/features");

describe('trust-signed-certificates', function() {

  var driver;

  it('should reject unknown certificates', function(done) {
    // Assuming we only run this test on NodeJS
    if( !NodeChannel.available ) {
      done();
      return;
    }

    // Given
    driver = neo4j.driver("bolt://localhost", neo4j.auth.basic("neo4j", "neo4j"), {
      encrypted: true,
      trust: "TRUST_SIGNED_CERTIFICATES",
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
    driver = neo4j.driver("bolt://localhost", neo4j.auth.basic("neo4j", "neo4j"), {
      encrypted: true,
      trust: "TRUST_SIGNED_CERTIFICATES",
      trustedCertificates: ["build/neo4j/certificates/neo4j.cert"]
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


describe('trust-on-first-use', function() {

  var driver;

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

    driver = neo4j.driver("bolt://localhost", neo4j.auth.basic("neo4j", "neo4j"), {
      encrypted: true,
      trust: "TRUST_ON_FIRST_USE",
      knownHosts: knownHostsPath
    });

    driver.session(); // write into the knownHost file

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

    driver = neo4j.driver("bolt://localhost", neo4j.auth.basic("neo4j", "neo4j"), {
      encrypted: true,
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
  
  it('should should give helpful error if database cert does not match stored certificate', function(done) {
    // Assuming we only run this test on NodeJS with TOFU support
    if( !hasFeature("trust_on_first_use") ) {
      done();
      return;
    }

    // Given
    var knownHostsPath = "test/resources/random_known_hosts";

    driver = neo4j.driver("bolt://localhost", neo4j.auth.basic("neo4j", "neo4j"), {
      encrypted: true,
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
