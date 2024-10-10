/**
 * Copyright (c) "Neo4j"
 * Neo4j Sweden AB [https://neo4j.com]
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
import { TimeoutsMock } from './timers-util'
import lolex from 'lolex'

const {
  transactionExecutor: { TransactionExecutor }
} = internal

const { SERVICE_UNAVAILABLE, SESSION_EXPIRED } = err

const TRANSIENT_ERROR_1 = 'Neo.TransientError.Transaction.DeadlockDetected'
const TRANSIENT_ERROR_2 = 'Neo.TransientError.Network.CommunicationError'
const UNKNOWN_ERROR = 'Neo.DatabaseError.General.UnknownError'
const TX_TERMINATED_ERROR = 'Neo.ClientError.Transaction.Terminated'
const LOCKS_TERMINATED_ERROR =
  'Neo.ClientError.Transaction.LockClientStopped'
const OOM_ERROR = 'Neo.DatabaseError.General.OutOfMemoryError'

describe('#unit TransactionExecutor', () => {
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
    const { fakeSetTimeout, executor } = createTransactionExecutorWithFakeTimeout()
    // do not execute setTimeout callbacks
    fakeSetTimeout.disableTimeoutCallbacks()

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
      setTimeout(() => {
        try {
          executor.close()
          expect(fakeSetTimeout.clearedTimeouts.length).toEqual(3)
          resolve()
        } catch (error) {
          reject(error)
        }
      }, 1000)
    })
  }, 60000)
})

;[true, false].forEach(pipelineBegin => {
  describe(`#unit TransactionExecutor (pipelineBegin=${pipelineBegin})`, () => {
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

    it('should not retry when transaction work returns promise rejected with unexpected error', async () => {
      await testNoRetryOnUnknownError([UNKNOWN_ERROR], 1)
    }, 30000)

    it('should not retry when transaction work returns promise rejected with transaction termination error', async () => {
      await testNoRetryOnUnknownError([TX_TERMINATED_ERROR], 1)
    }, 30000)

    it('should not retry when transaction work returns promise rejected with locks termination error', async () => {
      await testNoRetryOnUnknownError([LOCKS_TERMINATED_ERROR], 1)
    }, 30000)

    it('should not retry when transaction work returns promise rejected with unexpected error type', async () => {
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

    it('should retry when given transaction creator fail on begin once', async () => {
      await testRetryWhenTransactionBeginFails([SERVICE_UNAVAILABLE])
    }, 30000)

    it('should retry when given transaction creator throws on begin many times', async () => {
      await testRetryWhenTransactionBeginFails([
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

    it('should wrap transaction', async () => {
      const executor = new TransactionExecutor()
      const expectedTx = new FakeTransaction()
      const modifiedTx = {}
      await executor.execute(() => expectedTx, tx => {
        expect(tx).toEqual(modifiedTx)
        return 1
      }, tx => {
        expect(tx).toEqual(ResolvedFakeTransaction.fromFakeTransaction(expectedTx))
        return modifiedTx
      })
    })

    it('should wrap transaction when re-try', async () => {
      const executor = new TransactionExecutor()
      const expectedTx = new FakeTransaction()
      const modifiedTx = {}
      const context = { workCalls: 0 }

      await executor.execute(() => expectedTx, tx => {
        expect(tx).toEqual(modifiedTx)
        if (context.workCalls++ < 1) {
          throw newError('something on the way', 'Neo.ClientError.Security.AuthorizationExpired')
        }
        return 1
      }, tx => {
        expect(tx).toEqual(ResolvedFakeTransaction.fromFakeTransaction(expectedTx))
        return modifiedTx
      })

      expect(context.workCalls).toEqual(2)
    })

    ;[
      [0, executor => executor],
      [3, executor => {
        executor.telemetryApi = 3
        return executor
      }]
    ].forEach(([telemetryApi, applyChangesToExecutor]) => {
      describe(`telemetry when api is ${telemetryApi}`, () => {
        let executor

        beforeEach(() => {
          const executorAndFakeSetTimeout = createTransactionExecutorWithFakeTimeout()
          executor = applyChangesToExecutor(executorAndFakeSetTimeout.executor)
        })

        it(`should create transaction with telemetryApi equals to ${telemetryApi}`, async () => {
          const tx = new FakeTransaction()
          const transactionCreator = spyOnFunction(({ onTelemetrySuccess }) => {
            onTelemetrySuccess()
            return tx
          })

          await executor.execute(transactionCreator, async (x) => 1)

          expect(transactionCreator.calls.length).toBe(1)
          expect(transactionCreator.calls[0][0].api).toBe(telemetryApi)
        })

        it('should not send metric on the retry when metrics sent with success', async () => {
          const transactions = [
            new FakeTransaction(undefined, undefined, TRANSIENT_ERROR_1),
            new FakeTransaction()
          ]

          const transactionCreator = spyOnFunction(({ onTelemetrySuccess } = {}) => {
            if (onTelemetrySuccess) {
              onTelemetrySuccess()
            }
            return transactions.shift()
          })

          await executor.execute(transactionCreator, async (x) => 1)

          expect(transactionCreator.calls.length).toBe(2)
          expect(transactionCreator.calls[0][0].api).toBe(telemetryApi)
          expect(transactionCreator.calls[1][0]).toBe(undefined)
        })

        it('should send metrics on the retry when metrics sent without success', async () => {
          const transactions = [
            new FakeTransaction(undefined, undefined, TRANSIENT_ERROR_1),
            new FakeTransaction()
          ]

          const transactionCreator = spyOnFunction(({ onTelemetrySuccess }) => {
            if (transactions.length === 1) {
              onTelemetrySuccess()
            }
            return transactions.shift()
          })

          await executor.execute(transactionCreator, async (x) => 1)

          expect(transactionCreator.calls.length).toBe(2)
          expect(transactionCreator.calls[0][0].api).toBe(telemetryApi)
          expect(transactionCreator.calls[1][0].api).toBe(telemetryApi)
        })

        it('should isolate execution context', async () => {
          const tx = new FakeTransaction()
          const transactionCreator = spyOnFunction(({ onTelemetrySuccess }) => {
            onTelemetrySuccess()
            return tx
          })

          await executor.execute(transactionCreator, async (x) => 1)
          await executor.execute(transactionCreator, async (x) => 1)

          expect(transactionCreator.calls.length).toBe(2)
          expect(transactionCreator.calls[0][0].api).toBe(telemetryApi)
          expect(transactionCreator.calls[1][0].api).toBe(telemetryApi)
        })

        afterEach(async () => {
          await executor.close()
        })

        function spyOnFunction (fun) {
          const context = {
            calls: []
          }
          function myFunction (...args) {
            context.calls.push(args)
            return fun(...args)
          }

          return Object.defineProperty(myFunction, 'calls', { get: () => context.calls })
        }
      })
    })

    async function testRetryWhenTransactionCreatorFails (errorCodes) {
      const { fakeSetTimeout, executor } = createTransactionExecutorWithFakeTimeout()
      executor.pipelineBegin = pipelineBegin
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
    }

    async function testRetryWhenTransactionBeginFails (errorCodes) {
      const { fakeSetTimeout, executor } = createTransactionExecutorWithFakeTimeout()
      executor.pipelineBegin = pipelineBegin
      const transactionCreator = throwingTransactionCreatorOnBegin(
        errorCodes,
        new FakeTransaction()
      )
      const usedTransactions = []
      const beginTransactions = []

      const result = await executor.execute(transactionCreator, async tx => {
        expect(tx).toBeDefined()
        beginTransactions.push(tx)

        if (pipelineBegin) {
          // forcing await for tx since pipeline doesn't wait for begin return
          await tx
        }

        usedTransactions.push(tx)
        return Promise.resolve(42)
      })

      expect(beginTransactions.length).toEqual(pipelineBegin ? errorCodes.length + 1 : 1)
      expect(usedTransactions.length).toEqual(1)
      expect(result).toEqual(42)
      verifyRetryDelays(fakeSetTimeout, errorCodes.length)
    }

    async function testRetryWhenTransactionWorkReturnsRejectedPromise (
      errorCodes
    ) {
      const { fakeSetTimeout, executor } = createTransactionExecutorWithFakeTimeout()
      executor.pipelineBegin = pipelineBegin
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
    }

    async function testRetryWhenTransactionCommitReturnsRejectedPromise (
      errorCodes
    ) {
      const { fakeSetTimeout, executor } = createTransactionExecutorWithFakeTimeout()
      executor.pipelineBegin = pipelineBegin
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
    }

    async function testRetryWhenTransactionWorkThrows (errorCodes) {
      const { fakeSetTimeout, executor } = createTransactionExecutorWithFakeTimeout()
      executor.pipelineBegin = pipelineBegin
      const usedTransactions = []
      const realWork = throwingTransactionWork(errorCodes, 42)

      const result = await executor.execute(transactionCreator(), async tx => {
        expect(tx).toBeDefined()
        usedTransactions.push(tx)
        if (pipelineBegin) {
          await tx
        }
        return realWork()
      })

      // work should have failed 'failures.length' times and succeeded 1 time
      expect(usedTransactions.length).toEqual(errorCodes.length + 1)
      expectAllTransactionsToBeClosed(usedTransactions)
      expect(result).toEqual(42)
      verifyRetryDelays(fakeSetTimeout, errorCodes.length)
    }

    async function testRetryWhenTransactionWorkThrowsAndRollbackFails (
      txWorkErrorCodes,
      rollbackErrorCodes
    ) {
      const { fakeSetTimeout, executor } = createTransactionExecutorWithFakeTimeout()
      executor.pipelineBegin = pipelineBegin
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
    }
  })
})

function createTransactionExecutorWithFakeTimeout (...args) {
  const fakeSetTimeout = new TimeoutsMock()
  const dependencies = {
    setTimeout: fakeSetTimeout.setTimeout,
    clearTimeout: fakeSetTimeout.clearTimeout
  }

  if (typeof args[4] === 'object' || args[4] === undefined) {
    args[4] = { ...dependencies, ...args[4] }
  } else {
    throw new TypeError(
      `Expected object or undefined as args[4] but got ${typeof args[4]}`)
  }

  return {
    executor: new TransactionExecutor(...args),
    fakeSetTimeout
  }
}

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

function throwingTransactionCreatorOnBegin (errorCodes, result) {
  const remainingErrorCodes = errorCodes.slice().reverse()
  return () => {
    return new FakeTransaction(undefined, undefined, remainingErrorCodes.pop())
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
  constructor (commitErrorCode, rollbackErrorCode, beginErrorCode) {
    this._commitErrorCode = commitErrorCode
    this._rollbackErrorCode = rollbackErrorCode
    this._beginErrorCode = beginErrorCode
    this._open = true
  }

  then (onfulfilled, onrejected) {
    if (this._beginErrorCode) {
      return Promise.reject(error(this._beginErrorCode)).catch(onrejected)
    }
    return Promise.resolve(ResolvedFakeTransaction.fromFakeTransaction(this)).then(onfulfilled)
  }

  catch (onRejected) {
    return this.then(null, onRejected)
  }

  finally (onfinally) {
    return this.then().finally(onfinally)
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

class ResolvedFakeTransaction {
  static fromFakeTransaction (fake) {
    const tx = new ResolvedFakeTransaction()
    tx._commitErrorCode = fake._commitErrorCode
    tx._rollbackErrorCode = fake._rollbackErrorCode
    tx._open = fake._open
    return tx
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
