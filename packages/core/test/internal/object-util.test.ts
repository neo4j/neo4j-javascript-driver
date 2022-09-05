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
import { newError } from '../../src'
import {
  createBrokenObject,
  isBrokenObject,
  getBrokenObjectReason
} from '../../src/internal/object-util'

describe('isBrokenObject', () => {
  it('should return true when object created with createBrokenObject', () => {
    const object = createBrokenObject(newError('error'), {})

    expect(isBrokenObject(object)).toBe(true)
  })

  it('should return false for regular objects', () => {
    const object = {}

    expect(isBrokenObject(object)).toBe(false)
  })

  it('should return false for non-objects', () => {
    expect(isBrokenObject(null)).toBe(false)
    expect(isBrokenObject(undefined)).toBe(false)
    expect(isBrokenObject(1)).toBe(false)
    expect(isBrokenObject(() => {})).toBe(false)
    expect(isBrokenObject('string')).toBe(false)
  })
})

describe('getBrokenObjectReason', () => {
  it('should return the reason the object is broken', () => {
    const reason = newError('error')
    const object = createBrokenObject(reason, {})

    expect(getBrokenObjectReason(object)).toBe(reason)
  })
})

describe('createBrokenObject', () => {
  describe('toJSON', () => {
    it('should return undefined', () => {
      const reason = newError('error')
      const object = createBrokenObject(reason, {})

      // @ts-expect-error
      expect(object.toJSON).toBeUndefined()
    })
  })
})
