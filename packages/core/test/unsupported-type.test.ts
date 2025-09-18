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

import { UnsupportedType } from '../src'

describe('UnsupportedType', () => {
  it.each([
    ['with message', ['QuantumInteger', 76, 87, 'Quantum computing is from the future.'], '76.87', 'UnsupportedType<QuantumInteger>'],
    ['without message', ['CuniformInteger', 1, 1], '1.1', 'UnsupportedType<CuniformInteger>']
  ])('should create UnsupportedType (%s)', (_, parameters: [string, number, number, string], protocolString, representation) => {
    const unsupportedType = new UnsupportedType(...parameters)
    expect(unsupportedType.minimumProtocolVersion()).toBe(protocolString)
    expect(unsupportedType.toString()).toBe(representation)
    expect(unsupportedType.message).toBe(parameters[3])
  })
})
