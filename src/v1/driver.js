/**
 * Copyright (c) 2002-2016 "Neo Technology,"
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

import Session from './session';
import {connect} from "./internal/connector";

/**
  * A Driver instance is used for mananging {@link Session}s.
  * @access public
  */
class Driver {
  /**
   * @constructor
   * @param {string} url
   * @param {string} userAgent
   */
  constructor(url, userAgent) {
    this._url = url;
    this._userAgent = userAgent || 'neo4j-javascript/0.0';
    this._openSessions = {};
    this._sessionIdGenerator = 0;
  }

  /**
   * Create and return new session
   * @return {Session} new session.
   */
  session() {
    let sessionId = this._sessionIdGenerator++;
    let conn = connect(this._url);
    conn.initialize(this._userAgent);

    let _driver = this;
    let _session = new Session( conn, () => {
      // On close of session, remove it from the list of open sessions
      delete _driver._openSessions[sessionId];
    });

    this._openSessions[sessionId] = _session;
    return _session;
  }

  /**
   * Close sessions connections
   * @return
   */
  close() {
    for (let sessionId in this._openSessions) {
      if (this._openSessions.hasOwnProperty(sessionId)) {
        this._openSessions[sessionId].close();
      }
    }
  }
}

export default Driver
