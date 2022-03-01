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

 import { int, Integer } from 'neo4j-driver-core'
 import { alloc } from '../../src/channel'
 import { Packer, Unpacker } from '../../src/packstream/packstream-v3'
 import { Structure } from '../../src/packstream/packstream-v1'
 import { Node, int, Relationship } from 'neo4j-driver-core'
 
 describe('#unit PackStreamV3', () => {
   it('should pack integers with small numbers', () => {
     let n, i
     // test small numbers
     for (n = -999; n <= 999; n += 1) {
       i = int(n)
       expect(packAndUnpack(i).toString()).toBe(i.toString())
       expect(
         packAndUnpack(i, { disableLosslessIntegers: true }).toString()
       ).toBe(i.toString())
       expect(packAndUnpack(i, { useBigInt: true }).toString()).toBe(
         i.toString()
       )
     }
   })
 
   it('should pack integers with small numbers created with Integer', () => {
     let n, i
     // test small numbers
     for (n = -10; n <= 10; n += 1) {
       i = new Integer(n, 0)
       expect(packAndUnpack(i).toString()).toBe(i.toString())
       expect(
         packAndUnpack(i, { disableLosslessIntegers: true }).toString()
       ).toBe(i.toString())
       expect(packAndUnpack(i, { useBigInt: true }).toString()).toBe(
         i.toString()
       )
     }
   })
 
   it('should pack integers with positive numbers', () => {
     let n, i
     // positive numbers
     for (n = 16; n <= 16; n += 1) {
       i = int(Math.pow(2, n))
       expect(packAndUnpack(i).toString()).toBe(i.toString())
 
       const unpackedLossyInteger = packAndUnpack(i, {
         disableLosslessIntegers: true
       })
       expect(typeof unpackedLossyInteger).toBe('number')
       expect(unpackedLossyInteger.toString()).toBe(
         i.inSafeRange() ? i.toString() : 'Infinity'
       )
 
       const bigint = packAndUnpack(i, { useBigInt: true })
       expect(typeof bigint).toBe('bigint')
       expect(bigint.toString()).toBe(i.toString())
     }
   })
 
   it('should pack integer with negative numbers', () => {
     let n, i
     // negative numbers
     for (n = 0; n <= 63; n += 1) {
       i = int(-Math.pow(2, n))
       expect(packAndUnpack(i).toString()).toBe(i.toString())
 
       const unpackedLossyInteger = packAndUnpack(i, {
         disableLosslessIntegers: true
       })
       expect(typeof unpackedLossyInteger).toBe('number')
       expect(unpackedLossyInteger.toString()).toBe(
         i.inSafeRange() ? i.toString() : '-Infinity'
       )
 
       const bigint = packAndUnpack(i, { useBigInt: true })
       expect(typeof bigint).toBe('bigint')
       expect(bigint.toString()).toBe(i.toString())
     }
   })
 
   it('should pack BigInt with small numbers', () => {
     let n, i
     // test small numbers
     for (n = -999; n <= 999; n += 1) {
       i = BigInt(n)
       expect(packAndUnpack(i).toString()).toBe(i.toString())
       expect(
         packAndUnpack(i, { disableLosslessIntegers: true }).toString()
       ).toBe(i.toString())
       expect(packAndUnpack(i, { useBigInt: true }).toString()).toBe(
         i.toString()
       )
     }
   })
 
   it('should pack BigInt with positive numbers', () => {
     let n, i
     // positive numbers
     for (n = 16; n <= 16; n += 1) {
       i = BigInt(Math.pow(2, n))
       expect(packAndUnpack(i).toString()).toBe(i.toString())
 
       const unpackedLossyInteger = packAndUnpack(i, {
         disableLosslessIntegers: true
       })
       expect(typeof unpackedLossyInteger).toBe('number')
       expect(unpackedLossyInteger.toString()).toBe(
         int(i).inSafeRange() ? i.toString() : 'Infinity'
       )
 
       const bigint = packAndUnpack(i, { useBigInt: true })
       expect(typeof bigint).toBe('bigint')
       expect(bigint.toString()).toBe(i.toString())
     }
   })
 
   it('should pack BigInt with negative numbers', () => {
     let n, i
     // negative numbers
     for (n = 0; n <= 63; n += 1) {
       i = BigInt(-Math.pow(2, n))
       expect(packAndUnpack(i).toString()).toBe(i.toString())
 
       const unpackedLossyInteger = packAndUnpack(i, {
         disableLosslessIntegers: true
       })
       expect(typeof unpackedLossyInteger).toBe('number')
       expect(unpackedLossyInteger.toString()).toBe(
         int(i).inSafeRange() ? i.toString() : '-Infinity'
       )
 
       const bigint = packAndUnpack(i, { useBigInt: true })
       expect(typeof bigint).toBe('bigint')
       expect(bigint.toString()).toBe(i.toString())
     }
   })
 
   it('should pack strings', () => {
     expect(packAndUnpack('')).toBe('')
     expect(packAndUnpack('abcdefg123567')).toBe('abcdefg123567')
     const str = Array(65536 + 1).join('a') // 2 ^ 16 + 1
     expect(packAndUnpack(str, { bufferSize: str.length + 8 })).toBe(str)
   })
 
   it('should pack structures', () => {
     expect(packAndUnpack(new Structure(1, ['Hello, world!!!'])).fields[0]).toBe(
       'Hello, world!!!'
     )
   })
 
   it('should pack lists', () => {
     const list = ['a', 'b']
     const unpacked = packAndUnpack(list)
     expect(unpacked[0]).toBe(list[0])
     expect(unpacked[1]).toBe(list[1])
   })
 
   it('should pack long lists', () => {
     const listLength = 256
     const list = []
     for (let i = 0; i < listLength; i++) {
       list.push(null)
     }
     const unpacked = packAndUnpack(list, { bufferSize: 1400 })
     expect(unpacked[0]).toBe(list[0])
     expect(unpacked[1]).toBe(list[1])
   })

   it.each(
     validNodesAndConfig()
   )('should unpack Nodes', (struct, expectedNode, config) => {
     const node = packAndUnpack(struct, config)

     expect(node).toEqual(expectedNode)
   })

   it.each(
     invalidNodesConfig()
   )('should thrown error for unpacking invalid Nodes', (struct) => {
      expect(() => packAndUnpack(struct)).toThrow()
   })

   it.each(
    validRelationshipsAndConfig()
  )('should unpack Relationships', (struct, expectedRelationship, config) => {
    const releationship = packAndUnpack(struct, config)

    expect(releationship).toEqual(expectedRelationship)
  })

  it.each(
    invalidRelationshipsConfig()
  )('should thrown error for unpacking invalid Relationships', (struct) => {
     expect(() => packAndUnpack(struct)).toThrow()
  })

   function validNodesAndConfig () {
     function validWithNumber () {
       const identity = 1
       const labels = ['a', 'b']
       const properties = { 'a': 1, 'b': 2 }
       const elementId = 'element_id_1'
       const expectedNode = new Node(identity, labels, properties, elementId)
       const nodeStruct = new Structure(0x4e, [
         identity, labels, properties, elementId
       ])
       return [nodeStruct, expectedNode, { disableLosslessIntegers: true, useBigInt: false }]
     }

     function validWithInt () {
       const identity = int(1)
       const labels = ['a', 'b']
       const properties = { 'a': int(1), 'b': int(2) }
       const elementId = 'element_id_1'
       const expectedNode = new Node(identity, labels, properties, elementId)
       const nodeStruct = new Structure(0x4e, [
         identity, labels, properties, elementId
       ])
       return [nodeStruct, expectedNode, { disableLosslessIntegers: false, useBigInt: false }]
     }

     function validWithBigInt () {
       const identity = BigInt(1)
       const labels = ['a', 'b']
       const properties = { 'a': BigInt(1), 'b': BigInt(2) }
       const elementId = 'element_id_1'
       const expectedNode = new Node(identity, labels, properties, elementId)
       const nodeStruct = new Structure(0x4e, [
         identity, labels, properties, elementId
       ])
       return [nodeStruct, expectedNode, { disableLosslessIntegers: false, useBigInt: true }]
     }

     return [
       validWithNumber(),
       validWithInt(),
       validWithBigInt()
     ]
   }

   function invalidNodesConfig () {
     return [
       [ new Structure(0x4e, [1, ['a', 'b'], { 'a': 1, 'b': 2 }]) ],
       [ new Structure(0x4e, [1, ['a', 'b'], { 'a': 1, 'b': 2 }, 'elementId', 'myId']) ],
     ]
   }

   function validRelationshipsAndConfig () {
    function validWithNumber () {
      const identity = 1
      const start = 2
      const end = 3
      const type = 'KNOWS'
      const properties = { 'a': 1, 'b': 2 }
      const elementId = 'element_id_1'
      const startNodeElementId = 'element_id_2'
      const endNodeElementId = 'element_id_3'
      const expectedRel = new Relationship(
        identity, start, end, type, properties, 
        elementId, startNodeElementId, endNodeElementId)
      const relStruct = new Structure(0x52, [
        identity, start, end, type, properties, elementId,
        startNodeElementId, endNodeElementId
      ])
      return [relStruct, expectedRel, { disableLosslessIntegers: true, useBigInt: false }]
    }

    function validWithInt () {
      const identity = int(1)
      const start = int(2)
      const end = int(3)
      const type = 'KNOWS'
      const properties = { 'a': int(1), 'b': int(2) }
      const elementId = 'element_id_1'
      const startNodeElementId = 'element_id_2'
      const endNodeElementId = 'element_id_3'
      const expectedRel = new Relationship(
        identity, start, end, type, properties, 
        elementId, startNodeElementId, endNodeElementId)
      const relStruct = new Structure(0x52, [
        identity, start, end, type, properties, elementId,
        startNodeElementId, endNodeElementId
      ])
      return [relStruct, expectedRel, { disableLosslessIntegers: false, useBigInt: false }]
    }

    function validWithBigInt () {
      const identity = BigInt(1)
      const start = BigInt(2)
      const end = BigInt(3)
      const type = 'KNOWS'
      const properties = { 'a': BigInt(1), 'b': BigInt(2) }
      const elementId = 'element_id_1'
      const startNodeElementId = 'element_id_2'
      const endNodeElementId = 'element_id_3'
      const expectedRel = new Relationship(
        identity, start, end, type, properties, 
        elementId, startNodeElementId, endNodeElementId)
      const relStruct = new Structure(0x52, [
        identity, start, end, type, properties, elementId,
        startNodeElementId, endNodeElementId
      ])
      return [relStruct, expectedRel, { disableLosslessIntegers: false, useBigInt: true }]
    }

    return [
      validWithNumber(),
      validWithInt(),
      validWithBigInt()
    ]
  }

  function invalidRelationshipsConfig () {
    return [
      [ new Structure(0x52, [1, 2, 3, 'rel', { 'a': 1, 'b': 2 }, 'elementId', 'startNodeId'])],
      [ new Structure(0x52, [1, 2, 3, 'rel', { 'a': 1, 'b': 2 }, 'elementId', 'startNodeId', 'endNodeId', 'myId'])],
    ]
  }
 })
 
 function packAndUnpack (
   val,
   { bufferSize = 128, disableLosslessIntegers = false, useBigInt = false } = {}
 ) {
   const buffer = alloc(bufferSize)
   new Packer(buffer).packable(val)()
   buffer.reset()
   return new Unpacker(disableLosslessIntegers, useBigInt).unpack(buffer)
 }
 