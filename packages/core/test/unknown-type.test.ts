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

import { UnknownType } from '../src'

describe('UnknownTppe', () => {
  it.each([
    ['with message', ['QuantumInteger', 76, 87, 'Quantum computing is from the future.'], '76.87', 'UnknownType<QuantumInteger>'],
    ['without message', ['CuniformInteger', 1, 1], '1.1', 'UnknownType<CuniformInteger>']
  ])('should create UnknownType (%s)', (_, parameters: [string, number, number, string], protocolString, representation) => {
    const unknownType = new UnknownType(...parameters)
    expect(unknownType.minimumProtocolVersion()).toBe(protocolString)
    expect(unknownType.toString()).toBe(representation)
    expect(unknownType.message).toBe(parameters[3])
  })
})
