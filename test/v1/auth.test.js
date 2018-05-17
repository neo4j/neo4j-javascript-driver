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

import neo4j from '../../src/v1';

describe('auth', () => {

  it('should use correct username and password in basic auth', () => {
    const token = neo4j.auth.basic('cat', 'dog');
    expect(token).toEqual({
      scheme: 'basic',
      principal: 'cat',
      credentials: 'dog'
    });
  });

  it('should support realm in basic auth', () => {
    const token = neo4j.auth.basic('cat', 'dog', 'apartment');
    expect(token).toEqual({
      scheme: 'basic',
      principal: 'cat',
      credentials: 'dog',
      realm: 'apartment'
    });
  });

  it('should use correct ticket in kerberos', () => {
    const token = neo4j.auth.kerberos('my-ticket');
    expect(token).toEqual({
      scheme: 'kerberos',
      principal: '',
      credentials: 'my-ticket'
    });
  });

  it('should construct correct custom auth', () => {
    const token = neo4j.auth.custom('cat', 'dog', 'apartment', 'pets');
    expect(token).toEqual({
      scheme: 'pets',
      principal: 'cat',
      credentials: 'dog',
      realm: 'apartment'
    });
  });

  it('should support parameters in custom auth', () => {
    const token = neo4j.auth.custom('cat', 'dog', 'apartment', 'pets', {key1: 'value1', key2: 42});
    expect(token).toEqual({
      scheme: 'pets',
      principal: 'cat',
      credentials: 'dog',
      realm: 'apartment',
      parameters: {key1: 'value1', key2: 42}
    });
  });

});
