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

import TransactionExecutor from '../../src/v1/internal/transaction-executor';
import {newError, SERVICE_UNAVAILABLE, SESSION_EXPIRED} from '../../src/v1/error';
import {hijackNextDateNowCall, setTimeoutMock} from './timers-util';

const TRANSIENT_ERROR_1 = 'Neo.TransientError.Transaction.DeadlockDetected';
const TRANSIENT_ERROR_2 = 'Neo.TransientError.Network.CommunicationError';
const UNKNOWN_ERROR = 'Neo.DatabaseError.General.UnknownError';
const OOM_ERROR = 'Neo.DatabaseError.General.OutOfMemoryError';

describe('TransactionExecutor', () => {

  let fakeSetTimeout;

  beforeEach(() => {
    fakeSetTimeout = setTimeoutMock.install();
  });

  afterEach(() => {
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

  it('should stop retrying when time expires', done => {
    const executor = new TransactionExecutor();
    let workInvocationCounter = 0;
    const realWork = transactionWork([SERVICE_UNAVAILABLE, SESSION_EXPIRED, TRANSIENT_ERROR_1, TRANSIENT_ERROR_2], 42);

    const result = executor.execute(transactionCreator(), tx => {
      expect(tx).toBeDefined();
      workInvocationCounter++;
      if (workInvocationCounter === 3) {
        hijackNextDateNowCall(Date.now() + 30001); // move next `Date.now()` call forward by 30 seconds
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

  commit() {
    if (this._commitErrorCode) {
      return Promise.reject(error(this._commitErrorCode));
    }
    return Promise.resolve();
  }
}
