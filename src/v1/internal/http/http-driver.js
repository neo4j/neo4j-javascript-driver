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

import Driver from '../../driver'
import HttpSession from './http-session'
import HttpSessionTracker from './http-session-tracker'
import ServerAddress from '../server-address'

export default class HttpDriver extends Driver {
  constructor (url, userAgent, token, config) {
    super(ServerAddress.fromUrl(url.hostAndPort), userAgent, token, config)
    this._url = url
    this._sessionTracker = new HttpSessionTracker()
  }

  session () {
    return new HttpSession(
      this._url,
      this._authToken,
      this._config,
      this._sessionTracker
    )
  }

  close () {
    return this._sessionTracker.close()
  }
}
