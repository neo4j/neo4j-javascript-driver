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

export function runWithTimeout ({ timeout, reason }, ...jobs) {
  const status = { timedout: false }
  async function _run (currentValue, { resolve, reject }, myJobs) {
    const [{ run, onTimeout = () => Promise.resolve() }, ...otherJobs] = myJobs
    try {
      const value = await run(currentValue)
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
