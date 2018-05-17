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
import neo4j from '../../src/v1';
import sharedNeo4j from '../internal/shared-neo4j';
import {ServerVersion, VERSION_3_1_0} from '../../src/v1/internal/server-version';

describe('transaction', () => {

  let driver;
  let session;
  let serverVersion;
  let originalTimeout;

  beforeEach(done => {
    // make jasmine timeout high enough to test unreachable bookmarks
    originalTimeout = jasmine.DEFAULT_TIMEOUT_INTERVAL;
    jasmine.DEFAULT_TIMEOUT_INTERVAL = 40000;

    driver = neo4j.driver("bolt://localhost", sharedNeo4j.authToken);
    session = driver.session();

    session.run('MATCH (n) DETACH DELETE n').then(result => {
      serverVersion = ServerVersion.fromString(result.summary.server.version);
      done();
    });
  });

  afterEach(() => {
    jasmine.DEFAULT_TIMEOUT_INTERVAL = originalTimeout;
    driver.close();
  });

  it('should commit simple case', done => {
    const tx = session.beginTransaction();
    tx.run("CREATE (:TXNode1)").then(() => {
      tx.run("CREATE (:TXNode2)").then(() => {
        tx.commit().then(() => {
          session.run("MATCH (t1:TXNode1), (t2:TXNode2) RETURN count(t1), count(t2)").then(result => {
            expect(result.records.length).toBe(1);
            expect(result.records[0].get('count(t1)').toInt()).toBe(1);
            expect(result.records[0].get('count(t2)').toInt()).toBe(1);
            done();
          }).catch(console.log);
        }).catch(console.log);
      }).catch(console.log);
    }).catch(console.log);
  });

  it('should populate resultAvailableAfter for transaction#run when using 3.1 and onwards', done => {
    if (neo4jVersionOlderThan31(done)) {
        return;
    }
    const tx = session.beginTransaction();
    tx.run("CREATE (:TXNode1)").then(result => {
      tx.commit().then(() => {
        expect(result.summary.resultAvailableAfter).toBeDefined();
        expect(result.summary.resultAvailableAfter.toInt()).not.toBeLessThan(0);
        done();
      }).catch(console.log);
    }).catch(console.log);
  });

  it('should handle interactive session', done => {
    const tx = session.beginTransaction();
    tx.run("RETURN 'foo' AS res").then(result => {
      tx.run("CREATE ({name: {param}})", {param: result.records[0].get('res')}).then(() => {
        tx.commit().then(() => {
          session.run("MATCH (a {name:'foo'}) RETURN count(a)").then(result => {
            expect(result.records.length).toBe(1);
            expect(result.records[0].get('count(a)').toInt()).toBe(1);
            done();
          });
        }).catch(console.log);
      }).catch(console.log);
    }).catch(console.log);
  });

  it('should handle failures with subscribe', done => {
    const tx = session.beginTransaction();
    tx.run('THIS IS NOT CYPHER')
      .catch(error => {
        expect(error.code).toEqual('Neo.ClientError.Statement.SyntaxError');
        driver.close();
        done();
      });
  });

  it('should handle failures with catch', done => {
    const tx = session.beginTransaction();
    tx.run('THIS IS NOT CYPHER')
      .subscribe({
        onError: error => {
          expect(error.code).toEqual('Neo.ClientError.Statement.SyntaxError');
          driver.close();
          done();
        }
      });
  });

  it('should handle failures on commit', done => {
    // When
    const tx = session.beginTransaction();
    tx.run("CREATE (:TXNode1)").then(() => {
      tx.run("THIS IS NOT CYPHER").catch(statementError => {
        expectSyntaxError(statementError);

        tx.run("CREATE (:TXNode2)").catch(() => {
          tx.commit().catch(commitError => {
            expect(commitError.error).toBeDefined();
            driver.close();
            done();
          });
        });
      });
    }).catch(console.log);
  });

  it('should fail when committing on a failed query', done => {
    const tx = session.beginTransaction();
    tx.run("CREATE (:TXNode1)").then(() => {
      tx.run("THIS IS NOT CYPHER").catch(() => {
        tx.commit().catch(error => {
          expect(error.error).toBeDefined();
          driver.close();
          done();
        });
      });
    }).catch(console.log);
  });

  it('should handle when committing when another statement fails', done => {
    // When
    const tx = session.beginTransaction();
    tx.run("CREATE (:TXNode1)")
      .then(() => {
        tx.commit()
          .catch(error => {
            expect(error).toBeDefined();
            driver.close();
            done();
          });
      });
    tx.run("THIS IS NOT CYPHER");
  });

  it('should handle rollbacks', done => {
    const tx = session.beginTransaction();
    tx.run("CREATE (:TXNode1)").then(() => {
      tx.run("CREATE (:TXNode2)").then(() => {
        tx.rollback().then(() => {
          session.run("MATCH (t1:TXNode1), (t2:TXNode2) RETURN count(t1), count(t2)").then(result => {
            expect(result.records.length).toBe(1);
            expect(result.records[0].get('count(t1)').toInt()).toBe(0);
            expect(result.records[0].get('count(t2)').toInt()).toBe(0);
            done();
          }).catch(console.log);
        }).catch(console.log);
      }).catch(console.log);
    }).catch(console.log);
  });

  it('should fail when committing on a rolled back query', done => {
    const tx = session.beginTransaction();
    tx.run("CREATE (:TXNode1)").then(() => {
      tx.rollback().then(() => {
        tx.commit().catch(error => {
          expect(error.error).toBeDefined();
          driver.close();
          done();
        });
      }).catch(console.log);
    }).catch(console.log);
  });

  it('should fail when running on a rolled back transaction', done => {
    const tx = session.beginTransaction();
    tx.run("CREATE (:TXNode1)").then(() => {
      tx.rollback().then(() => {
        tx.run("RETURN 42").catch(error => {
          expect(error.error).toBeDefined();
          driver.close();
          done();
        });
      }).catch(console.log);
    }).catch(console.log);
  });

  it('should fail when running when a previous statement failed', done => {
    const tx = session.beginTransaction();
    tx.run("THIS IS NOT CYPHER")
      .catch(() => {
        tx.run("RETURN 42")
          .catch(error => {
            expect(error.error).toBeDefined();
            driver.close();
            done();
          });
      });
    tx.rollback();
  });

  it('should fail when trying to roll back a rolled back transaction', done => {
    const tx = session.beginTransaction();
    tx.run("CREATE (:TXNode1)").then(() => {
      tx.rollback().then(() => {
        tx.rollback().catch(error => {
          expect(error.error).toBeDefined();
          driver.close();
          done();
        });
      }).catch(console.log);
    }).catch(console.log);
  });

  it('should provide bookmark on commit', done => {
    if (neo4jVersionOlderThan31(done)) {
      return;
    }

    const tx = session.beginTransaction();
    expect(session.lastBookmark()).toBeNull();
    tx.run("CREATE (:TXNode1)").then(() => {
      tx.run("CREATE (:TXNode2)").then(() => {
        tx.commit().then(() => {
          expectValidLastBookmark(session);
          done();
        });
      }).catch(console.log);
    }).catch(console.log);
  });

  it('should have bookmark when tx is rolled back', done => {
    if (neo4jVersionOlderThan31(done)) {
      return;
    }

    expect(session.lastBookmark()).toBeNull();
    const tx1 = session.beginTransaction();

    tx1.run('CREATE ()').then(() => {
      tx1.commit().then(() => {
        expectValidLastBookmark(session);
        const bookmarkBefore = session.lastBookmark();

        const tx2 = session.beginTransaction();
        tx2.run('CREATE ()').then(() => {
          tx2.rollback().then(() => {
            expectValidLastBookmark(session);
            const bookmarkAfter = session.lastBookmark();
            expect(bookmarkAfter).toEqual(bookmarkBefore);

            const tx3 = session.beginTransaction();
            tx3.run('CREATE ()').then(() => {
              tx3.commit().then(() => {
                expectValidLastBookmark(session);
                done();
              });
            });
          });
        });
      });
    });
  });

  it('should have no bookmark when tx fails', done => {
    if (neo4jVersionOlderThan31(done)) {
      return;
    }

    expect(session.lastBookmark()).toBeNull();
    const tx1 = session.beginTransaction();

    tx1.run('CREATE ()').then(() => {
      tx1.commit().then(() => {
        expectValidLastBookmark(session);
        const bookmarkBefore = session.lastBookmark();

        const tx2 = session.beginTransaction();

        tx2.run('RETURN').catch(error => {
          expectSyntaxError(error);
          const bookmarkAfter = session.lastBookmark();
          expect(bookmarkAfter).toEqual(bookmarkBefore);

          const tx3 = session.beginTransaction();
          tx3.run('CREATE ()').then(() => {
            tx3.commit().then(() => {
              expectValidLastBookmark(session);
              done();
            });
          });
        });
      });
    });
  });

  it('should fail for invalid bookmark', done => {
    if (neo4jVersionOlderThan31(done)) {
      return;
    }

    const invalidBookmark = 'hi, this is an invalid bookmark';
    const tx = session.beginTransaction(invalidBookmark);
    tx.run('RETURN 1').catch(error => {
      expect(error.code).toBe('Neo.ClientError.Transaction.InvalidBookmark');
      done();
    });
  });

  it('should fail to run query for unreachable bookmark', done => {
    if (neo4jVersionOlderThan31(done)) {
      return;
    }

    const tx1 = session.beginTransaction();
    tx1.run('CREATE ()').then(result => {
      expect(result.summary.counters.nodesCreated()).toBe(1);

      tx1.commit().then(() => {
        expectValidLastBookmark(session);

        const unreachableBookmark = session.lastBookmark() + "0";
        const tx2 = session.beginTransaction(unreachableBookmark);
        tx2.run('CREATE ()').catch(error => {
          const message = error.message;
          const expectedPrefix = message.indexOf('Database not up to the requested version') === 0;
          expect(expectedPrefix).toBeTruthy();
          done();
        });
      }).catch(console.log);
    }).catch(console.log);
  });

  it('should rollback when very first run fails', done => {
    const tx1 = session.beginTransaction();
    tx1.run('RETURN foo').catch(error => {
      expectSyntaxError(error);

      const tx2 = session.beginTransaction();
      tx2.run('RETURN 1').then(result => {
        expect(result.records[0].get(0).toNumber()).toEqual(1);
        tx2.commit().then(done);
      });
    });
  });

  it('should rollback when some run fails', done => {
    const tx1 = session.beginTransaction();
    tx1.run('CREATE (:Person)').then(() => {
      tx1.run('RETURN foo').catch(error => {
        expectSyntaxError(error);

        const tx2 = session.beginTransaction();
        tx2.run('MATCH (n:Person) RETURN count(n)').then(result => {
          expect(result.records[0].get(0).toNumber()).toEqual(0);
          tx2.commit().then(done);
        });
      });
    });
  });

  it('should fail to commit transaction that had run failures', done => {
    const tx1 = session.beginTransaction();
    tx1.run('CREATE (:Person)').then(() => {
      tx1.run('RETURN foo').catch(error => {
        expectSyntaxError(error);
        tx1.commit().catch(error => {
          const errorMessage = error.error;
          const index = errorMessage.indexOf('Cannot commit statements in this transaction');
          expect(index).not.toBeLessThan(0);

          const tx2 = session.beginTransaction();
          tx2.run('MATCH (n:Person) RETURN count(n)').then(result => {
            expect(result.records[0].get(0).toNumber()).toEqual(0);
            done();
          });
        });
      });
    });
  });

  it('should expose server info on successful query', done => {
    if (neo4jVersionOlderThan31(done)) {
      return;
    }

    const statement = 'RETURN 1';

    const tx = session.beginTransaction();
    tx.run(statement).then(result => {
      const sum = result.summary;
      expect(sum.server).toBeDefined();
      expect(sum.server.address).toEqual('localhost:7687');
      expect(sum.server.version).toBeDefined();
      tx.commit().then(done);
    }).catch(console.log);
  });

  it('should expose server info on successful query using observer', done => {
    if (neo4jVersionOlderThan31(done)) {
      return;
    }

    // Given
    const statement = 'RETURN 1';

    // When & Then
    const tx = session.beginTransaction();
    tx.run(statement)
      .subscribe({
        onNext: record => {
        },
        onError: error => {
        },
        onCompleted: summary => {
          const server = summary.server;

          expect(server).toBeDefined();
          expect(server.address).toEqual('localhost:7687');
          expect(server.version).toBeDefined();

          done();
        }
      });
  });

  it('should fail nicely for illegal statement', () => {
    const tx = session.beginTransaction();

    expect(() => tx.run()).toThrowError(TypeError);
    expect(() => tx.run(null)).toThrowError(TypeError);
    expect(() => tx.run({})).toThrowError(TypeError);
    expect(() => tx.run(42)).toThrowError(TypeError);
    expect(() => tx.run([])).toThrowError(TypeError);
    expect(() => tx.run(['CREATE ()'])).toThrowError(TypeError);

    expect(() => tx.run({statement: 'CREATE ()'})).toThrowError(TypeError);
    expect(() => tx.run({cypher: 'CREATE ()'})).toThrowError(TypeError);
  });

  it('should accept a statement object ', done => {
    const tx = session.beginTransaction();
    const statement = {text: "RETURN 1 AS a"};

    tx.run(statement).then(result => {
      expect(result.records.length).toBe(1);
      expect(result.records[0].get('a').toInt()).toBe(1);
      done();
    }).catch(console.log);
  });

  it('should be open when neither committed nor rolled back', () => {
    const tx = session.beginTransaction();
    expect(tx.isOpen()).toBeTruthy();
  });

  it('should not be open after commit', done => {
    const tx = session.beginTransaction();

    tx.run('CREATE ()').then(() => {
      tx.commit().then(() => {
        expect(tx.isOpen()).toBeFalsy();
        done();
      });
    });
  });

  it('should not be open after rollback', done => {
    const tx = session.beginTransaction();

    tx.run('CREATE ()').then(() => {
      tx.rollback().then(() => {
        expect(tx.isOpen()).toBeFalsy();
        done();
      });
    });
  });

  it('should not be open after run error', done => {
    const tx = session.beginTransaction();

    tx.run('RETURN').catch(() => {
      expect(tx.isOpen()).toBeFalsy();
      done();
    });
  });

  it('should respect socket connection timeout', done => {
    testConnectionTimeout(false, done);
  });

  it('should respect TLS socket connection timeout', done => {
    testConnectionTimeout(true, done);
  });

  it('should fail for invalid query parameters', done => {
    const tx = session.beginTransaction();

    expect(() => tx.run('RETURN $value', 'Hello')).toThrowError(TypeError);
    expect(() => tx.run('RETURN $value', 12345)).toThrowError(TypeError);
    expect(() => tx.run('RETURN $value', () => 'Hello')).toThrowError(TypeError);

    tx.rollback().then(() => done());
  });

  function expectSyntaxError(error) {
    expect(error.code).toBe('Neo.ClientError.Statement.SyntaxError');
  }

  function expectValidLastBookmark(session) {
    expect(session.lastBookmark()).toBeDefined();
    expect(session.lastBookmark()).not.toBeNull();
  }

  function neo4jVersionOlderThan31(done) {
    if (serverVersion.compareTo(VERSION_3_1_0) < 0) {
      done();
      return true;
    }
    return false;
  }

  function testConnectionTimeout(encrypted, done) {
    const boltUri = 'bolt://10.0.0.0'; // use non-routable IP address which never responds
    const config = {encrypted: encrypted, connectionTimeout: 1000};

    const localDriver = neo4j.driver(boltUri, sharedNeo4j.authToken, config);
    const session = localDriver.session();
    const tx = session.beginTransaction();
    tx.run('RETURN 1').then(() => {
      tx.rollback();
      session.close();
      done.fail('Query did not fail');
    }).catch(error => {
      tx.rollback();
      session.close();

      expect(error.code).toEqual(neo4j.error.SERVICE_UNAVAILABLE);

      // in some environments non-routable address results in immediate 'connection refused' error and connect
      // timeout is not fired; skip message assertion for such cases, it is important for connect attempt to not hang
      if (error.message.indexOf('Failed to establish connection') === 0) {
        expect(error.message).toEqual('Failed to establish connection in 1000ms');
      }

      done();
    });
  }

});
