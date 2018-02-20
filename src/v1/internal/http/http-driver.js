/**
 * Copyright (c) 2002-2018 "Neo Technology,"
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

import Driver from '../../driver';
import HttpSession from './http-session';

export default class HttpDriver extends Driver {

  constructor(url, userAgent, token, config) {
    super(url, userAgent, token, config);
    this._sessionIdGenerator = 0;
    this._openSessions = {};
  }

  session() {
    const id = this._sessionIdGenerator;
    this._sessionIdGenerator++;
    const session = new HttpSession(this._url, this._token, this._config);
    this._openSessions[id] = session;
    return session;
  }

  close() {
    Object.keys(this._openSessions).forEach(id => {
      const session = this._openSessions[id];
      if (session) {
        session.close();
      }
      delete this._openSessions[id];
    });
  }
}
