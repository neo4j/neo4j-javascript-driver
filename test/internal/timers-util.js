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
class SetTimeoutMock {

  constructor() {
    this._clearState();
  }

  install() {
    this._originalSetTimeout = global.setTimeout;
    global.setTimeout = (code, delay) => {
      if (!this._paused) {
        code();
        this.invocationDelays.push(delay);
      }
      return this._timeoutIdCounter++;
    };

    this._originalClearTimeout = global.clearTimeout;
    global.clearTimeout = id => {
      this.clearedTimeouts.push(id);
    };

    return this;
  }

  pause() {
    this._paused = true;
  }

  uninstall() {
    global.setTimeout = this._originalSetTimeout;
    global.clearTimeout = this._originalClearTimeout;
    this._clearState();
  }

  setTimeoutOriginal(code, delay) {
    return this._originalSetTimeout.call(null, code, delay);
  }

  _clearState() {
    this._originalSetTimeout = null;
    this._originalClearTimeout = null;
    this._paused = false;
    this._timeoutIdCounter = 0;

    this.invocationDelays = [];
    this.clearedTimeouts = [];
  }
}

export const setTimeoutMock = new SetTimeoutMock();
