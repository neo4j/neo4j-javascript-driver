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

import v5x8 from './bolt-protocol-v5x8.transformer.js'
import { TypeTransformer } from './transformer.js'
import { structure } from '../packstream/index.js'
import { Vector, newError } from '../../core/index.ts'
const VECTOR = 0x56
const FLOAT_32 = 0xc6
const FLOAT_64 = 0xc1
const INT_8 = 0xc8
const INT_16 = 0xc9
const INT_32 = 0xca
const INT_64 = 0xcb

function createVectorTransformer () {
  return new TypeTransformer({
    signature: VECTOR,
    isTypeInstance: object => object instanceof Vector,
    toStructure: vector => {
      const startTime = new Date().getTime()
      const dataview = new DataView(vector.typedArray.byteLength)
      let set
      let typeMarker
      if (vector.type === 'INT8') {
        typeMarker = Uint8Array.from([INT_8])
        set = dataview.setUint8
      } else if (vector.type === 'INT16') {
        typeMarker = Uint8Array.from([INT_16])
        set = dataview.setUint16
      } else if (vector.type === 'INT32') {
        typeMarker = Uint8Array.from([INT_32])
        set = dataview.setUint32
      } else if (vector.type === 'INT64') {
        typeMarker = Uint8Array.from([INT_64])
        set = dataview.setUint64
      } else if (vector.type === 'FLOAT32') {
        typeMarker = Uint8Array.from([FLOAT_32])
        set = dataview.setFloat32
      } else if (vector.type === 'FLOAT64') {
        typeMarker = Uint8Array.from([FLOAT_64])
        set = dataview.setFloat64
      } else {
        throw newError('Vector is of unsupported type')
      }
      for (let i = 0; i < vector.typedArray.length; i++) {
        set(i * vector.typedArray.BYTES_PER_ELEMENT, vector.typedArray[i])
      }
      const struct = new structure.Structure(VECTOR, [typeMarker, Uint8Array.from(dataview.buffer)])
      console.debug(`Packing vector took ${new Date().getTime() - startTime}ms`)
      return struct
    },
    fromStructure: structure => {
      const typeMarker = structure.fields[0][0]
      const byteArray = structure.fields[1]
      const dataview = new DataView(byteArray.length)
      let typedArray
      let set
      let resultArray
      if (typeMarker === INT_8) {
        return Int8Array.from(byteArray.buffer)
      } if (typeMarker === INT_16) {
        typedArray = Int16Array.from(byteArray.buffer)
        resultArray = Int16Array.from(dataview.buffer)
        set = dataview.setInt16
      } if (typeMarker === INT_32) {
        typedArray = Int32Array.from(byteArray.buffer)
        resultArray = Int32Array.from(dataview.buffer)
        set = dataview.setInt32
      } if (typeMarker === INT_64) {
        typedArray = BigInt64Array.from(byteArray.buffer)
        resultArray = BigInt64Array.from(dataview.buffer)
        set = dataview.setBigInt64
      } if (typeMarker === FLOAT_32) {
        typedArray = Float32Array.from(byteArray.buffer)
        resultArray = Float32Array.from(dataview.buffer)
        set = dataview.setFloat32
      } if (typeMarker === FLOAT_64) {
        typedArray = Float64Array.from(byteArray.buffer)
        resultArray = Float64Array.from(dataview.buffer)
        set = dataview.setFloat64
      } else {
        throw newError('Recieved Vector of unknown type')
      }
      for (let i = 0; i < typedArray.length; i++) {
        set(i * typedArray.BYTES_PER_ELEMENT, typedArray[i])
      }
      return new Vector(resultArray)
    }
  })
}

export default {
  ...v5x8,
  createVectorTransformer
}
