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

import neo4j from "../../src/v1";
import boltkit from "./boltkit";
import RoutingTable from "../../src/v1/internal/routing-table";

describe('routing driver', function () {
  var originalTimeout;

  beforeAll(function () {
    originalTimeout = jasmine.DEFAULT_TIMEOUT_INTERVAL;
    jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000;
  });

  afterAll(function () {
    jasmine.DEFAULT_TIMEOUT_INTERVAL = originalTimeout;
  });

  it('should discover server', function (done) {
    if (!boltkit.BoltKitSupport) {
      done();
      return;
    }
    // Given
    var kit = new boltkit.BoltKit();
    var server = kit.start('./test/resources/boltkit/discover_servers.script', 9001);

    kit.run(function () {
      var driver = newDriver("bolt+routing://127.0.0.1:9001");
      // When
      var session = driver.session();
      session.run("MATCH (n) RETURN n.name").then(function () {

        session.close();
        // Then
        expect(driver._pool.has('127.0.0.1:9001')).toBeTruthy();
        assertHasRouters(driver, ["127.0.0.1:9001", "127.0.0.1:9002", "127.0.0.1:9003"]);
        assertHasReaders(driver, ["127.0.0.1:9002", "127.0.0.1:9003"]);
        assertHasWriters(driver, ["127.0.0.1:9001"]);

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
      var driver = newDriver("bolt+routing://127.0.0.1:9001");
      // When
      var session = driver.session();
      session.run("MATCH (n) RETURN n.name").then(function () {

        // Then
        assertHasRouters(driver, ["127.0.0.1:9004", "127.0.0.1:9002", "127.0.0.1:9003"]);
        assertHasReaders(driver, ["127.0.0.1:9005", "127.0.0.1:9003"]);
        assertHasWriters(driver, ["127.0.0.1:9001"]);

        driver.close();
        server.exit(function (code) {
          expect(code).toEqual(0);
          done();
        });
      });
    });
  });

  it('should discover new servers using subscribe', function (done) {
    if (!boltkit.BoltKitSupport) {
      done();
      return;
    }
    // Given
    var kit = new boltkit.BoltKit();
    var server = kit.start('./test/resources/boltkit/discover_new_servers.script', 9001);

    kit.run(function () {
      var driver = newDriver("bolt+routing://127.0.0.1:9001");
      // When
      var session = driver.session();
      session.run("MATCH (n) RETURN n.name").subscribe({
        onCompleted: function () {

          // Then
          assertHasRouters(driver, ["127.0.0.1:9004", "127.0.0.1:9002", "127.0.0.1:9003"]);
          assertHasReaders(driver, ["127.0.0.1:9005", "127.0.0.1:9003"]);
          assertHasWriters(driver, ["127.0.0.1:9001"]);

          driver.close();
          server.exit(function (code) {
            expect(code).toEqual(0);
            done();
          });
        }
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
    var server = kit.start('./test/resources/boltkit/empty_get_servers_response.script', 9001);

    kit.run(function () {
      var driver = newDriver("bolt+routing://127.0.0.1:9001");

      // When
      var session = driver.session(neo4j.READ);
      session.run("MATCH (n) RETURN n.name").catch(function (err) {
        expect(err.code).toEqual(neo4j.error.PROTOCOL_ERROR);

        session.close();
        driver.close();
        server.exit(function (code) {
          expect(code).toEqual(0);
          done();
        });
      }).catch(function (err) {
        console.log(err)
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
      var driver = newDriver("bolt+routing://127.0.0.1:9001");
      // When
      var session = driver.session(neo4j.session.READ);
      session.run("MATCH (n) RETURN n.name").then(function (res) {

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

  it('should pick first available route-server', function (done) {
    if (!boltkit.BoltKitSupport) {
      done();
      return;
    }
    // Given
    var kit = new boltkit.BoltKit();
    var seedServer = kit.start('./test/resources/boltkit/short_ttl.script', 9000);
    var nextRouter = kit.start('./test/resources/boltkit/acquire_endpoints.script', 9003);
    var readServer1 = kit.start('./test/resources/boltkit/read_server.script', 9004);
    var readServer2 = kit.start('./test/resources/boltkit/read_server.script', 9005);

    kit.run(function () {
      var driver = newDriver("bolt+routing://127.0.0.1:9000");
      // When
      var session = driver.session(neo4j.session.READ);
      session.run("MATCH (n) RETURN n.name").then(function (res) {
        // Then
        expect(res.records[0].get('n.name')).toEqual('Bob');
        expect(res.records[1].get('n.name')).toEqual('Alice');
        expect(res.records[2].get('n.name')).toEqual('Tina');
        session.close();

        session = driver.session(neo4j.session.READ);
        session.run("MATCH (n) RETURN n.name").then(function (res) {
          // Then
          expect(res.records[0].get('n.name')).toEqual('Bob');
          expect(res.records[1].get('n.name')).toEqual('Alice');
          expect(res.records[2].get('n.name')).toEqual('Tina');
          session.close();
          driver.close();
          seedServer.exit(function (code1) {
            nextRouter.exit(function (code2) {
              readServer1.exit(function (code3) {
                readServer2.exit(function (code4) {
                  expect(code1).toEqual(0);
                  expect(code2).toEqual(0);
                  expect(code3).toEqual(0);
                  expect(code4).toEqual(0);
                  done();
                });
              });
            });
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
      var driver = newDriver("bolt+routing://127.0.0.1:9001");
      // When
      var session = driver.session(neo4j.session.READ);
      session.run("MATCH (n) RETURN n.name").then(function (res) {
        // Then
        expect(res.records[0].get('n.name')).toEqual('Bob');
        expect(res.records[1].get('n.name')).toEqual('Alice');
        expect(res.records[2].get('n.name')).toEqual('Tina');
        session.close();
        session = driver.session(neo4j.session.READ);
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
      var driver = newDriver("bolt+routing://127.0.0.1:9001");
      // When
      var session = driver.session(neo4j.session.READ);
      session.run("MATCH (n) RETURN n.name").catch(function (err) {
        expect(err.code).toEqual(neo4j.error.SESSION_EXPIRED);
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
      var driver = newDriver("bolt+routing://127.0.0.1:9001");
      // When
      var session = driver.session(neo4j.session.WRITE);
      session.run("CREATE (n {name:'Bob'})").then(function () {

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
      var driver = newDriver("bolt+routing://127.0.0.1:9001");
      // When
      var session = driver.session(neo4j.session.WRITE);
      session.run("CREATE (n {name:'Bob'})").then(function () {
        session = driver.session(neo4j.session.WRITE);
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
      var driver = newDriver("bolt+routing://127.0.0.1:9001");
      // When
      var session = driver.session(neo4j.session.WRITE);
      session.run("MATCH (n) RETURN n.name").catch(function (err) {
        expect(err.code).toEqual(neo4j.error.SESSION_EXPIRED);
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
      var driver = newDriver("bolt+routing://127.0.0.1:9001");
      // When
      var session = driver.session(neo4j.session.READ);
      session.run("MATCH (n) RETURN n.name").then(function () {

        // Then
        assertHasRouters(driver, ['127.0.0.1:9001', '127.0.0.1:9002', '127.0.0.1:9003']);
        assertHasReaders(driver, ['127.0.0.1:9005', '127.0.0.1:9006']);
        assertHasWriters(driver, ['127.0.0.1:9007', '127.0.0.1:9008']);
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
      var driver = newDriver("bolt+routing://127.0.0.1:9001");
      // When
      var session = driver.session(neo4j.session.READ);
      session.run("MATCH (n) RETURN n.name").catch(function () {
        session.close();
        // Then
        expect(driver._pool.has('127.0.0.1:9001')).toBeTruthy();
        expect(driver._pool.has('127.0.0.1:9005')).toBeFalsy();
        assertHasRouters(driver, ['127.0.0.1:9001', '127.0.0.1:9002', '127.0.0.1:9003']);
        assertHasReaders(driver, ['127.0.0.1:9006']);
        assertHasWriters(driver, ['127.0.0.1:9007', '127.0.0.1:9008']);
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
      var driver = newDriver("bolt+routing://127.0.0.1:9001");
      // When
      var session = driver.session(neo4j.session.READ);
      session.run("MATCH (n) RETURN n.name").catch(function (err) {
        session.close();
        // Then
        expect(driver._pool.has('127.0.0.1:9001')).toBeTruthy();
        expect(driver._pool.has('127.0.0.1:9005')).toBeFalsy();
        assertHasRouters(driver, ['127.0.0.1:9001', '127.0.0.1:9002', '127.0.0.1:9003']);
        assertHasReaders(driver, ['127.0.0.1:9006']);
        assertHasWriters(driver, ['127.0.0.1:9007', '127.0.0.1:9008']);
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
      var driver = newDriver("bolt+routing://127.0.0.1:9001");
      // When
      var session = driver.session(neo4j.session.READ);
      session.run("MATCH (n) RETURN n.name").catch(function (err) {
        session = driver.session(neo4j.session.READ);
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

  it('should handle server not able to do routing', done => {
    if (!boltkit.BoltKitSupport) {
      done();
      return;
    }

    // Given
    const kit = new boltkit.BoltKit();
    const server = kit.start('./test/resources/boltkit/non_discovery.script', 9001);

    kit.run(() => {
      const driver = newDriver("bolt+routing://127.0.0.1:9001");
      // When
      const session = driver.session();
      session.run("MATCH (n) RETURN n.name").catch(err => {
        expect(err.code).toEqual(neo4j.error.SERVICE_UNAVAILABLE);
        expect(err.message.indexOf('could not perform routing') > 0).toBeTruthy();
        assertHasRouters(driver, ['127.0.0.1:9001']);
        session.close();
        driver.close();
        server.exit(code => {
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
    var kit = new boltkit.BoltKit();
    var seedServer = kit.start('./test/resources/boltkit/acquire_endpoints.script', 9001);
    var readServer = kit.start('./test/resources/boltkit/not_able_to_write.script', 9007);

    kit.run(function () {
      var driver = newDriver("bolt+routing://127.0.0.1:9001");
      // When
      var session = driver.session();
      session.run("CREATE ()").catch(function (err) {
        //the server at 9007 should have been removed
        assertHasWriters(driver, ['127.0.0.1:9008']);
        expect(err.code).toEqual(neo4j.error.SESSION_EXPIRED);
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

  it('should handle leader switch while writing on transaction', function (done) {
    if (!boltkit.BoltKitSupport) {
      done();
      return;
    }
    // Given
    var kit = new boltkit.BoltKit();
    var seedServer = kit.start('./test/resources/boltkit/acquire_endpoints.script', 9001);
    var readServer = kit.start('./test/resources/boltkit/not_able_to_write_in_transaction.script', 9007);

    kit.run(function () {
      var driver = newDriver("bolt+routing://127.0.0.1:9001");
      // When
      var session = driver.session();
      var tx = session.beginTransaction();
      tx.run("CREATE ()");

      tx.commit().catch(function (err) {
        //the server at 9007 should have been removed
        assertHasWriters(driver, ['127.0.0.1:9008']);
        expect(err.code).toEqual(neo4j.error.SESSION_EXPIRED);
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

  it('should fail if missing write server', function (done) {
    if (!boltkit.BoltKitSupport) {
      done();
      return;
    }
    // Given
    var kit = new boltkit.BoltKit();
    var seedServer = kit.start('./test/resources/boltkit/no_writers.script', 9001);

    kit.run(function () {
      var driver = newDriver("bolt+routing://127.0.0.1:9001");
      // When
      var session = driver.session(neo4j.session.WRITE);
      session.run("MATCH (n) RETURN n.name").catch(function (err) {
        expect(err.code).toEqual(neo4j.error.SERVICE_UNAVAILABLE);
        driver.close();
        seedServer.exit(function (code) {
          expect(code).toEqual(0);
          done();
        });
      });
    });
  });

  it('should try next router when no writers', done => {
    if (!boltkit.BoltKitSupport) {
      done();
      return;
    }

    const kit = new boltkit.BoltKit();
    const server1 = kit.start('./test/resources/boltkit/routing_table_with_zero_ttl.script', 9000);
    const server2 = kit.start('./test/resources/boltkit/no_writers.script', 9090);
    const server3 = kit.start('./test/resources/boltkit/no_writers.script', 9091);
    const server4 = kit.start('./test/resources/boltkit/no_writers.script', 9092);

    kit.run(() => {
      const driver = newDriver('bolt+routing://127.0.0.1:9000');

      const session1 = driver.session();
      session1.run('MATCH (n) RETURN n').then(result1 => {
        expect(result1.summary.server.address).toEqual('127.0.0.1:9000');
        session1.close();

        assertHasRouters(driver, ['127.0.0.1:9090', '127.0.0.1:9091', '127.0.0.1:9092', '127.0.0.1:9000']);
        const memorizingRoutingTable = setUpMemorizingRoutingTable(driver);

        const session2 = driver.session();
        session2.run('MATCH (n) RETURN n').then(result2 => {
          expect(result2.summary.server.address).toEqual('127.0.0.1:9000');
          session2.close();

          memorizingRoutingTable.assertForgotRouters([]);
          assertHasRouters(driver, ['127.0.0.1:9000']);
          driver.close();

          server1.exit(code1 => {
            server2.exit(code2 => {
              server3.exit(code3 => {
                server4.exit(code4 => {
                  expect(code1).toEqual(0);
                  expect(code2).toEqual(0);
                  expect(code3).toEqual(0);
                  expect(code4).toEqual(0);
                  done();
                });
              });
            });
          });
        });
      });
    });
  });

  it('should re-use connections', function (done) {
    if (!boltkit.BoltKitSupport) {
      done();
      return;
    }
    // Given
    var kit = new boltkit.BoltKit();
    var seedServer = kit.start('./test/resources/boltkit/single_write_server.script', 9002);
    var writeServer = kit.start('./test/resources/boltkit/two_write_responses_server.script', 9001);

    kit.run(function () {
      var driver = newDriver("bolt+routing://127.0.0.1:9002");
      // When
      var session = driver.session(neo4j.session.WRITE);
      session.run("CREATE (n {name:'Bob'})").then(function () {
        session.close(function () {
          var connections = Object.keys(driver._openSessions).length
          session = driver.session(neo4j.session.WRITE);
          session.run("CREATE ()").then(function () {
            driver.close();
            seedServer.exit(function (code1) {
              writeServer.exit(function (code2) {
                expect(connections).toEqual(Object.keys(driver._openSessions).length)
                expect(code1).toEqual(0);
                expect(code2).toEqual(0);
                done();
              });
            });
          });
        });
      });
    });
  });

  it('should expose server info in cluster', function (done) {
    if (!boltkit.BoltKitSupport) {
      done();
      return;
    }

    // Given
    const kit = new boltkit.BoltKit();
    const routingServer = kit.start('./test/resources/boltkit/acquire_endpoints.script', 9001);
    const writeServer = kit.start('./test/resources/boltkit/write_server_with_version.script', 9007);
    const readServer = kit.start('./test/resources/boltkit/read_server_with_version.script', 9005);

    kit.run(function () {
      const driver = newDriver("bolt+routing://127.0.0.1:9001");
      // When
      const readSession = driver.session(neo4j.session.READ);
      readSession.run('MATCH (n) RETURN n.name').then(readResult => {
        const writeSession = driver.session(neo4j.session.WRITE);
        writeSession.run("CREATE (n {name:'Bob'})").then(writeResult => {
          const readServerInfo = readResult.summary.server;
          const writeServerInfo = writeResult.summary.server;

          readSession.close();
          writeSession.close();
          driver.close();

          routingServer.exit(routingServerExitCode => {
            writeServer.exit(writeServerExitCode => {
              readServer.exit(readServerExitCode => {

                expect(readServerInfo.address).toBe('127.0.0.1:9005');
                expect(readServerInfo.version).toBe('TheReadServerV1');

                expect(writeServerInfo.address).toBe('127.0.0.1:9007');
                expect(writeServerInfo.version).toBe('TheWriteServerV1');

                expect(routingServerExitCode).toEqual(0);
                expect(writeServerExitCode).toEqual(0);
                expect(readServerExitCode).toEqual(0);

                done();
              });
            });
          });
        })
      });
    });
  });

  it('should expose server info in cluster using observer', function (done) {
    if (!boltkit.BoltKitSupport) {
      done();
      return;
    }

    // Given
    const kit = new boltkit.BoltKit();
    const routingServer = kit.start('./test/resources/boltkit/acquire_endpoints.script', 9001);
    const writeServer = kit.start('./test/resources/boltkit/write_server_with_version.script', 9007);
    const readServer = kit.start('./test/resources/boltkit/read_server_with_version.script', 9005);

    kit.run(function () {
      const driver = newDriver("bolt+routing://127.0.0.1:9001");
      // When
      const readSession = driver.session(neo4j.session.READ);
      readSession.run('MATCH (n) RETURN n.name').subscribe({
        onNext: () => {
        },
        onError: () => {
        },
        onCompleted: readSummary => {
          const writeSession = driver.session(neo4j.session.WRITE);
          writeSession.run("CREATE (n {name:'Bob'})").subscribe({
            onNext: () => {
            },
            onError: () => {
            },
            onCompleted: writeSummary => {
              readSession.close();
              writeSession.close();
              driver.close();

              routingServer.exit(function (routingServerExitCode) {
                writeServer.exit(function (writeServerExitCode) {
                  readServer.exit(function (readServerExitCode) {

                    expect(readSummary.server.address).toBe('127.0.0.1:9005');
                    expect(readSummary.server.version).toBe('TheReadServerV1');

                    expect(writeSummary.server.address).toBe('127.0.0.1:9007');
                    expect(writeSummary.server.version).toBe('TheWriteServerV1');

                    expect(routingServerExitCode).toEqual(0);
                    expect(writeServerExitCode).toEqual(0);
                    expect(readServerExitCode).toEqual(0);

                    done();
                  });
                });
              });
            }
          })
        }
      });
    });
  });

  it('should forget routers when fails to connect', done => {
    if (!boltkit.BoltKitSupport) {
      done();
      return;
    }

    const kit = new boltkit.BoltKit();
    const server = kit.start('./test/resources/boltkit/routing_table_with_zero_ttl.script', 9000);

    kit.run(() => {
      const driver = newDriver('bolt+routing://127.0.0.1:9000');

      const session1 = driver.session();
      session1.run('MATCH (n) RETURN n').then(result1 => {
        expect(result1.summary.server.address).toEqual('127.0.0.1:9000');
        session1.close();

        assertHasRouters(driver, ['127.0.0.1:9090', '127.0.0.1:9091', '127.0.0.1:9092', '127.0.0.1:9000']);
        const memorizingRoutingTable = setUpMemorizingRoutingTable(driver);

        const session2 = driver.session();
        session2.run('MATCH (n) RETURN n').then(result2 => {
          expect(result2.summary.server.address).toEqual('127.0.0.1:9000');
          session2.close();

          memorizingRoutingTable.assertForgotRouters(['127.0.0.1:9090', '127.0.0.1:9091', '127.0.0.1:9092']);
          assertHasRouters(driver, ['127.0.0.1:9000']);
          driver.close();

          server.exit(code1 => {
            expect(code1).toEqual(0);
            done();
          });
        });
      });
    });
  });

  it('should close connection used for routing table refreshing', done => {
    if (!boltkit.BoltKitSupport) {
      done();
      return;
    }

    const kit = new boltkit.BoltKit();
    // server is both router and writer
    const server = kit.start('./test/resources/boltkit/discover_new_servers.script', 9001);

    kit.run(() => {
      const driver = newDriver('bolt+routing://127.0.0.1:9001');

      const acquiredConnections = [];
      const releasedConnections = [];
      setUpPoolToMemorizeAllAcquiredAndReleasedConnections(driver, acquiredConnections, releasedConnections);

      const session = driver.session();
      session.run('MATCH (n) RETURN n.name').then(() => {
        session.close(() => {
          driver.close();
          server.exit(code => {
            expect(code).toEqual(0);

            // two connections should have been acquired: one for rediscovery and one for the query
            expect(acquiredConnections.length).toEqual(2);
            // same two connections should have been released
            expect(releasedConnections.length).toEqual(2);

            // verify that acquired connections are those that we released
            for (let i = 0; i < acquiredConnections.length; i++) {
              expect(acquiredConnections[i]).toBe(releasedConnections[i]);
            }

            done();
          });
        });
      });
    });
  });

  it('should throw protocol error when no records', done => {
    testForProtocolError('./test/resources/boltkit/empty_get_servers_response.script', done);
  });

  it('should throw protocol error when no TTL entry', done => {
    testForProtocolError('./test/resources/boltkit/no_ttl_entry_get_servers.script', done);
  });

  it('should throw protocol error when no servers entry', done => {
    testForProtocolError('./test/resources/boltkit/no_servers_entry_get_servers.script', done);
  });

  it('should throw protocol error when multiple records', done => {
    testForProtocolError('./test/resources/boltkit/unparseable_ttl_get_servers.script', done);
  });

  it('should throw protocol error on unparsable record', done => {
    testForProtocolError('./test/resources/boltkit/unparseable_servers_get_servers.script', done);
  });

  it('should throw protocol error when no routers', done => {
    testForProtocolError('./test/resources/boltkit/no_routers_get_servers.script', done);
  });

  it('should throw protocol error when no readers', done => {
    testForProtocolError('./test/resources/boltkit/no_readers_get_servers.script', done);
  });

  it('should accept routing table with 1 router, 1 reader and 1 writer', done => {
    testRoutingTableAcceptance(
      {
        routers: ['127.0.0.1:9090'],
        readers: ['127.0.0.1:9091'],
        writers: ['127.0.0.1:9000']
      },
      9000, done);
  });

  it('should accept routing table with 2 routers, 1 reader and 1 writer', done => {
    testRoutingTableAcceptance(
      {
        routers: ['127.0.0.1:9090', '127.0.0.1:9091'],
        readers: ['127.0.0.1:9091'],
        writers: ['127.0.0.1:9000']
      },
      9000, done);
  });

  it('should accept routing table with 1 router, 2 readers and 1 writer', done => {
    testRoutingTableAcceptance(
      {
        routers: ['127.0.0.1:9090'],
        readers: ['127.0.0.1:9091', '127.0.0.1:9092'],
        writers: ['127.0.0.1:9000']
      },
      9000, done);
  });

  it('should accept routing table with 2 routers, 2 readers and 1 writer', done => {
    testRoutingTableAcceptance(
      {
        routers: ['127.0.0.1:9090', '127.0.0.1:9091'],
        readers: ['127.0.0.1:9092', '127.0.0.1:9093'],
        writers: ['127.0.0.1:9000']
      },
      9000, done);
  });

  it('should accept routing table with 1 router, 1 reader and 2 writers', done => {
    testRoutingTableAcceptance(
      {
        routers: ['127.0.0.1:9090'],
        readers: ['127.0.0.1:9091'],
        writers: ['127.0.0.1:9000', '127.0.0.1:9092']
      },
      9000, done);
  });

  it('should accept routing table with 2 routers, 1 reader and 2 writers', done => {
    testRoutingTableAcceptance(
      {
        routers: ['127.0.0.1:9090', '127.0.0.1:9091'],
        readers: ['127.0.0.1:9092'],
        writers: ['127.0.0.1:9000', '127.0.0.1:9093']
      },
      9000, done);
  });

  it('should accept routing table with 1 router, 2 readers and 2 writers', done => {
    testRoutingTableAcceptance(
      {
        routers: ['127.0.0.1:9090'],
        readers: ['127.0.0.1:9091', '127.0.0.1:9092'],
        writers: ['127.0.0.1:9000', '127.0.0.1:9093']
      },
      9000, done);
  });

  it('should accept routing table with 2 routers, 2 readers and 2 writers', done => {
    testRoutingTableAcceptance(
      {
        routers: ['127.0.0.1:9090', '127.0.0.1:9091'],
        readers: ['127.0.0.1:9092', '127.0.0.1:9093'],
        writers: ['127.0.0.1:9000', '127.0.0.1:9094']
      },
      9000, done);
  });

  function testForProtocolError(scriptFile, done) {
    if (!boltkit.BoltKitSupport) {
      done();
      return;
    }

    const kit = new boltkit.BoltKit();
    const server = kit.start(scriptFile, 9001);

    kit.run(() => {
      const driver = newDriver('bolt+routing://127.0.0.1:9001');

      const session = driver.session();
      session.run('MATCH (n) RETURN n.name').catch(error => {
        expect(error.code).toEqual(neo4j.error.PROTOCOL_ERROR);

        session.close();
        driver.close();

        server.exit(code => {
          expect(code).toEqual(0);
          done();
        })
      });
    });
  }

  function testRoutingTableAcceptance(clusterMembers, port, done) {
    if (!boltkit.BoltKitSupport) {
      done();
      return;
    }

    const {routers, readers, writers} = clusterMembers;
    const params = {
      routers: joinStrings(routers),
      readers: joinStrings(readers),
      writers: joinStrings(writers)
    };
    const kit = new boltkit.BoltKit();
    const server = kit.startWithTemplate('./test/resources/boltkit/one_of_each_template.script.mst', params, port);

    kit.run(() => {
      const driver = newDriver('bolt+routing://127.0.0.1:' + port);

      const session = driver.session();
      session.run('MATCH (n) RETURN n.name').then(result => {

        expect(result.summary.server.address).toEqual('127.0.0.1:' + port);

        session.close();
        driver.close();

        server.exit(code => {
          expect(code).toEqual(0);
          done();
        })
      });
    });
  }

  function setUpPoolToMemorizeAllAcquiredAndReleasedConnections(driver, acquiredConnections, releasedConnections) {
    // make connection pool remember all acquired connections
    const originalAcquire = driver._pool.acquire.bind(driver._pool);
    const memorizingAcquire = (...args) => {
      const connection = originalAcquire(...args);
      acquiredConnections.push(connection);
      return connection;
    };
    driver._pool.acquire = memorizingAcquire;

    // make connection pool remember all released connections
    const originalRelease = driver._pool._release;
    const rememberingRelease = (key, resource) => {
      originalRelease(key, resource);
      releasedConnections.push(resource);
    };
    driver._pool._release = rememberingRelease;
  }

  function newDriver(url) {
    // BoltKit currently does not support encryption, create driver with encryption turned off
    return neo4j.driver(url, neo4j.auth.basic("neo4j", "neo4j"), {
      encrypted: "ENCRYPTION_OFF"
    });
  }

  function assertHasRouters(driver, expectedRouters) {
    expect(driver._routingTable.routers.toArray()).toEqual(expectedRouters);
  }

  function assertHasReaders(driver, expectedReaders) {
    expect(driver._routingTable.readers.toArray()).toEqual(expectedReaders);
  }

  function assertHasWriters(driver, expectedWriters) {
    expect(driver._routingTable.writers.toArray()).toEqual(expectedWriters);
  }

  function setUpMemorizingRoutingTable(driver) {
    const memorizingRoutingTable = new MemorizingRoutingTable(driver._routingTable);
    driver._routingTable = memorizingRoutingTable;
    return memorizingRoutingTable;
  }

  function joinStrings(array) {
    return '[' + array.map(s => '"' + s + '"').join(',') + ']';
  }

  class MemorizingRoutingTable extends RoutingTable {

    constructor(initialTable) {
      super(initialTable.routers, initialTable.readers, initialTable.writers, initialTable.expirationTime);
      this._forgottenRouters = [];
    }

    forgetRouter(address) {
      super.forgetRouter(address);
      this._forgottenRouters.push(address);
    }

    assertForgotRouters(expectedRouters) {
      expect(this._forgottenRouters).toEqual(expectedRouters);
    }
  }

});
