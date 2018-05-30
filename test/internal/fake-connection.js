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

/**
 * This class is like a mock of {@link Connection} that tracks invocations count.
 * It tries to maintain same "interface" as {@link Connection}.
 * It could be replaced with a proper mock by a library like testdouble.
 * At the time of writing such libraries require {@link Proxy} support but browser tests execute in
 * PhantomJS which does not support proxies.
 */
export default class FakeConnection {

  constructor() {
    this._open = true;
    this.creationTimestamp = Date.now();

    this.resetInvoked = 0;
    this.syncInvoked = 0;
    this.releaseInvoked = 0;
    this.initializationInvoked = 0;
    this.seenStatements = [];
    this.seenParameters = [];
    this.server = {};

    this._initializationPromise = Promise.resolve(this);
  }

  run(statement, parameters) {
    this.seenStatements.push(statement);
    this.seenParameters.push(parameters);
  }

  discardAll() {
  }

  reset() {
    this.resetInvoked++;
  }

  resetAndFlush() {
    this.resetInvoked++;
    return Promise.resolve();
  }

  sync() {
    this.syncInvoked++;
  }

  _release() {
    this.releaseInvoked++;
  }

  initializationCompleted() {
    this.initializationInvoked++;
    return this._initializationPromise;
  }

  isOpen() {
    return this._open;
  }

  isNeverReleased() {
    return this.isReleasedTimes(0);
  }

  isReleasedOnce() {
    return this.isReleasedTimes(1);
  }

  isReleasedTimes(times) {
    return this.resetInvoked === times && this.releaseInvoked === times;
  }

  withServerVersion(version) {
    this.server.version = version;
    return this;
  }

  withFailedInitialization(error) {
    this._initializationPromise = Promise.reject(error);
    return this;
  }

  withCreationTimestamp(value) {
    this.creationTimestamp = value;
    return this;
  }

  closed() {
    this._open = false;
    return this;
  }
};
