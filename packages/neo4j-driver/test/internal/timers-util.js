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
 * This is a liter mock which only creates mocked functions to work
 * as timeouts.
 */
class TimeoutsMock {
  constructor () {
    this.clearState()
    // bind it to be used as standalone functions
    this.setTimeout = this.setTimeout.bind(this)
    this.clearTimeout = this.clearTimeout.bind(this)
  }

  setTimeout (code, delay) {
    if (!this._paused) {
      code()
      this.invocationDelays.push(delay)
    }
    return this._timeoutIdCounter++
  }

  clearTimeout (id) {
    this.clearedTimeouts.push(id)
  }

  pause () {
    this._paused = true
  }

  clearState () {
    this._paused = false
    this._timeoutIdCounter = 0

    this.invocationDelays = []
    this.clearedTimeouts = []
  }
}

export {
  TimeoutsMock
}
