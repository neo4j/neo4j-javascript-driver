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

var neo4j = require("../../lib/v1");
var boltkit = require('./boltkit');
describe('routing driver ', function() {

  it('should discover server', function (done) {
    if (!boltkit.BoltKitSupport) {
      done();
      return;
    }
    // Given
    var kit = new boltkit.BoltKit();
    var server = kit.start('./test/resources/boltkit/discover_servers.script', 9001);

    kit.run(function () {
      var driver = neo4j.driver("bolt+routing://127.0.0.1:9001", neo4j.auth.basic("neo4j", "neo4j"));
      // When
      var session = driver.session();
        session.run("MATCH (n) RETURN n.name").then(function() {

          session.close();
          // Then
          expect(driver._pool.has('127.0.0.1:9001')).toBeTruthy();
          expect(driver._clusterView.routers.toArray()).toEqual(["127.0.0.1:9001","127.0.0.1:9002","127.0.0.1:9003"]);
          expect(driver._clusterView.readers.toArray()).toEqual(["127.0.0.1:9002","127.0.0.1:9003"]);
          expect(driver._clusterView.writers.toArray()).toEqual(["127.0.0.1:9001"]);

          driver.close();
          server.exit(function (code) {
            expect(code).toEqual(0);
            done();
          });
        });
    });
  });

  it('should discover new servers', function (done) {
    if (!boltkit.BoltKitSupport) {
      done();
      return;
    }
    // Given
    var kit = new boltkit.BoltKit();
    var server = kit.start('./test/resources/boltkit/discover_new_servers.script', 9001);

    kit.run(function () {
      var driver = neo4j.driver("bolt+routing://127.0.0.1:9001", neo4j.auth.basic("neo4j", "neo4j"));
      // When
      var session = driver.session();
      session.run("MATCH (n) RETURN n.name").then(function() {

        // Then
        expect(driver._clusterView.routers.toArray()).toEqual(["127.0.0.1:9004","127.0.0.1:9002","127.0.0.1:9003"]);
        expect(driver._clusterView.readers.toArray()).toEqual(["127.0.0.1:9005","127.0.0.1:9003"]);
        expect(driver._clusterView.writers.toArray()).toEqual(["127.0.0.1:9001"]);

        driver.close();
        server.exit(function (code) {
          expect(code).toEqual(0);
          done();
        });
      });
    });
  });

  it('should handle empty response from server', function (done) {
    if (!boltkit.BoltKitSupport) {
      done();
      return;
    }
    // Given
    var kit = new boltkit.BoltKit();
    var server = kit.start('./test/resources/boltkit/handle_empty_get_servers_response.script', 9001);

    kit.run(function () {
      var driver = neo4j.driver("bolt+routing://127.0.0.1:9001", neo4j.auth.basic("neo4j", "neo4j"));
      // When
      var session = driver.session(neo4j.READ);
      session.run("MATCH (n) RETURN n.name").catch(function (err) {
        expect(err.code).toEqual(neo4j.SERVICE_UNAVAILABLE);
        driver.close();
        server.exit(function (code) {
          expect(code).toEqual(0);
          done();
        });
      });
    });
  });

  it('should acquire read server', function (done) {
    if (!boltkit.BoltKitSupport) {
      done();
      return;
    }
    // Given
    var kit = new boltkit.BoltKit();
    var seedServer = kit.start('./test/resources/boltkit/acquire_endpoints.script', 9001);
    var readServer = kit.start('./test/resources/boltkit/read_server.script', 9005);

    kit.run(function () {
      var driver = neo4j.driver("bolt+routing://127.0.0.1:9001", neo4j.auth.basic("neo4j", "neo4j"));
      // When
      var session = driver.session(neo4j.READ);
      session.run("MATCH (n) RETURN n.name").then(function(res) {

        session.close();

        expect(driver._pool.has('127.0.0.1:9001')).toBeTruthy();
        expect(driver._pool.has('127.0.0.1:9005')).toBeTruthy();
        // Then
        expect(res.records[0].get('n.name')).toEqual('Bob');
        expect(res.records[1].get('n.name')).toEqual('Alice');
        expect(res.records[2].get('n.name')).toEqual('Tina');
        driver.close();
        seedServer.exit(function (code1) {
          readServer.exit(function (code2) {
            expect(code1).toEqual(0);
            expect(code2).toEqual(0);
            done();
          });
        });
      });
    });
  });

  it('should round-robin among read servers', function (done) {
    if (!boltkit.BoltKitSupport) {
      done();
      return;
    }
    // Given
    var kit = new boltkit.BoltKit();
    var seedServer = kit.start('./test/resources/boltkit/acquire_endpoints.script', 9001);
    var readServer1 = kit.start('./test/resources/boltkit/read_server.script', 9005);
    var readServer2 = kit.start('./test/resources/boltkit/read_server.script', 9006);

    kit.run(function () {
      var driver = neo4j.driver("bolt+routing://127.0.0.1:9001", neo4j.auth.basic("neo4j", "neo4j"));
      // When
      var session = driver.session(neo4j.READ);
      session.run("MATCH (n) RETURN n.name").then(function (res) {
        // Then
        expect(res.records[0].get('n.name')).toEqual('Bob');
        expect(res.records[1].get('n.name')).toEqual('Alice');
        expect(res.records[2].get('n.name')).toEqual('Tina');
        session.close();
        session = driver.session(neo4j.READ);
        session.run("MATCH (n) RETURN n.name").then(function (res) {
          // Then
          expect(res.records[0].get('n.name')).toEqual('Bob');
          expect(res.records[1].get('n.name')).toEqual('Alice');
          expect(res.records[2].get('n.name')).toEqual('Tina');
          session.close();

          driver.close();
          seedServer.exit(function (code1) {
            readServer1.exit(function (code2) {
              readServer2.exit(function (code3) {
                expect(code1).toEqual(0);
                expect(code2).toEqual(0);
                expect(code3).toEqual(0);
                done();
              });
            });
          });
        });
      });
    });
  });

  it('should handle missing read server', function (done) {
    if (!boltkit.BoltKitSupport) {
      done();
      return;
    }
    // Given
    var kit = new boltkit.BoltKit();
    var seedServer = kit.start('./test/resources/boltkit/acquire_endpoints.script', 9001);
    var readServer = kit.start('./test/resources/boltkit/dead_server.script', 9005);

    kit.run(function () {
      var driver = neo4j.driver("bolt+routing://127.0.0.1:9001", neo4j.auth.basic("neo4j", "neo4j"));
      // When
      var session = driver.session(neo4j.READ);
      session.run("MATCH (n) RETURN n.name").catch(function (err) {
        expect(err.code).toEqual(neo4j.SESSION_EXPIRED);
        driver.close();
        seedServer.exit(function (code1) {
          readServer.exit(function (code2) {
            expect(code1).toEqual(0);
            expect(code2).toEqual(0);
            done();
          });
        });
      });
    });
  });

  it('should acquire write server', function (done) {
    if (!boltkit.BoltKitSupport) {
      done();
      return;
    }
    // Given
    var kit = new boltkit.BoltKit();
    var seedServer = kit.start('./test/resources/boltkit/acquire_endpoints.script', 9001);
    var writeServer = kit.start('./test/resources/boltkit/write_server.script', 9007);

    kit.run(function () {
      var driver = neo4j.driver("bolt+routing://127.0.0.1:9001", neo4j.auth.basic("neo4j", "neo4j"));
      // When
      var session = driver.session(neo4j.WRITE);
      session.run("CREATE (n {name:'Bob'})").then(function() {

        // Then
        driver.close();
        seedServer.exit(function (code1) {
          writeServer.exit(function (code2) {
            expect(code1).toEqual(0);
            expect(code2).toEqual(0);
            done();
          });
        });
      });
    });
  });

  it('should round-robin among write servers', function (done) {
    if (!boltkit.BoltKitSupport) {
      done();
      return;
    }
    // Given
    var kit = new boltkit.BoltKit();
    var seedServer = kit.start('./test/resources/boltkit/acquire_endpoints.script', 9001);
    var readServer1 = kit.start('./test/resources/boltkit/write_server.script', 9007);
    var readServer2 = kit.start('./test/resources/boltkit/write_server.script', 9008);

    kit.run(function () {
      var driver = neo4j.driver("bolt+routing://127.0.0.1:9001", neo4j.auth.basic("neo4j", "neo4j"));
      // When
      var session = driver.session(neo4j.WRITE);
      session.run("CREATE (n {name:'Bob'})").then(function () {
        session = driver.session(neo4j.WRITE);
        session.run("CREATE (n {name:'Bob'})").then(function () {
          // Then
          driver.close();
          seedServer.exit(function (code1) {
            readServer1.exit(function (code2) {
              readServer2.exit(function (code3) {
                expect(code1).toEqual(0);
                expect(code2).toEqual(0);
                expect(code3).toEqual(0);
                done();
              });
            });
          });
        });
      });
    });
  });

  it('should handle missing write server', function (done) {
    if (!boltkit.BoltKitSupport) {
      done();
      return;
    }
    // Given
    var kit = new boltkit.BoltKit();
    var seedServer = kit.start('./test/resources/boltkit/acquire_endpoints.script', 9001);
    var readServer = kit.start('./test/resources/boltkit/dead_server.script', 9007);

    kit.run(function () {
      var driver = neo4j.driver("bolt+routing://127.0.0.1:9001", neo4j.auth.basic("neo4j", "neo4j"));
      // When
      var session = driver.session(neo4j.WRITE);
      session.run("MATCH (n) RETURN n.name").catch(function (err) {
        expect(err.code).toEqual(neo4j.SESSION_EXPIRED);
        driver.close();
        seedServer.exit(function (code1) {
          readServer.exit(function (code2) {
            expect(code1).toEqual(0);
            expect(code2).toEqual(0);
            done();
          });
        });
      });
    });
  });

  it('should remember endpoints', function (done) {
    if (!boltkit.BoltKitSupport) {
      done();
      return;
    }
    // Given
    var kit = new boltkit.BoltKit();
    var seedServer = kit.start('./test/resources/boltkit/acquire_endpoints.script', 9001);
    var readServer = kit.start('./test/resources/boltkit/read_server.script', 9005);

    kit.run(function () {
      var driver = neo4j.driver("bolt+routing://127.0.0.1:9001", neo4j.auth.basic("neo4j", "neo4j"));
      // When
      var session = driver.session(neo4j.READ);
      session.run("MATCH (n) RETURN n.name").then(function() {

        // Then
        expect(driver._clusterView.routers.toArray()).toEqual(['127.0.0.1:9001', '127.0.0.1:9002', '127.0.0.1:9003']);
        expect(driver._clusterView.readers.toArray()).toEqual(['127.0.0.1:9005', '127.0.0.1:9006']);
        expect(driver._clusterView.writers.toArray()).toEqual(['127.0.0.1:9007', '127.0.0.1:9008']);
        driver.close();
        seedServer.exit(function (code1) {
          readServer.exit(function (code2) {
            expect(code1).toEqual(0);
            expect(code2).toEqual(0);
            done();
          });
        });
      });
    });
  });

  it('should forget endpoints on failure', function (done) {
    if (!boltkit.BoltKitSupport) {
      done();
      return;
    }
    // Given
    var kit = new boltkit.BoltKit();
    var seedServer = kit.start('./test/resources/boltkit/acquire_endpoints.script', 9001);
    var readServer = kit.start('./test/resources/boltkit/dead_server.script', 9005);

    kit.run(function () {
      var driver = neo4j.driver("bolt+routing://127.0.0.1:9001", neo4j.auth.basic("neo4j", "neo4j"));
      // When
      var session = driver.session(neo4j.READ);
      session.run("MATCH (n) RETURN n.name").catch(function() {
        session.close();
        // Then
        expect(driver._pool.has('127.0.0.1:9001')).toBeTruthy();
        expect(driver._pool.has('127.0.0.1:9005')).toBeFalsy();
        expect(driver._clusterView.routers.toArray()).toEqual(['127.0.0.1:9001', '127.0.0.1:9002', '127.0.0.1:9003']);
        expect(driver._clusterView.readers.toArray()).toEqual(['127.0.0.1:9006']);
        expect(driver._clusterView.writers.toArray()).toEqual(['127.0.0.1:9007', '127.0.0.1:9008']);
        driver.close();
        seedServer.exit(function (code1) {
          readServer.exit(function (code2) {
            expect(code1).toEqual(0);
            expect(code2).toEqual(0);
            done();
          });
        });
      });
    });
  });

  it('should forget endpoints on session acquisition failure', function (done) {
    if (!boltkit.BoltKitSupport) {
      done();
      return;
    }
    // Given
    var kit = new boltkit.BoltKit();
    var seedServer = kit.start('./test/resources/boltkit/acquire_endpoints.script', 9001);

    kit.run(function () {
      var driver = neo4j.driver("bolt+routing://127.0.0.1:9001", neo4j.auth.basic("neo4j", "neo4j"));
      // When
      var session = driver.session(neo4j.READ);
      session.run("MATCH (n) RETURN n.name").catch(function(err) {
        session.close();
        // Then
        expect(driver._pool.has('127.0.0.1:9001')).toBeTruthy();
        expect(driver._pool.has('127.0.0.1:9005')).toBeFalsy();
        expect(driver._clusterView.routers.toArray()).toEqual(['127.0.0.1:9001', '127.0.0.1:9002', '127.0.0.1:9003']);
        expect(driver._clusterView.readers.toArray()).toEqual(['127.0.0.1:9006']);
        expect(driver._clusterView.writers.toArray()).toEqual(['127.0.0.1:9007', '127.0.0.1:9008']);
        driver.close();
        seedServer.exit(function (code) {
            expect(code).toEqual(0);
            done();
          });
      });
    });
  });

  it('should rediscover if necessary', function (done) {
    if (!boltkit.BoltKitSupport) {
      done();
      return;
    }
    // Given
    var kit = new boltkit.BoltKit();
    var seedServer = kit.start('./test/resources/boltkit/rediscover.script', 9001);
    var readServer = kit.start('./test/resources/boltkit/read_server.script', 9005);

    kit.run(function () {
      var driver = neo4j.driver("bolt+routing://127.0.0.1:9001", neo4j.auth.basic("neo4j", "neo4j"));
      // When
      var session = driver.session(neo4j.READ);
      session.run("MATCH (n) RETURN n.name").catch(function (err) {
        session = driver.session(neo4j.READ);
        session.run("MATCH (n) RETURN n.name").then(function (res) {
          driver.close();
          seedServer.exit(function (code1) {
            readServer.exit(function (code2) {
              expect(code1).toEqual(0);
              expect(code2).toEqual(0);
              done();
            });
          });
        });
      });
    });
  });

  it('should handle server not able to do routing', function (done) {
    if (!boltkit.BoltKitSupport) {
      done();
      return;
    }
    // Given
    var kit = new boltkit.BoltKit(true);
    var server = kit.start('./test/resources/boltkit/non_discovery.script', 9001);

    kit.run(function () {
      var driver = neo4j.driver("bolt+routing://127.0.0.1:9001", neo4j.auth.basic("neo4j", "neo4j"));
      // When
      var session = driver.session();
      session.run("MATCH (n) RETURN n.name").catch(function (err) {
        expect(err.code).toEqual(neo4j.SERVICE_UNAVAILABLE);
        session.close();
        driver.close();
        server.exit(function(code) {
          expect(code).toEqual(0);
          done();
        });
      });
    });
  });

  it('should handle leader switch while writing', function (done) {
    if (!boltkit.BoltKitSupport) {
      done();
      return;
    }
    // Given
    var kit = new boltkit.BoltKit(true);
    var seedServer = kit.start('./test/resources/boltkit/acquire_endpoints.script', 9001);
    var readServer = kit.start('./test/resources/boltkit/not_able_to_write.script', 9007);

    kit.run(function () {
      var driver = neo4j.driver("bolt+routing://127.0.0.1:9001", neo4j.auth.basic("neo4j", "neo4j"));
      // When
      var session = driver.session();
      session.run("CREATE ()").catch(function (err) {
        //the server at 9007 should have been removed
        expect(driver._clusterView.writers.toArray()).toEqual([ '127.0.0.1:9008']);
        expect(err.code).toEqual(neo4j.SESSION_EXPIRED);
        session.close();
        driver.close();
        seedServer.exit(function (code1) {
          readServer.exit(function (code2) {
            expect(code1).toEqual(0);
            expect(code2).toEqual(0);
            done();
          });
        });
      });
    });
  });
});

