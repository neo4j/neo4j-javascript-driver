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

import { TypeTransformer } from '../../src/bolt/transformer.js'

describe('TypeTransformer', () => {
  const defaultSignature = 123
  const defaultFromStructure = (struct) => struct
  const defaultToStructure = (obj) => obj
  const defaultIsTypeInstance = () => true
  const createDefaultTransformer = () => {
    return new TypeTransformer({
      signature: defaultSignature,
      isTypeInstance: defaultIsTypeInstance,
      fromStructure: defaultFromStructure,
      toStructure: defaultToStructure
    })
  }

  describe('constructor', () => {
    it('should create the complete object', () => {
      const typeTransformer = createDefaultTransformer()

      expect(typeTransformer.signature).toBe(defaultSignature)
      expect(typeTransformer.isTypeInstance).toBe(defaultIsTypeInstance)
      expect(typeTransformer.fromStructure).toBe(defaultFromStructure)
      expect(typeTransformer.toStructure).toBe(defaultToStructure)
    })
  })

  describe('.extendsWith()', () => {
    it('should override signature and keep rest of param intact', () => {
      const expectedSignature = 124

      const typeTransformer = createDefaultTransformer()

      const extended = typeTransformer.extendsWith({ signature: expectedSignature })

      expect(extended.signature).toBe(expectedSignature)
      expect(extended.isTypeInstance).toBe(typeTransformer.isTypeInstance)
      expect(extended.fromStructure).toBe(typeTransformer.fromStructure)
      expect(extended.toStructure).toBe(typeTransformer.toStructure)
    })

    it('should override isTypeInstance and keep rest of param intact', () => {
      const expectedIsTypeInstance = () => false

      const typeTransformer = createDefaultTransformer()

      const extended = typeTransformer.extendsWith({ isTypeInstance: expectedIsTypeInstance })

      expect(extended.isTypeInstance).toBe(expectedIsTypeInstance)
      expect(extended.signature).toEqual(typeTransformer.signature)
      expect(extended.fromStructure).toBe(typeTransformer.fromStructure)
      expect(extended.toStructure).toBe(typeTransformer.toStructure)
    })

    it('should override fromStructure and keep rest of param intact', () => {
      const expectedFromStructure = () => false

      const typeTransformer = createDefaultTransformer()

      const extended = typeTransformer.extendsWith({ fromStructure: expectedFromStructure })

      expect(extended.fromStructure).toBe(expectedFromStructure)
      expect(extended.signature).toEqual(typeTransformer.signature)
      expect(extended.isTypeInstance).toBe(typeTransformer.isTypeInstance)
      expect(extended.toStructure).toBe(typeTransformer.toStructure)
    })

    it('should override toStructure and keep rest of param intact', () => {
      const expectedToStructure = () => false

      const typeTransformer = createDefaultTransformer()

      const extended = typeTransformer.extendsWith({ toStructure: expectedToStructure })

      expect(extended.toStructure).toBe(expectedToStructure)
      expect(extended.signature).toEqual(typeTransformer.signature)
      expect(extended.fromStructure).toBe(typeTransformer.fromStructure)
      expect(extended.isTypeInstance).toBe(typeTransformer.isTypeInstance)
    })
  })
})
