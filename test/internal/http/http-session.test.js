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
import urlUtil from '../../../src/v1/internal/url-util';
import testUtil from '../test-utils';
import HttpSession from '../../../src/v1/internal/http/http-session';
import HttpSessionTracker from '../../../src/v1/internal/http/http-session-tracker';

describe('http session', () => {

  it('should fail for invalid query parameters', done => {
    if (testUtil.isServer()) {
      done();
      return;
    }

    const session = new HttpSession(urlUtil.parseDatabaseUrl('http://localhost:7474'), sharedNeo4j.authToken, {}, new HttpSessionTracker());

    expect(() => session.run('RETURN $value', [1, 2, 3])).toThrowError(TypeError);
    expect(() => session.run('RETURN $value', '123')).toThrowError(TypeError);
    expect(() => session.run('RETURN $value', () => [123])).toThrowError(TypeError);

    session.close(() => done());
  });

});
