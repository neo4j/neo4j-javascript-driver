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

/**
 * This class is like a mock of {@link Connection} that tracks invocations count.
 * It tries to maintain same "interface" as {@link Connection}.
 * It could be replaced with a proper mock by a library like testdouble.
 * At the time of writing such libraries require {@link Proxy} support but browser tests execute in
 * PhantomJS which does not support proxies.
 */
export default class FakeConnection {

  constructor() {
    this.resetInvoked = 0;
    this.resetAsyncInvoked = 0;
    this.syncInvoked = 0;
    this.releaseInvoked = 0;
  }

  run() {
  }

  discardAll() {
  }

  reset() {
    this.resetInvoked++;
  }

  resetAsync() {
    this.resetAsyncInvoked++;
  }

  sync() {
    this.syncInvoked++;
  }

  _release() {
    this.releaseInvoked++;
  }

  isReleasedOnceOnSessionClose() {
    return this.isReleasedOnSessionCloseTimes(1);
  }

  isReleasedOnSessionCloseTimes(times) {
    return this.resetAsyncInvoked === times &&
      this.resetInvoked === 0 &&
      this.syncInvoked === times &&
      this.releaseInvoked === times;
  }

  isNeverReleased() {
    return this.isReleasedTimes(0);
  }

  isReleasedOnce() {
    return this.isReleasedTimes(1);
  }

  isReleasedTimes(times) {
    return this.resetAsyncInvoked === 0 &&
      this.resetInvoked === times &&
      this.syncInvoked === times &&
      this.releaseInvoked === times;
  }
};
