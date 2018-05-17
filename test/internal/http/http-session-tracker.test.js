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
import sharedNeo4j from '../../internal/shared-neo4j';
import HttpSession from '../../../src/v1/internal/http/http-session';
import urlUtil from '../../../src/v1/internal/url-util';
import HttpSessionTracker from '../../../src/v1/internal/http/http-session-tracker';

describe('http session tracker', () => {

  it('should close open sessions', done => {
    const tracker = new HttpSessionTracker();

    const session1 = new FakeHttpSession(tracker);
    const session2 = new FakeHttpSession(tracker);
    const session3 = new FakeHttpSession(tracker);

    tracker.sessionOpened(session1);
    tracker.sessionOpened(session2);
    tracker.sessionOpened(session3);

    tracker.close().then(() => {
      expect(session1.timesClosed).toEqual(1);
      expect(session2.timesClosed).toEqual(1);
      expect(session3.timesClosed).toEqual(1);
      done();
    });
  });

  it('should not close closed sessions', done => {
    const tracker = new HttpSessionTracker();

    const session1 = new FakeHttpSession(tracker);
    const session2 = new FakeHttpSession(tracker);
    const session3 = new FakeHttpSession(tracker);
    const session4 = new FakeHttpSession(tracker);

    tracker.sessionOpened(session1);
    tracker.sessionOpened(session2);
    tracker.sessionOpened(session3);
    tracker.sessionOpened(session4);

    tracker.sessionClosed(session2);
    tracker.sessionClosed(session4);

    tracker.close().then(() => {
      expect(session1.timesClosed).toEqual(1);
      expect(session2.timesClosed).toEqual(0);
      expect(session3.timesClosed).toEqual(1);
      expect(session4.timesClosed).toEqual(0);
      done();
    });
  });

});

class FakeHttpSession extends HttpSession {

  constructor(sessionTracker) {
    super(urlUtil.parseDatabaseUrl('http://localhost:7474'), sharedNeo4j.authToken, {}, sessionTracker);
    this.timesClosed = 0;
  }

  close(callback) {
    this.timesClosed++;
    callback();
  }
}
