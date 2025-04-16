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

import { RecordObjectMapping } from '../src'

describe('#unit getCaseTranslator', () => {
  // Each convention has "tokenize" and "encode" functions, so testing each twice is sufficient.
  it('camelCase to SCREAMING_SNAKE_CASE', () => {
    expect(RecordObjectMapping.getCaseTranslator(RecordObjectMapping.StandardCase.CamelCase, 'SCREAMING_SNAKE_CASE')('I_AM_COOL')).toBe('iAmCool')
  })
  it('SCREAMING_SNAKE_CASE to PascalCase', () => {
    expect(RecordObjectMapping.getCaseTranslator(RecordObjectMapping.StandardCase.ScreamingSnakeCase, 'PascalCase')('IAmCool')).toBe('I_AM_COOL')
  })
  it('PascalCase to snake_case', () => {
    expect(RecordObjectMapping.getCaseTranslator(RecordObjectMapping.StandardCase.PascalCase, 'snake_case')('i_am_cool')).toBe('IAmCool')
  })
  it('snake_case to kebab-case', () => {
    expect(RecordObjectMapping.getCaseTranslator(RecordObjectMapping.StandardCase.SnakeCase, 'kebab-case')('i-am-cool')).toBe('i_am_cool')
  })
  it('kebab-case to camelCase', () => {
    expect(RecordObjectMapping.getCaseTranslator(RecordObjectMapping.StandardCase.KebabCase, 'camelCase')('iAmCool')).toBe('i-am-cool')
  })
})
