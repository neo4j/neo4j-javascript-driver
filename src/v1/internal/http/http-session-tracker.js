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

export default class HttpSessionTracker {

  constructor() {
    this._openSessions = new Set();
  }

  /**
   * Record given session as open.
   * @param {HttpSession} session the newly open session.
   */
  sessionOpened(session) {
    this._openSessions.add(session);
  }

  /**
   * Record given session as close.
   * @param {HttpSession} session the just closed session.
   */
  sessionClosed(session) {
    this._openSessions.delete(session);
  }

  /**
   * Close this tracker and all open sessions.
   */
  close() {
    const sessions = Array.from(this._openSessions);
    this._openSessions.clear();
    return Promise.all(sessions.map(session => closeSession(session)));
  }
}

/**
 * Close given session and get a promise back.
 * @param {HttpSession} session the session to close.
 * @return {Promise<void>} promise resolved when session is closed.
 */
function closeSession(session) {
  return new Promise(resolve => {
    session.close(() => {
      resolve();
    });
  });
}
