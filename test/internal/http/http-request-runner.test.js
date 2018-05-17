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

import HttpRequestRunner from '../../../src/v1/internal/http/http-request-runner';
import neo4j from '../../../src/v1';
import sharedNeo4j from '../../internal/shared-neo4j';
import urlUtil from '../../../src/v1/internal/url-util';
import testUtils from '.././test-utils';
import _ from 'lodash';

const VALID_URI = 'http://localhost';
const INVALID_URI = 'http://not-localhost';

describe('http request runner', () => {

  it('should begin transaction', done => {
    if (testUtils.isServer()) {
      done();
      return;
    }

    const runner = newRunner(VALID_URI);

    runner.beginTransaction().then(transactionId => {
      verifyTransactionId(transactionId);
      done();
    }).catch(error => {
      done.fail(error);
    });
  });

  it('should begin and commit transaction', done => {
    if (testUtils.isServer()) {
      done();
      return;
    }

    const runner = newRunner(VALID_URI);

    runner.beginTransaction().then(transactionId => {
      verifyTransactionId(transactionId);
      runner.commitTransaction(transactionId).then(() => {
        done();
      }).catch(error => {
        done.fail(error);
      });
    }).catch(error => {
      done.fail(error);
    });
  });

  it('should begin and rollback transaction', done => {
    if (testUtils.isServer()) {
      done();
      return;
    }

    const runner = newRunner(VALID_URI);

    runner.beginTransaction().then(transactionId => {
      verifyTransactionId(transactionId);
      runner.rollbackTransaction(transactionId).then(() => {
        done();
      }).catch(error => {
        done.fail(error);
      });
    }).catch(error => {
      done.fail(error);
    });
  });

  it('should fail to begin transaction with invalid uri', done => {
    if (testUtils.isServer()) {
      done();
      return;
    }

    const runner = newRunner(INVALID_URI);

    runner.beginTransaction().then(transactionId => {
      done.fail(new Error('Should not be possible to begin a transaction with invalid URI, received transactionId: ' + transactionId));
    }).catch(error => {
      expect(error.name).toEqual('Neo4jError');
      expect(error.code).toEqual(neo4j.error.SERVICE_UNAVAILABLE);
      done();
    });
  });

  it('should fail to commit transaction with invalid uri', done => {
    if (testUtils.isServer()) {
      done();
      return;
    }

    const runner = newRunner(INVALID_URI);

    runner.commitTransaction(42).then(() => {
      done.fail(new Error('Should not be possible to commit a transaction with invalid URI'));
    }).catch(error => {
      expect(error.name).toEqual('Neo4jError');
      expect(error.code).toEqual(neo4j.error.SERVICE_UNAVAILABLE);
      done();
    });
  });

  it('should fail to rollback transaction with invalid uri', done => {
    if (testUtils.isServer()) {
      done();
      return;
    }

    const runner = newRunner(INVALID_URI);

    runner.rollbackTransaction(42).then(() => {
      done.fail(new Error('Should not be possible to rollback a transaction with invalid URI'));
    }).catch(error => {
      expect(error.name).toEqual('Neo4jError');
      expect(error.code).toEqual(neo4j.error.SERVICE_UNAVAILABLE);
      done();
    });
  });

  it('should fail to commit transaction with invalid id', done => {
    if (testUtils.isServer()) {
      done();
      return;
    }

    const runner = newRunner(VALID_URI);

    runner.commitTransaction(424242).then(() => {
      done.fail(new Error('Should not be possible to commit a transaction with invalid id'));
    }).catch(error => {
      expect(error.name).toEqual('Neo4jError');
      expect(error.code).toEqual('Neo.ClientError.Transaction.TransactionNotFound');
      done();
    });
  });

  it('should fail to rollback transaction with invalid id', done => {
    if (testUtils.isServer()) {
      done();
      return;
    }

    const runner = newRunner(VALID_URI);

    runner.rollbackTransaction(424242).then(() => {
      done.fail(new Error('Should not be possible to rollback a transaction with invalid id'));
    }).catch(error => {
      expect(error.name).toEqual('Neo4jError');
      expect(error.code).toEqual('Neo.ClientError.Transaction.TransactionNotFound');
      done();
    });
  });

  it('should run query in transaction', done => {
    if (testUtils.isServer()) {
      done();
      return;
    }

    const runner = newRunner(VALID_URI);

    runner.beginTransaction().then(transactionId => {
      verifyTransactionId(transactionId);
      runner.runQuery(transactionId, 'RETURN 42', {}).then(streamObserver => {
        streamObserver.subscribe({
          onNext: record => {
            expect(record.get(0)).toEqual(42);
          },
          onError: error => {
            done.fail(error);
          },
          onCompleted: () => {
            runner.rollbackTransaction(transactionId).catch(error => {
            }).then(() => {
              done();
            });
          }
        });
      }).catch(error => {
        done.fail(error);
      });
      done();
    }).catch(error => {
      done.fail(error);
    });
  });

  it('should fail to run invalid query in transaction', done => {
    if (testUtils.isServer()) {
      done();
      return;
    }

    const runner = newRunner(VALID_URI);

    runner.beginTransaction().then(transactionId => {
      verifyTransactionId(transactionId);
      runner.runQuery(transactionId, 'WRONG QUERY', {}).then(streamObserver => {
        streamObserver.subscribe({
          onNext: () => {
            done.fail(new Error('Should not receive records'));
          },
          onError: error => {
            expect(error.name).toEqual('Neo4jError');
            expect(error.code).toEqual('Neo.ClientError.Statement.SyntaxError');

            runner.rollbackTransaction(transactionId).catch(error => {
            }).then(() => {
              done();
            });
          },
          onCompleted: () => {
            done.fail(new Error('Should not complete'));
          }
        });
      }).catch(error => {
        done.fail(error);
      });
      done();
    }).catch(error => {
      done.fail(error);
    });
  });

  it('should fail to run query in transaction with invalid uri', done => {
    if (testUtils.isServer()) {
      done();
      return;
    }

    const runner = newRunner(INVALID_URI);

    runner.runQuery(424242, 'RETURN 42', {}).then(streamObserver => {
      expect(streamObserver.hasFailed()).toBeTruthy();
      streamObserver.subscribe({
        onNext: () => {
          done.fail(new Error('Should not receive records'));
        },
        onError: error => {
          expect(error.name).toEqual('Neo4jError');
          expect(error.code).toEqual(neo4j.error.SERVICE_UNAVAILABLE);
          done();
        },
        onCompleted: () => {
          done.fail(new Error('Should not complete'));
        }
      });
    }).catch(error => {
      done.fail(error);
    });
  });

  it('should fail to run query in transaction with invalid id', done => {
    if (testUtils.isServer()) {
      done();
      return;
    }

    const runner = newRunner(VALID_URI);

    runner.runQuery(424242, 'RETURN 42', {}).then(streamObserver => {
      expect(streamObserver.hasFailed()).toBeTruthy();
      streamObserver.subscribe({
        onNext: () => {
          done.fail(new Error('Should not receive records'));
        },
        onError: error => {
          expect(error.name).toEqual('Neo4jError');
          expect(error.code).toEqual('Neo.ClientError.Transaction.TransactionNotFound');
          done();
        },
        onCompleted: () => {
          done.fail(new Error('Should not complete'));
        }
      });
    }).catch(error => {
      done.fail(error);
    });
  });

});

function verifyTransactionId(transactionId) {
  expect(transactionId).toBeDefined();
  expect(transactionId).not.toBeNull();
  expect(_.isNumber(transactionId)).toBeTruthy();
}

function newRunner(url, username, password) {
  username = username ? username : sharedNeo4j.username;
  password = password ? password : sharedNeo4j.password;
  return new HttpRequestRunner(urlUtil.parseDatabaseUrl(url), neo4j.auth.basic(username, password));
}
