/**
 * Copyright (c) "Neo4j"
 * Neo4j Sweden AB [https://neo4j.com]
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

import neo4j from '../src'

describe('#unit RoutingDriver', () => {
  it('should fail when configured resolver is of illegal type', () => {
    expect(() =>
      neo4j.driver(
        'neo4j://localhost',
        {},
        { resolver: 'string instead of a function' }
      )
    ).toThrowError(TypeError)
    expect(() =>
      neo4j.driver('neo4j://localhost', {}, { resolver: [] })
    ).toThrowError(TypeError)
    expect(() =>
      neo4j.driver('neo4j://localhost', {}, { resolver: {} })
    ).toThrowError(TypeError)
  })
})
