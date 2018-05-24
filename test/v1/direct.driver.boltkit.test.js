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
import {READ, WRITE} from '../../src/v1/driver';
import boltStub from '../internal/bolt-stub';

describe('direct driver with stub server', () => {

  let originalTimeout;

  beforeAll(() => {
    originalTimeout = jasmine.DEFAULT_TIMEOUT_INTERVAL;
    jasmine.DEFAULT_TIMEOUT_INTERVAL = 60000;
  });

  afterAll(() => {
    jasmine.DEFAULT_TIMEOUT_INTERVAL = originalTimeout;
  });

  it('should run query', done => {
    if (!boltStub.supported) {
      done();
      return;
    }

    // Given
    const server = boltStub.start('./test/resources/boltstub/return_x.script', 9001);

    boltStub.run(() => {
      const driver = boltStub.newDriver('bolt://127.0.0.1:9001');
      // When
      const session = driver.session();
      // Then
      session.run('RETURN {x}', {'x': 1}).then(res => {
        expect(res.records[0].get('x').toInt()).toEqual(1);
        session.close();
        driver.close();
        server.exit(code => {
          expect(code).toEqual(0);
          done();
        });
      });
    });
  });

  it('should send and receive bookmark for read transaction', done => {
    if (!boltStub.supported) {
      done();
      return;
    }

    const server = boltStub.start('./test/resources/boltstub/read_tx_with_bookmarks.script', 9001);

    boltStub.run(() => {
      const driver = boltStub.newDriver('bolt://127.0.0.1:9001');
      const session = driver.session(READ, 'neo4j:bookmark:v1:tx42');
      const tx = session.beginTransaction();
      tx.run('MATCH (n) RETURN n.name AS name').then(result => {
        const records = result.records;
        expect(records.length).toEqual(2);
        expect(records[0].get('name')).toEqual('Bob');
        expect(records[1].get('name')).toEqual('Alice');

        tx.commit().then(() => {
          expect(session.lastBookmark()).toEqual('neo4j:bookmark:v1:tx4242');

          session.close(() => {
            driver.close();
            server.exit(code => {
              expect(code).toEqual(0);
              done();
            });
          });
        });
      });
    });
  });

  it('should send and receive bookmark for write transaction', done => {
    if (!boltStub.supported) {
      done();
      return;
    }

    const server = boltStub.start('./test/resources/boltstub/write_tx_with_bookmarks.script', 9001);

    boltStub.run(() => {
      const driver = boltStub.newDriver('bolt://127.0.0.1:9001');
      const session = driver.session(WRITE, 'neo4j:bookmark:v1:tx42');
      const tx = session.beginTransaction();
      tx.run('CREATE (n {name:\'Bob\'})').then(result => {
        const records = result.records;
        expect(records.length).toEqual(0);

        tx.commit().then(() => {
          expect(session.lastBookmark()).toEqual('neo4j:bookmark:v1:tx4242');

          session.close(() => {
            driver.close();
            server.exit(code => {
              expect(code).toEqual(0);
              done();
            });
          });
        });
      });
    });
  });

  it('should send and receive bookmark between write and read transactions', done => {
    if (!boltStub.supported) {
      done();
      return;
    }

    const server = boltStub.start('./test/resources/boltstub/write_read_tx_with_bookmarks.script', 9001);

    boltStub.run(() => {
      const driver = boltStub.newDriver('bolt://127.0.0.1:9001');
      const session = driver.session(WRITE, 'neo4j:bookmark:v1:tx42');
      const writeTx = session.beginTransaction();
      writeTx.run('CREATE (n {name:\'Bob\'})').then(result => {
        const records = result.records;
        expect(records.length).toEqual(0);

        writeTx.commit().then(() => {
          expect(session.lastBookmark()).toEqual('neo4j:bookmark:v1:tx4242');

          const readTx = session.beginTransaction();
          readTx.run('MATCH (n) RETURN n.name AS name').then(result => {
            const records = result.records;
            expect(records.length).toEqual(1);
            expect(records[0].get('name')).toEqual('Bob');

            readTx.commit().then(() => {
              expect(session.lastBookmark()).toEqual('neo4j:bookmark:v1:tx424242');

              session.close(() => {
                driver.close();
                server.exit(code => {
                  expect(code).toEqual(0);
                  done();
                });
              });
            });
          });
        });
      });
    });
  });

  it('should be possible to override bookmark', done => {
    if (!boltStub.supported) {
      done();
      return;
    }

    const server = boltStub.start('./test/resources/boltstub/write_read_tx_with_bookmark_override.script', 9001);

    boltStub.run(() => {
      const driver = boltStub.newDriver('bolt://127.0.0.1:9001');
      const session = driver.session(WRITE, 'neo4j:bookmark:v1:tx42');
      const writeTx = session.beginTransaction();
      writeTx.run('CREATE (n {name:\'Bob\'})').then(result => {
        const records = result.records;
        expect(records.length).toEqual(0);

        writeTx.commit().then(() => {
          expect(session.lastBookmark()).toEqual('neo4j:bookmark:v1:tx4242');

          const readTx = session.beginTransaction('neo4j:bookmark:v1:tx99');
          readTx.run('MATCH (n) RETURN n.name AS name').then(result => {
            const records = result.records;
            expect(records.length).toEqual(1);
            expect(records[0].get('name')).toEqual('Bob');

            readTx.commit().then(() => {
              expect(session.lastBookmark()).toEqual('neo4j:bookmark:v1:tx424242');

              session.close(() => {
                driver.close();
                server.exit(code => {
                  expect(code).toEqual(0);
                  done();
                });
              });
            });
          });
        });
      });
    });

  });

  it('should not be possible to override bookmark with null', done => {
    if (!boltStub.supported) {
      done();
      return;
    }

    const server = boltStub.start('./test/resources/boltstub/write_read_tx_with_bookmarks.script', 9001);

    boltStub.run(() => {
      const driver = boltStub.newDriver('bolt://127.0.0.1:9001');
      const session = driver.session(WRITE, 'neo4j:bookmark:v1:tx42');
      const writeTx = session.beginTransaction();
      writeTx.run('CREATE (n {name:\'Bob\'})').then(result => {
        const records = result.records;
        expect(records.length).toEqual(0);

        writeTx.commit().then(() => {
          expect(session.lastBookmark()).toEqual('neo4j:bookmark:v1:tx4242');

          const readTx = session.beginTransaction(null);
          readTx.run('MATCH (n) RETURN n.name AS name').then(result => {
            const records = result.records;
            expect(records.length).toEqual(1);
            expect(records[0].get('name')).toEqual('Bob');

            readTx.commit().then(() => {
              expect(session.lastBookmark()).toEqual('neo4j:bookmark:v1:tx424242');

              session.close(() => {
                driver.close();
                server.exit(code => {
                  expect(code).toEqual(0);
                  done();
                });
              });
            });
          });
        });
      });
    });
  });

  it('should throw service unavailable when server dies', done => {
    if (!boltStub.supported) {
      done();
      return;
    }

    const server = boltStub.start('./test/resources/boltstub/dead_read_server.script', 9001);

    boltStub.run(() => {
      const driver = boltStub.newDriver('bolt://127.0.0.1:9001');
      const session = driver.session();
      session.run('MATCH (n) RETURN n.name').catch(error => {
        expect(error.code).toEqual(neo4j.error.SERVICE_UNAVAILABLE);

        driver.close();
        server.exit(code => {
          expect(code).toEqual(0);
          done();
        });
      });
    });
  });

  it('should close connection when RESET fails', done => {
    if (!boltStub.supported) {
      done();
      return;
    }

    const server = boltStub.start('./test/resources/boltstub/reset_error.script', 9001);

    boltStub.run(() => {
      const driver = boltStub.newDriver('bolt://127.0.0.1:9001');
      const session = driver.session();

      session.run('RETURN 42 AS answer').then(result => {
        const records = result.records;
        expect(records.length).toEqual(1);
        expect(records[0].get(0).toNumber()).toEqual(42);
        session.close(() => {

          expect(driver._pool._pools['127.0.0.1:9001'].length).toEqual(0);
          driver.close();
          server.exit(code => {
            expect(code).toEqual(0);
            done();
          });

        });
      }).catch(error => done.fail(error));
    });
  });

});
