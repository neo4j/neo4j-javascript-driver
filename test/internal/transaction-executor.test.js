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

import TransactionExecutor from '../../src/v1/internal/transaction-executor';
import {newError, SERVICE_UNAVAILABLE, SESSION_EXPIRED} from '../../src/v1/error';
import {setTimeoutMock} from './timers-util';
import lolex from 'lolex';

const TRANSIENT_ERROR_1 = 'Neo.TransientError.Transaction.DeadlockDetected';
const TRANSIENT_ERROR_2 = 'Neo.TransientError.Network.CommunicationError';
const UNKNOWN_ERROR = 'Neo.DatabaseError.General.UnknownError';
const TX_TERMINATED_ERROR = 'Neo.TransientError.Transaction.Terminated';
const LOCKS_TERMINATED_ERROR = 'Neo.TransientError.Transaction.LockClientStopped';
const OOM_ERROR = 'Neo.DatabaseError.General.OutOfMemoryError';

describe('TransactionExecutor', () => {

  let clock;
  let fakeSetTimeout;

  beforeEach(() => {
    fakeSetTimeout = setTimeoutMock.install();
  });

  afterEach(() => {
    if (clock) {
      clock.uninstall();
      clock = null;
    }
    fakeSetTimeout.uninstall();
  });

  it('should retry when transaction work returns promise rejected with SERVICE_UNAVAILABLE', done => {
    testRetryWhenTransactionWorkReturnsRejectedPromise([SERVICE_UNAVAILABLE], done);
  });

  it('should retry when transaction work returns promise rejected with SESSION_EXPIRED', done => {
    testRetryWhenTransactionWorkReturnsRejectedPromise([SESSION_EXPIRED], done);
  });

  it('should retry when transaction work returns promise rejected with deadlock error', done => {
    testRetryWhenTransactionWorkReturnsRejectedPromise([TRANSIENT_ERROR_1], done);
  });

  it('should retry when transaction work returns promise rejected with communication error', done => {
    testRetryWhenTransactionWorkReturnsRejectedPromise([TRANSIENT_ERROR_2], done);
  });

  it('should not retry when transaction work returns promise rejected with OOM error', done => {
    testNoRetryOnUnknownError([OOM_ERROR], 1, done);
  });

  it('should not retry when transaction work returns promise rejected with unknown error', done => {
    testNoRetryOnUnknownError([UNKNOWN_ERROR], 1, done);
  });

  it('should not retry when transaction work returns promise rejected with transaction termination error', done => {
    testNoRetryOnUnknownError([TX_TERMINATED_ERROR], 1, done);
  });

  it('should not retry when transaction work returns promise rejected with locks termination error', done => {
    testNoRetryOnUnknownError([LOCKS_TERMINATED_ERROR], 1, done);
  });

  it('should stop retrying when time expires', done => {
    const executor = new TransactionExecutor();
    let workInvocationCounter = 0;
    const realWork = transactionWork([SERVICE_UNAVAILABLE, SESSION_EXPIRED, TRANSIENT_ERROR_1, TRANSIENT_ERROR_2], 42);

    const result = executor.execute(transactionCreator(), tx => {
      expect(tx).toBeDefined();
      workInvocationCounter++;
      if (workInvocationCounter === 3) {
        const currentTime = Date.now();
        clock = lolex.install();
        clock.setSystemTime(currentTime + 30001); // move `Date.now()` call forward by 30 seconds
      }
      return realWork();
    });

    result.catch(error => {
      expect(workInvocationCounter).toEqual(3);
      expect(error.code).toEqual(TRANSIENT_ERROR_1);
      done();
    });
  });

  it('should retry when given transaction creator throws once', done => {
    testRetryWhenTransactionCreatorFails(
      [SERVICE_UNAVAILABLE],
      done
    );
  });

  it('should retry when given transaction creator throws many times', done => {
    testRetryWhenTransactionCreatorFails(
      [SERVICE_UNAVAILABLE, SESSION_EXPIRED, TRANSIENT_ERROR_2, SESSION_EXPIRED, SERVICE_UNAVAILABLE, TRANSIENT_ERROR_1],
      done
    );
  });

  it('should retry when given transaction work throws once', done => {
    testRetryWhenTransactionWorkThrows([SERVICE_UNAVAILABLE], done);
  });

  it('should retry when given transaction work throws many times', done => {
    testRetryWhenTransactionWorkThrows(
      [SERVICE_UNAVAILABLE, TRANSIENT_ERROR_2, TRANSIENT_ERROR_2, SESSION_EXPIRED],
      done
    );
  });

  it('should retry when given transaction work returns rejected promise many times', done => {
    testRetryWhenTransactionWorkReturnsRejectedPromise(
      [SERVICE_UNAVAILABLE, SERVICE_UNAVAILABLE, TRANSIENT_ERROR_2, SESSION_EXPIRED, TRANSIENT_ERROR_1, SESSION_EXPIRED],
      done
    );
  });

  it('should retry when transaction commit returns rejected promise once', done => {
    testRetryWhenTransactionCommitReturnsRejectedPromise([TRANSIENT_ERROR_1], done);
  });

  it('should retry when transaction commit returns rejected promise multiple times', done => {
    testRetryWhenTransactionCommitReturnsRejectedPromise(
      [TRANSIENT_ERROR_1, TRANSIENT_ERROR_1, SESSION_EXPIRED, SERVICE_UNAVAILABLE, TRANSIENT_ERROR_2],
      done
    );
  });

  it('should retry until database error happens', done => {
    testNoRetryOnUnknownError(
      [SERVICE_UNAVAILABLE, SERVICE_UNAVAILABLE, TRANSIENT_ERROR_2, SESSION_EXPIRED, UNKNOWN_ERROR, SESSION_EXPIRED],
      5,
      done
    );
  });

  it('should cancel in-flight timeouts when closed', done => {
    const executor = new TransactionExecutor();
    // do not execute setTimeout callbacks
    fakeSetTimeout.pause();

    executor.execute(transactionCreator([SERVICE_UNAVAILABLE]), () => Promise.resolve(42));
    executor.execute(transactionCreator([TRANSIENT_ERROR_1]), () => Promise.resolve(4242));
    executor.execute(transactionCreator([SESSION_EXPIRED]), () => Promise.resolve(424242));

    fakeSetTimeout.setTimeoutOriginal(() => {
      executor.close();
      expect(fakeSetTimeout.clearedTimeouts.length).toEqual(3);
      done();
    }, 1000);
  });

  it('should allow zero max retry time', () => {
    const executor = new TransactionExecutor(0);
    expect(executor._maxRetryTimeMs).toEqual(0);
  });

  it('should allow zero initial delay', () => {
    const executor = new TransactionExecutor(42, 0);
    expect(executor._initialRetryDelayMs).toEqual(0);
  });

  it('should disallow zero multiplier', () => {
    expect(() => new TransactionExecutor(42, 42, 0)).toThrow();
  });

  it('should allow zero jitter factor', () => {
    const executor = new TransactionExecutor(42, 42, 42, 0);
    expect(executor._jitterFactor).toEqual(0);
  });

  function testRetryWhenTransactionCreatorFails(errorCodes, done) {
    const executor = new TransactionExecutor();
    const transactionCreator = throwingTransactionCreator(errorCodes, new FakeTransaction());
    let workInvocationCounter = 0;

    const result = executor.execute(transactionCreator, tx => {
      expect(tx).toBeDefined();
      workInvocationCounter++;
      return Promise.resolve(42);
    });

    result.then(value => {
      expect(workInvocationCounter).toEqual(1);
      expect(value).toEqual(42);
      verifyRetryDelays(fakeSetTimeout, errorCodes.length);
      done();
    });
  }

  function testRetryWhenTransactionWorkReturnsRejectedPromise(errorCodes, done) {
    const executor = new TransactionExecutor();
    let workInvocationCounter = 0;
    const realWork = transactionWork(errorCodes, 42);

    const result = executor.execute(transactionCreator(), tx => {
      expect(tx).toBeDefined();
      workInvocationCounter++;
      return realWork();
    });

    result.then(value => {
      // work should have failed 'failures.length' times and succeeded 1 time
      expect(workInvocationCounter).toEqual(errorCodes.length + 1);
      expect(value).toEqual(42);
      verifyRetryDelays(fakeSetTimeout, errorCodes.length);
      done();
    });
  }

  function testRetryWhenTransactionCommitReturnsRejectedPromise(errorCodes, done) {
    const executor = new TransactionExecutor();
    let workInvocationCounter = 0;
    const realWork = () => Promise.resolve(4242);

    const result = executor.execute(transactionCreator(errorCodes), tx => {
      expect(tx).toBeDefined();
      workInvocationCounter++;
      return realWork();
    });

    result.then(value => {
      // work should have failed 'failures.length' times and succeeded 1 time
      expect(workInvocationCounter).toEqual(errorCodes.length + 1);
      expect(value).toEqual(4242);
      verifyRetryDelays(fakeSetTimeout, errorCodes.length);
      done();
    });
  }

  function testRetryWhenTransactionWorkThrows(errorCodes, done) {
    const executor = new TransactionExecutor();
    let workInvocationCounter = 0;
    const realWork = throwingTransactionWork(errorCodes, 42);

    const result = executor.execute(transactionCreator(), tx => {
      expect(tx).toBeDefined();
      workInvocationCounter++;
      return realWork();
    });

    result.then(value => {
      // work should have failed 'failures.length' times and succeeded 1 time
      expect(workInvocationCounter).toEqual(errorCodes.length + 1);
      expect(value).toEqual(42);
      verifyRetryDelays(fakeSetTimeout, errorCodes.length);
      done();
    });
  }

  function testNoRetryOnUnknownError(errorCodes, expectedWorkInvocationCount, done) {
    const executor = new TransactionExecutor();
    let workInvocationCounter = 0;
    const realWork = transactionWork(errorCodes, 42);

    const result = executor.execute(transactionCreator(), tx => {
      expect(tx).toBeDefined();
      workInvocationCounter++;
      return realWork();
    });

    result.catch(error => {
      expect(workInvocationCounter).toEqual(expectedWorkInvocationCount);
      if (errorCodes.length === 1) {
        expect(error.code).toEqual(errorCodes[0]);
      } else {
        expect(error.code).toEqual(errorCodes[expectedWorkInvocationCount - 1]);
      }
      done();
    });
  }

});

function transactionCreator(commitErrorCodes) {
  const remainingErrorCodes = (commitErrorCodes || []).slice().reverse();
  return () => new FakeTransaction(remainingErrorCodes.pop());
}

function throwingTransactionCreator(errorCodes, result) {
  const remainingErrorCodes = errorCodes.slice().reverse();
  return () => {
    if (remainingErrorCodes.length === 0) {
      return result;
    }
    const errorCode = remainingErrorCodes.pop();
    throw error(errorCode);
  };
}

function throwingTransactionWork(errorCodes, result) {
  const remainingErrorCodes = errorCodes.slice().reverse();
  return () => {
    if (remainingErrorCodes.length === 0) {
      return Promise.resolve(result);
    }
    const errorCode = remainingErrorCodes.pop();
    throw error(errorCode);
  };
}

function transactionWork(errorCodes, result) {
  const remainingErrorCodes = errorCodes.slice().reverse();
  return () => {
    if (remainingErrorCodes.length === 0) {
      return Promise.resolve(result);
    }
    const errorCode = remainingErrorCodes.pop();
    return Promise.reject(error(errorCode));
  };
}

function error(code) {
  return newError('', code);
}

function verifyRetryDelays(fakeSetTimeout, expectedInvocationCount) {
  const delays = fakeSetTimeout.invocationDelays;
  expect(delays.length).toEqual(expectedInvocationCount);
  delays.forEach((delay, index) => {
    // delays make a geometric progression with fist element 1000 and multiplier 2.0
    // so expected delay can be calculated as n-th element: `firstElement * pow(multiplier, n - 1)`
    const expectedDelayWithoutJitter = 1000 * Math.pow(2.0, index);
    const jitter = expectedDelayWithoutJitter * 0.2;
    const min = expectedDelayWithoutJitter - jitter;
    const max = expectedDelayWithoutJitter + jitter;

    expect(delay >= min).toBeTruthy();
    expect(delay <= max).toBeTruthy();
  });
}

class FakeTransaction {

  constructor(commitErrorCode) {
    this._commitErrorCode = commitErrorCode;
  }

  isOpen() {
    return true;
  }

  commit() {
    if (this._commitErrorCode) {
      return Promise.reject(error(this._commitErrorCode));
    }
    return Promise.resolve();
  }
}
