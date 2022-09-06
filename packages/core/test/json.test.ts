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

import { json, newError } from '../src'
import { createBrokenObject } from '../src/internal/object-util'

describe('json', () => {
  describe('.stringify', () => {
    it('should handle objects created with createBrokenObject', () => {
      const reason = newError('some error')
      const broken = createBrokenObject(reason, { })

      expect(json.stringify(broken)).toMatchSnapshot()
    })

    it('should handle objects created with createBrokenObject in list', () => {
      const reason = newError('some error')
      const broken = createBrokenObject(reason, { })

      expect(json.stringify([broken])).toMatchSnapshot()
    })

    it('should handle objects created with createBrokenObject inside other object', () => {
      const reason = newError('some error')
      const broken = createBrokenObject(reason, { })

      expect(json.stringify({
        number: 1,
        broken
      })).toMatchSnapshot()
    })

    it('should handle BigInt', () => {
      const bigint = BigInt(42)

      expect(json.stringify(bigint)).toMatchSnapshot()
    })

    it('should handle BigInt in a list', () => {
      const bigintList = [BigInt(42), BigInt(-24)]

      expect(json.stringify(bigintList)).toMatchSnapshot()
    })

    it('should handle BigInt in a object', () => {
      const bigintInObject = {
        theResponse: BigInt(42)
      }

      expect(json.stringify(bigintInObject)).toMatchSnapshot()
    })
  })
})
