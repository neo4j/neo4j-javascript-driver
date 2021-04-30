/**
 * Copyright (c) "Neo4j"
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

import { newError, error as err, internal } from 'neo4j-driver-core'
import { setTimeoutMock } from './timers-util'
import lolex from 'lolex'

const {
  transactionExecutor: { TransactionExecutor }
} = internal

const { SERVICE_UNAVAILABLE, SESSION_EXPIRED } = err

const TRANSIENT_ERROR_1 = 'Neo.TransientError.Transaction.DeadlockDetected'
const TRANSIENT_ERROR_2 = 'Neo.TransientError.Network.CommunicationError'
const UNKNOWN_ERROR = 'Neo.DatabaseError.General.UnknownError'
const TX_TERMINATED_ERROR = 'Neo.TransientError.Transaction.Terminated'
const LOCKS_TERMINATED_ERROR =
  'Neo.TransientError.Transaction.LockClientStopped'
const OOM_ERROR = 'Neo.DatabaseError.General.OutOfMemoryError'

// Not exactly integration tests but annoyingly slow for being a unit tests.
describe('#integration TransactionExecutor', () => {
  it('should retry until database error happens', async () => {
    await testNoRetryOnUnknownError(
      [
        SERVICE_UNAVAILABLE,
        SERVICE_UNAVAILABLE,
        TRANSIENT_ERROR_2,
        SESSION_EXPIRED,
        UNKNOWN_ERROR,
        SESSION_EXPIRED
      ],
      5
    )
  }, 60000)

  it('should stop retrying when time expires', async () => {
    let clock
    const usedTransactions = []
    try {
      const executor = new TransactionExecutor()
      const realWork = transactionWork(
        [
          SERVICE_UNAVAILABLE,
          SESSION_EXPIRED,
          TRANSIENT_ERROR_1,
          TRANSIENT_ERROR_2
        ],
        42
      )

      await executor.execute(transactionCreator(), tx => {
        expect(tx).toBeDefined()
        usedTransactions.push(tx)
        if (usedTransactions.length === 3) {
          const currentTime = Date.now()
          clock = lolex.install()
          clock.setSystemTime(currentTime + 30001) // move `Date.now()` call forward by 30 seconds
        }
        return realWork()
      })

      expect(false).toBeTruthy('should have thrown an exception')
    } catch (error) {
      expect(usedTransactions.length).toEqual(3)
      expectAllTransactionsToBeClosed(usedTransactions)
      expect(error.code).toEqual(TRANSIENT_ERROR_1)
    } finally {
      if (clock) {
        clock.uninstall()
      }
    }
  }, 60000)

  it('should cancel in-flight timeouts when closed', async () => {
    const fakeSetTimeout = setTimeoutMock.install()
    try {
      const executor = new TransactionExecutor()
      // do not execute setTimeout callbacks
      fakeSetTimeout.pause()

      executor.execute(transactionCreator([SERVICE_UNAVAILABLE]), () =>
        Promise.resolve(42)
      )
      executor.execute(transactionCreator([TRANSIENT_ERROR_1]), () =>
        Promise.resolve(4242)
      )
      executor.execute(transactionCreator([SESSION_EXPIRED]), () =>
        Promise.resolve(424242)
      )

      await new Promise((resolve, reject) => {
        fakeSetTimeout.setTimeoutOriginal(() => {
          try {
            executor.close()
            expect(fakeSetTimeout.clearedTimeouts.length).toEqual(3)
            resolve()
          } catch (error) {
            reject(error)
          }
        }, 1000)
      })
    } finally {
      fakeSetTimeout.uninstall()
    }
  }, 60000)
})

describe('#unit TransactionExecutor', () => {
  it('should retry when transaction work returns promise rejected with SERVICE_UNAVAILABLE', async () => {
    await testRetryWhenTransactionWorkReturnsRejectedPromise([
      SERVICE_UNAVAILABLE
    ])
  }, 30000)

  it('should retry when transaction work returns promise rejected with SESSION_EXPIRED', async () => {
    await testRetryWhenTransactionWorkReturnsRejectedPromise([SESSION_EXPIRED])
  }, 30000)

  it('should retry when transaction work returns promise rejected with deadlock error', async () => {
    await testRetryWhenTransactionWorkReturnsRejectedPromise([
      TRANSIENT_ERROR_1
    ])
  }, 30000)

  it('should retry when transaction work returns promise rejected with communication error', async () => {
    await testRetryWhenTransactionWorkReturnsRejectedPromise([
      TRANSIENT_ERROR_2
    ])
  }, 30000)

  it('should not retry when transaction work returns promise rejected with OOM error', async () => {
    await testNoRetryOnUnknownError([OOM_ERROR], 1)
  }, 30000)

  it('should not retry when transaction work returns promise rejected with unknown error', async () => {
    await testNoRetryOnUnknownError([UNKNOWN_ERROR], 1)
  }, 30000)

  it('should not retry when transaction work returns promise rejected with transaction termination error', async () => {
    await testNoRetryOnUnknownError([TX_TERMINATED_ERROR], 1)
  }, 30000)

  it('should not retry when transaction work returns promise rejected with locks termination error', async () => {
    await testNoRetryOnUnknownError([LOCKS_TERMINATED_ERROR], 1)
  }, 30000)

  it('should not retry when transaction work returns promise rejected with unknown error type', async () => {
    class MyTestError extends Error {
      constructor (message, code) {
        super(message)
        this.code = code
      }
    }

    const error = new MyTestError('an unexpected error', 504)
    const executor = new TransactionExecutor()
    const realWork = () => Promise.reject(error)

    await expectAsync(
      executor.execute(transactionCreator(), tx => realWork())
    ).toBeRejectedWith(error)
  }, 30000)

  it('should retry when given transaction creator throws once', async () => {
    await testRetryWhenTransactionCreatorFails([SERVICE_UNAVAILABLE])
  }, 30000)

  it('should retry when given transaction creator throws many times', async () => {
    await testRetryWhenTransactionCreatorFails([
      SERVICE_UNAVAILABLE,
      SESSION_EXPIRED,
      TRANSIENT_ERROR_2,
      SESSION_EXPIRED,
      SERVICE_UNAVAILABLE,
      TRANSIENT_ERROR_1,
      'Neo.ClientError.Security.AuthorizationExpired'
    ])
  }, 30000)

  it('should retry when given transaction work throws once', async () => {
    await testRetryWhenTransactionWorkThrows([SERVICE_UNAVAILABLE])
  }, 30000)

  it('should retry when given transaction work throws many times', async () => {
    await testRetryWhenTransactionWorkThrows([
      SERVICE_UNAVAILABLE,
      TRANSIENT_ERROR_2,
      TRANSIENT_ERROR_2,
      SESSION_EXPIRED,
      'Neo.ClientError.Security.AuthorizationExpired'
    ])
  }, 30000)

  it('should retry when given transaction work returns rejected promise many times', async () => {
    await testRetryWhenTransactionWorkReturnsRejectedPromise([
      SERVICE_UNAVAILABLE,
      SERVICE_UNAVAILABLE,
      TRANSIENT_ERROR_2,
      SESSION_EXPIRED,
      TRANSIENT_ERROR_1,
      SESSION_EXPIRED,
      'Neo.ClientError.Security.AuthorizationExpired'
    ])
  }, 30000)

  it('should retry when transaction commit returns rejected promise once', async () => {
    await testRetryWhenTransactionCommitReturnsRejectedPromise([
      TRANSIENT_ERROR_1
    ])
  }, 30000)

  it('should retry when transaction commit returns rejected promise multiple times', async () => {
    await testRetryWhenTransactionCommitReturnsRejectedPromise([
      TRANSIENT_ERROR_1,
      TRANSIENT_ERROR_1,
      SESSION_EXPIRED,
      SERVICE_UNAVAILABLE,
      TRANSIENT_ERROR_2,
      'Neo.ClientError.Security.AuthorizationExpired'
    ])
  }, 30000)

  it('should retry when transaction work throws and rollback fails', async () => {
    await testRetryWhenTransactionWorkThrowsAndRollbackFails(
      [
        SERVICE_UNAVAILABLE,
        TRANSIENT_ERROR_2,
        'Neo.ClientError.Security.AuthorizationExpired',
        SESSION_EXPIRED,
        SESSION_EXPIRED
      ],
      [SESSION_EXPIRED, TRANSIENT_ERROR_1]
    )
  }, 30000)

  it('should allow zero max retry time', () => {
    const executor = new TransactionExecutor(0)
    expect(executor._maxRetryTimeMs).toEqual(0)
  }, 30000)

  it('should allow zero initial delay', () => {
    const executor = new TransactionExecutor(42, 0)
    expect(executor._initialRetryDelayMs).toEqual(0)
  }, 30000)

  it('should disallow zero multiplier', () => {
    expect(() => new TransactionExecutor(42, 42, 0)).toThrow()
  }, 30000)

  it('should allow zero jitter factor', () => {
    const executor = new TransactionExecutor(42, 42, 42, 0)
    expect(executor._jitterFactor).toEqual(0)
  }, 30000)

  async function testRetryWhenTransactionCreatorFails (errorCodes) {
    const fakeSetTimeout = setTimeoutMock.install()
    try {
      const executor = new TransactionExecutor()
      const transactionCreator = throwingTransactionCreator(
        errorCodes,
        new FakeTransaction()
      )
      const usedTransactions = []

      const result = await executor.execute(transactionCreator, tx => {
        expect(tx).toBeDefined()
        usedTransactions.push(tx)
        return Promise.resolve(42)
      })

      expect(usedTransactions.length).toEqual(1)
      expect(result).toEqual(42)
      verifyRetryDelays(fakeSetTimeout, errorCodes.length)
    } finally {
      fakeSetTimeout.uninstall()
    }
  }

  async function testRetryWhenTransactionWorkReturnsRejectedPromise (
    errorCodes
  ) {
    const fakeSetTimeout = setTimeoutMock.install()
    try {
      const executor = new TransactionExecutor()
      const usedTransactions = []
      const realWork = transactionWork(errorCodes, 42)

      const result = await executor.execute(transactionCreator(), tx => {
        expect(tx).toBeDefined()
        usedTransactions.push(tx)
        return realWork()
      })

      // work should have failed 'failures.length' times and succeeded 1 time
      expect(usedTransactions.length).toEqual(errorCodes.length + 1)
      expectAllTransactionsToBeClosed(usedTransactions)
      expect(result).toEqual(42)
      verifyRetryDelays(fakeSetTimeout, errorCodes.length)
    } finally {
      fakeSetTimeout.uninstall()
    }
  }

  async function testRetryWhenTransactionCommitReturnsRejectedPromise (
    errorCodes
  ) {
    const fakeSetTimeout = setTimeoutMock.install()
    try {
      const executor = new TransactionExecutor()
      const usedTransactions = []
      const realWork = () => Promise.resolve(4242)

      const result = await executor.execute(
        transactionCreator(errorCodes),
        tx => {
          expect(tx).toBeDefined()
          usedTransactions.push(tx)
          return realWork()
        }
      )

      // work should have failed 'failures.length' times and succeeded 1 time
      expect(usedTransactions.length).toEqual(errorCodes.length + 1)
      expectAllTransactionsToBeClosed(usedTransactions)
      expect(result).toEqual(4242)
      verifyRetryDelays(fakeSetTimeout, errorCodes.length)
    } finally {
      fakeSetTimeout.uninstall()
    }
  }

  async function testRetryWhenTransactionWorkThrows (errorCodes) {
    const fakeSetTimeout = setTimeoutMock.install()
    try {
      const executor = new TransactionExecutor()
      const usedTransactions = []
      const realWork = throwingTransactionWork(errorCodes, 42)

      const result = await executor.execute(transactionCreator(), tx => {
        expect(tx).toBeDefined()
        usedTransactions.push(tx)
        return realWork()
      })

      // work should have failed 'failures.length' times and succeeded 1 time
      expect(usedTransactions.length).toEqual(errorCodes.length + 1)
      expectAllTransactionsToBeClosed(usedTransactions)
      expect(result).toEqual(42)
      verifyRetryDelays(fakeSetTimeout, errorCodes.length)
    } finally {
      fakeSetTimeout.uninstall()
    }
  }

  async function testRetryWhenTransactionWorkThrowsAndRollbackFails (
    txWorkErrorCodes,
    rollbackErrorCodes
  ) {
    const fakeSetTimeout = setTimeoutMock.install()
    try {
      const executor = new TransactionExecutor()
      const usedTransactions = []
      const realWork = throwingTransactionWork(txWorkErrorCodes, 424242)

      const result = await executor.execute(
        transactionCreator([], rollbackErrorCodes),
        tx => {
          expect(tx).toBeDefined()
          usedTransactions.push(tx)
          return realWork()
        }
      )

      // work should have failed 'failures.length' times and succeeded 1 time
      expect(usedTransactions.length).toEqual(txWorkErrorCodes.length + 1)
      expectAllTransactionsToBeClosed(usedTransactions)
      expect(result).toEqual(424242)
      verifyRetryDelays(fakeSetTimeout, txWorkErrorCodes.length)
    } finally {
      fakeSetTimeout.uninstall()
    }
  }
})

async function testNoRetryOnUnknownError (
  errorCodes,
  expectedWorkInvocationCount
) {
  const executor = new TransactionExecutor()
  const usedTransactions = []
  const realWork = transactionWork(errorCodes, 42)

  try {
    await executor.execute(transactionCreator(), tx => {
      expect(tx).toBeDefined()
      usedTransactions.push(tx)
      return realWork()
    })
  } catch (error) {
    expect(usedTransactions.length).toEqual(expectedWorkInvocationCount)
    expectAllTransactionsToBeClosed(usedTransactions)
    if (errorCodes.length === 1) {
      expect(error.code).toEqual(errorCodes[0])
    } else {
      expect(error.code).toEqual(errorCodes[expectedWorkInvocationCount - 1])
    }
    return
  }

  expect(false).toBeTruthy('exception expected')
}

function transactionCreator (commitErrorCodes, rollbackErrorCodes) {
  const remainingCommitErrorCodes = (commitErrorCodes || []).slice().reverse()
  const remainingRollbackErrorCodes = (rollbackErrorCodes || [])
    .slice()
    .reverse()
  return () =>
    new FakeTransaction(
      remainingCommitErrorCodes.pop(),
      remainingRollbackErrorCodes.pop()
    )
}

function throwingTransactionCreator (errorCodes, result) {
  const remainingErrorCodes = errorCodes.slice().reverse()
  return () => {
    if (remainingErrorCodes.length === 0) {
      return result
    }
    const errorCode = remainingErrorCodes.pop()
    throw error(errorCode)
  }
}

function throwingTransactionWork (errorCodes, result) {
  const remainingErrorCodes = errorCodes.slice().reverse()
  return () => {
    if (remainingErrorCodes.length === 0) {
      return Promise.resolve(result)
    }
    const errorCode = remainingErrorCodes.pop()
    throw error(errorCode)
  }
}

function transactionWork (errorCodes, result) {
  const remainingErrorCodes = errorCodes.slice().reverse()
  return () => {
    if (remainingErrorCodes.length === 0) {
      return Promise.resolve(result)
    }
    const errorCode = remainingErrorCodes.pop()
    return Promise.reject(error(errorCode))
  }
}

function error (code) {
  return newError('', code)
}

function verifyRetryDelays (fakeSetTimeout, expectedInvocationCount) {
  const delays = fakeSetTimeout.invocationDelays
  expect(delays.length).toEqual(expectedInvocationCount)
  delays.forEach((delay, index) => {
    // delays make a geometric progression with fist element 1000 and multiplier 2.0
    // so expected delay can be calculated as n-th element: `firstElement * pow(multiplier, n - 1)`
    const expectedDelayWithoutJitter = 1000 * Math.pow(2.0, index)
    const jitter = expectedDelayWithoutJitter * 0.2
    const min = expectedDelayWithoutJitter - jitter
    const max = expectedDelayWithoutJitter + jitter

    expect(delay >= min).toBeTruthy()
    expect(delay <= max).toBeTruthy()
  })
}

function expectAllTransactionsToBeClosed (transactions) {
  transactions.forEach(tx => expect(tx.isOpen()).toBeFalsy())
}

class FakeTransaction {
  constructor (commitErrorCode, rollbackErrorCode) {
    this._commitErrorCode = commitErrorCode
    this._rollbackErrorCode = rollbackErrorCode
    this._open = true
  }

  isOpen () {
    return this._open
  }

  commit () {
    this._open = false
    if (this._commitErrorCode) {
      return Promise.reject(error(this._commitErrorCode))
    }
    return Promise.resolve()
  }

  rollback () {
    this._open = false
    if (this._rollbackErrorCode) {
      return Promise.reject(error(this._rollbackErrorCode))
    }
    return Promise.resolve()
  }
}
