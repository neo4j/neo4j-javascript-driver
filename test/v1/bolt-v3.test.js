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
import {ServerVersion, VERSION_3_5_0} from '../../src/v1/internal/server-version';

const TX_CONFIG_WITH_METADATA = {metadata: {a: 1, b: 2}};
const TX_CONFIG_WITH_TIMEOUT = {timeout: 42};

const INVALID_TIMEOUT_VALUES = [0, -1, -42, '15 seconds', [1, 2, 3]];
const INVALID_METADATA_VALUES = ['metadata', ['1', '2', '3'], () => 'hello world'];

describe('Bolt V3 API', () => {

  let driver;
  let session;
  let serverVersion;
  let originalTimeout;

  beforeEach(done => {
    driver = neo4j.driver('bolt://localhost', sharedNeo4j.authToken);
    session = driver.session();
    originalTimeout = jasmine.DEFAULT_TIMEOUT_INTERVAL;
    jasmine.DEFAULT_TIMEOUT_INTERVAL = 20000;

    session.run('MATCH (n) DETACH DELETE n').then(result => {
      serverVersion = ServerVersion.fromString(result.summary.server.version);
      done();
    });
  });

  afterEach(() => {
    jasmine.DEFAULT_TIMEOUT_INTERVAL = originalTimeout;
    session.close();
    driver.close();
  });

  it('should set transaction metadata for auto-commit transaction', done => {
    if (!databaseSupportsBoltV3()) {
      done();
      return;
    }

    const metadata = {
      a: 'hello world',
      b: 424242,
      c: [true, false, true]
    };

    // call listTransactions procedure that should list itself with the specified metadata
    session.run('CALL dbms.listTransactions()', {}, {metadata: metadata})
      .then(result => {
        const receivedMetadata = result.records[0].get('metaData');
        expect(receivedMetadata).toEqual(metadata);
        done();
      })
      .catch(error => {
        done.fail(error);
      });
  });

  it('should set transaction timeout for auto-commit transaction', done => {
    if (!databaseSupportsBoltV3()) {
      done();
      return;
    }

    session.run('CREATE (:Node)') // create a dummy node
      .then(() => {
        const otherSession = driver.session();
        const tx = otherSession.beginTransaction();
        tx.run('MATCH (n:Node) SET n.prop = 1') // lock dummy node but keep the transaction open
          .then(() => {
            // run a query in an auto-commit transaction with timeout and try to update the locked dummy node
            session.run('MATCH (n:Node) SET n.prop = $newValue', {newValue: 2}, {timeout: 1})
              .then(() => done.fail('Failure expected'))
              .catch(error => {
                expectTransactionTerminatedError(error);

                tx.rollback()
                  .then(() => otherSession.close())
                  .then(() => done())
                  .catch(error => done.fail(error));
              });
          });
      });
  });

  it('should set transaction metadata with read transaction function', done => {
    testTransactionMetadataWithTransactionFunctions(true, done);
  });

  it('should set transaction metadata with write transaction function', done => {
    testTransactionMetadataWithTransactionFunctions(false, done);
  });

  it('should fail auto-commit transaction with metadata when database does not support Bolt V3', done => {
    testAutoCommitTransactionConfigWhenBoltV3NotSupported(TX_CONFIG_WITH_METADATA, done);
  });

  it('should fail auto-commit transaction with timeout when database does not support Bolt V3', done => {
    testAutoCommitTransactionConfigWhenBoltV3NotSupported(TX_CONFIG_WITH_TIMEOUT, done);
  });

  it('should fail read transaction function with metadata when database does not support Bolt V3', done => {
    testTransactionFunctionConfigWhenBoltV3NotSupported(true, TX_CONFIG_WITH_METADATA, done);
  });

  it('should fail read transaction function with timeout when database does not support Bolt V3', done => {
    testTransactionFunctionConfigWhenBoltV3NotSupported(true, TX_CONFIG_WITH_TIMEOUT, done);
  });

  it('should fail write transaction function with metadata when database does not support Bolt V3', done => {
    testTransactionFunctionConfigWhenBoltV3NotSupported(false, TX_CONFIG_WITH_METADATA, done);
  });

  it('should fail write transaction function with timeout when database does not support Bolt V3', done => {
    testTransactionFunctionConfigWhenBoltV3NotSupported(false, TX_CONFIG_WITH_TIMEOUT, done);
  });

  it('should set transaction metadata for explicit transactions', done => {
    if (!databaseSupportsBoltV3()) {
      done();
      return;
    }

    const metadata = {
      a: 12345,
      b: 'string',
      c: [1, 2, 3]
    };

    const tx = session.beginTransaction({metadata: metadata});
    // call listTransactions procedure that should list itself with the specified metadata
    tx.run('CALL dbms.listTransactions()')
      .then(result => {
        const receivedMetadata = result.records[0].get('metaData');
        expect(receivedMetadata).toEqual(metadata);
        tx.commit()
          .then(() => done())
          .catch(error => done.fail(error));
      })
      .catch(error => {
        done.fail(error);
      });
  });

  it('should set transaction timeout for explicit transactions', done => {
    if (!databaseSupportsBoltV3()) {
      done();
      return;
    }

    session.run('CREATE (:Node)') // create a dummy node
      .then(() => {
        const otherSession = driver.session();
        const otherTx = otherSession.beginTransaction();
        otherTx.run('MATCH (n:Node) SET n.prop = 1') // lock dummy node but keep the transaction open
          .then(() => {
            // run a query in an explicit transaction with timeout and try to update the locked dummy node
            const tx = session.beginTransaction({timeout: 1});
            tx.run('MATCH (n:Node) SET n.prop = $newValue', {newValue: 2})
              .then(() => done.fail('Failure expected'))
              .catch(error => {
                expectTransactionTerminatedError(error);

                otherTx.rollback()
                  .then(() => otherSession.close())
                  .then(() => done())
                  .catch(error => done.fail(error));
              });
          });
      });
  });

  it('should fail to run in explicit transaction with metadata when database does not support Bolt V3', done => {
    testRunInExplicitTransactionWithConfigWhenBoltV3NotSupported(TX_CONFIG_WITH_METADATA, done);
  });

  it('should fail to run in explicit transaction with timeout when database does not support Bolt V3', done => {
    testRunInExplicitTransactionWithConfigWhenBoltV3NotSupported(TX_CONFIG_WITH_TIMEOUT, done);
  });

  it('should fail to commit explicit transaction with metadata when database does not support Bolt V3', done => {
    testCloseExplicitTransactionWithConfigWhenBoltV3NotSupported(true, TX_CONFIG_WITH_METADATA, done);
  });

  it('should fail to commit explicit transaction with timeout when database does not support Bolt V3', done => {
    testCloseExplicitTransactionWithConfigWhenBoltV3NotSupported(true, TX_CONFIG_WITH_TIMEOUT, done);
  });

  it('should fail to rollback explicit transaction with metadata when database does not support Bolt V3', done => {
    testCloseExplicitTransactionWithConfigWhenBoltV3NotSupported(false, TX_CONFIG_WITH_METADATA, done);
  });

  it('should fail to rollback explicit transaction with timeout when database does not support Bolt V3', done => {
    testCloseExplicitTransactionWithConfigWhenBoltV3NotSupported(false, TX_CONFIG_WITH_TIMEOUT, done);
  });

  it('should fail to run auto-commit transaction with invalid timeout', () => {
    INVALID_TIMEOUT_VALUES.forEach(invalidValue =>
      expect(() => session.run('RETURN $x', {x: 42}, {timeout: invalidValue})).toThrow());
  });

  it('should fail to run auto-commit transaction with invalid metadata', () => {
    INVALID_METADATA_VALUES.forEach(invalidValue =>
      expect(() => session.run('RETURN $x', {x: 42}, {metadata: invalidValue})).toThrow());
  });

  it('should fail to begin explicit transaction with invalid timeout', () => {
    INVALID_TIMEOUT_VALUES.forEach(invalidValue =>
      expect(() => session.beginTransaction({timeout: invalidValue})).toThrow());
  });

  it('should fail to begin explicit transaction with invalid metadata', () => {
    INVALID_METADATA_VALUES.forEach(invalidValue =>
      expect(() => session.beginTransaction({metadata: invalidValue})).toThrow());
  });

  it('should fail to run read transaction function with invalid timeout', () => {
    INVALID_TIMEOUT_VALUES.forEach(invalidValue =>
      expect(() => session.readTransaction(tx => tx.run('RETURN 1'), {timeout: invalidValue})).toThrow());
  });

  it('should fail to run read transaction function with invalid metadata', () => {
    INVALID_METADATA_VALUES.forEach(invalidValue =>
      expect(() => session.readTransaction(tx => tx.run('RETURN 1'), {metadata: invalidValue})).toThrow());
  });

  it('should fail to run write transaction function with invalid timeout', () => {
    INVALID_TIMEOUT_VALUES.forEach(invalidValue =>
      expect(() => session.writeTransaction(tx => tx.run('RETURN 1'), {timeout: invalidValue})).toThrow());
  });

  it('should fail to run write transaction function with invalid metadata', () => {
    INVALID_METADATA_VALUES.forEach(invalidValue =>
      expect(() => session.writeTransaction(tx => tx.run('RETURN 1'), {metadata: invalidValue})).toThrow());
  });

  it('should use bookmarks for auto commit transactions', done => {
    if (!databaseSupportsBoltV3()) {
      done();
      return;
    }

    const initialBookmark = session.lastBookmark();

    session.run('CREATE ()').then(() => {
      const bookmark1 = session.lastBookmark();
      expect(bookmark1).not.toBeNull();
      expect(bookmark1).toBeDefined();
      expect(bookmark1).not.toEqual(initialBookmark);

      session.run('CREATE ()').then(() => {
        const bookmark2 = session.lastBookmark();
        expect(bookmark2).not.toBeNull();
        expect(bookmark2).toBeDefined();
        expect(bookmark2).not.toEqual(initialBookmark);
        expect(bookmark2).not.toEqual(bookmark1);

        session.run('CREATE ()').then(() => {
          const bookmark3 = session.lastBookmark();
          expect(bookmark3).not.toBeNull();
          expect(bookmark3).toBeDefined();
          expect(bookmark3).not.toEqual(initialBookmark);
          expect(bookmark3).not.toEqual(bookmark1);
          expect(bookmark3).not.toEqual(bookmark2);

          done();
        });
      });
    });
  });

  it('should use bookmarks for auto commit and explicit transactions', done => {
    if (!databaseSupportsBoltV3()) {
      done();
      return;
    }

    const initialBookmark = session.lastBookmark();

    const tx1 = session.beginTransaction();
    tx1.run('CREATE ()').then(() => {
      tx1.commit().then(() => {
        const bookmark1 = session.lastBookmark();
        expect(bookmark1).not.toBeNull();
        expect(bookmark1).toBeDefined();
        expect(bookmark1).not.toEqual(initialBookmark);

        session.run('CREATE ()').then(() => {
          const bookmark2 = session.lastBookmark();
          expect(bookmark2).not.toBeNull();
          expect(bookmark2).toBeDefined();
          expect(bookmark2).not.toEqual(initialBookmark);
          expect(bookmark2).not.toEqual(bookmark1);

          const tx2 = session.beginTransaction();
          tx2.run('CREATE ()').then(() => {
            tx2.commit().then(() => {
              const bookmark3 = session.lastBookmark();
              expect(bookmark3).not.toBeNull();
              expect(bookmark3).toBeDefined();
              expect(bookmark3).not.toEqual(initialBookmark);
              expect(bookmark3).not.toEqual(bookmark1);
              expect(bookmark3).not.toEqual(bookmark2);

              done();
            });
          });
        });
      });
    });
  });

  it('should use bookmarks for auto commit transactions and transaction functions', done => {
    if (!databaseSupportsBoltV3()) {
      done();
      return;
    }

    const initialBookmark = session.lastBookmark();

    session.writeTransaction(tx => tx.run('CREATE ()')).then(() => {
      const bookmark1 = session.lastBookmark();
      expect(bookmark1).not.toBeNull();
      expect(bookmark1).toBeDefined();
      expect(bookmark1).not.toEqual(initialBookmark);

      session.run('CREATE ()').then(() => {
        const bookmark2 = session.lastBookmark();
        expect(bookmark2).not.toBeNull();
        expect(bookmark2).toBeDefined();
        expect(bookmark2).not.toEqual(initialBookmark);
        expect(bookmark2).not.toEqual(bookmark1);

        session.writeTransaction(tx => tx.run('CREATE ()')).then(() => {
          const bookmark3 = session.lastBookmark();
          expect(bookmark3).not.toBeNull();
          expect(bookmark3).toBeDefined();
          expect(bookmark3).not.toEqual(initialBookmark);
          expect(bookmark3).not.toEqual(bookmark1);
          expect(bookmark3).not.toEqual(bookmark2);

          done();
        });
      });
    });
  });

  function testTransactionMetadataWithTransactionFunctions(read, done) {
    if (!databaseSupportsBoltV3()) {
      done();
      return;
    }

    const metadata = {
      foo: 'bar',
      baz: 42
    };

    const txFunctionWithMetadata = work => read
      ? session.readTransaction(work, {metadata: metadata})
      : session.writeTransaction(work, {metadata: metadata});

    txFunctionWithMetadata(tx => tx.run('CALL dbms.listTransactions()'))
      .then(result => {
        const receivedMetadata = result.records[0].get('metaData');
        expect(receivedMetadata).toEqual(metadata);
        done();
      })
      .catch(error => {
        done.fail(error);
      });
  }

  function testAutoCommitTransactionConfigWhenBoltV3NotSupported(txConfig, done) {
    if (databaseSupportsBoltV3()) {
      done();
      return;
    }

    session.run('RETURN $x', {x: 42}, txConfig)
      .then(() => done.fail('Failure expected'))
      .catch(error => {
        expectBoltV3NotSupportedError(error);
        done();
      });
  }

  function testTransactionFunctionConfigWhenBoltV3NotSupported(read, txConfig, done) {
    if (databaseSupportsBoltV3()) {
      done();
      return;
    }

    const txFunctionWithMetadata = work => read
      ? session.readTransaction(work, txConfig)
      : session.writeTransaction(work, txConfig);

    txFunctionWithMetadata(tx => tx.run('RETURN 42'))
      .then(() => done.fail('Failure expected'))
      .catch(error => {
        expectBoltV3NotSupportedError(error);
        done();
      });
  }

  function testRunInExplicitTransactionWithConfigWhenBoltV3NotSupported(txConfig, done) {
    if (databaseSupportsBoltV3()) {
      done();
      return;
    }

    const tx = session.beginTransaction(txConfig);
    tx.run('RETURN 42')
      .then(() => done.fail('Failure expected'))
      .catch(error => {
        expectBoltV3NotSupportedError(error);
        session.close();
        done();
      });
  }

  function testCloseExplicitTransactionWithConfigWhenBoltV3NotSupported(commit, txConfig, done) {
    if (databaseSupportsBoltV3()) {
      done();
      return;
    }

    const tx = session.beginTransaction(txConfig);
    const promise = commit ? tx.commit() : tx.rollback();

    promise.then(() => done.fail('Failure expected'))
      .catch(error => {
        expectBoltV3NotSupportedError(error);
        session.close();
        done();
      });
  }

  function expectBoltV3NotSupportedError(error) {
    expect(error.message.indexOf('Driver is connected to the database that does not support transaction configuration')).toBeGreaterThan(-1);
  }

  function expectTransactionTerminatedError(error) {
    const hasExpectedMessage = error.message.toLowerCase().indexOf('transaction has been terminated') > -1;
    if (!hasExpectedMessage) {
      console.log(`Unexpected error with code: ${error.code}`, error);
    }
    expect(hasExpectedMessage).toBeTruthy();
  }

  function databaseSupportsBoltV3() {
    return serverVersion.compareTo(VERSION_3_5_0) >= 0;
  }

});
