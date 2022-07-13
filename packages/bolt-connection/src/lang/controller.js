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

/**
 * The cancel operation error
 */
export class OperationCanceledError extends Error {
  constructor () {
    super()
    this.name = OperationCanceledError.name
  }
}

/**
 * The CancelationToken used by `runWithTimeout` for cancel an working job.
 */
export class CancelationToken {
  constructor (getCancelationRequested) {
    this._getCancelationRequested = getCancelationRequested
    Object.freeze(this)
  }

  /**
   * If it receive a cancelation request
   */
  get isCancelationRequested () {
    return this._getCancelationRequested()
  }

  /**
   * Combine two cancelations token in one.
   *
   * The new cancelation token will be canceled if one of the
   * token get canceled.
   *
   * @param {CancelationToken} cancelationToken The other cancelation token
   * @returns {CancelationToken} Combined cancelation toke
   */
  combine (cancelationToken) {
    return new CancelationToken(() =>
      this.isCancelationRequested === true || cancelationToken.isCancelationRequested === true)
  }

  /**
   *
   * @param {Error} [error] the error to be thrown. Be default: OperationCanceledError will be thrown
   * @throws {OperationCanceledError|Error} if a cancelation request was done
   * @returns {void}
   */
  throwIfCancellationRequested (error) {
    if (this.isCancelationRequested) {
      if (error != null) {
        throw error
      }
      throw new OperationCanceledError()
    }
  }
}

/**
 * @typedef {Object} Job
 * @property {function(any, CancelationToken)} run method called for run the job
 * @property {function(any)} [onTimeout] method called after job finished and the controller has timeout.
 *                Useful for cleanups.
 */
/**
 * @param {any} param0
 * @param {number} param0.timeout The timeout time
 * @param {Error} param0.reason The reason for the timeout
 * @param  {...Job} jobs The jobs to be run in sequence
 * @returns {Promise} The result of all the jobs or a timeout failure
 */
export function runWithTimeout ({ timeout, reason }, ...jobs) {
  const status = { timedout: false }
  const cancelationToken = new CancelationToken(() => status.timedout)
  async function _run (currentValue, { resolve, reject }, myJobs) {
    const [{ run, onTimeout = () => Promise.resolve() }, ...otherJobs] = myJobs
    try {
      const value = await run(currentValue, cancelationToken)
      if (status.timedout) {
        await onTimeout(value).catch(() => {})
      } else if (otherJobs.length === 0) {
        resolve(value)
      } else {
        await _run(value, { resolve, reject }, otherJobs)
      }
    } catch (e) {
      if (!status.timedout) {
        reject(e)
      }
    }
  }

  return new Promise((resolve, reject) => {
    if (timeout != null) {
      status.timeoutHandle = setTimeout(() => {
        status.timedout = true
        reject(reason())
      }, timeout)
    }

    _run(undefined, { resolve, reject }, jobs)
      .finally(() => {
        if (status.timeoutHandle != null) {
          clearTimeout(status.timeoutHandle)
        }
      })
  })
}
