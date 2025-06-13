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
      const dataview = new DataView(new ArrayBuffer(vector.typedArray.byteLength))
      let set
      let typeMarker
      switch (vector.type) {
        case 'INT8':
          typeMarker = Uint8Array.from([INT_8])
          set = dataview.setUint8.bind(dataview)
          break
        case 'INT16':
          typeMarker = Uint8Array.from([INT_16])
          set = dataview.setUint16.bind(dataview)
          break
        case 'INT32':
          typeMarker = Uint8Array.from([INT_32])
          set = dataview.setUint32.bind(dataview)
          break
        case 'INT64':
          typeMarker = Uint8Array.from([INT_64])
          set = dataview.setBigInt64.bind(dataview)
          break
        case 'FLOAT32':
          typeMarker = Uint8Array.from([FLOAT_32])
          set = dataview.setFloat32.bind(dataview)
          break
        case 'FLOAT64':
          typeMarker = Uint8Array.from([FLOAT_64])
          set = dataview.setFloat64.bind(dataview)
          break
        default:
          throw newError(`Vector is of unsupported type ${vector.type}`)
      }
      for (let i = 0; i < vector.typedArray.length; i++) {
        set(i * vector.typedArray.BYTES_PER_ELEMENT, vector.typedArray[i])
      }
      const struct = new structure.Structure(VECTOR, [typeMarker, new Int8Array(dataview.buffer)])
      return struct
    },
    fromStructure: structure => {
      const isLittleEndian = checkLittleEndian()
      const typeMarker = structure.fields[0][0]
      const arrayBuffer = structure.fields[1]
      const setview = new DataView(new ArrayBuffer(arrayBuffer.byteLength))
      const getview = new DataView(arrayBuffer.buffer)
      let get
      let set
      let resultArray
      switch (typeMarker) {
        case INT_8:
          return new Vector(Int8Array.from(arrayBuffer))
        case INT_16:
          resultArray = new Int16Array(setview.buffer)
          get = getview.getInt16.bind(getview)
          set = setview.setInt16.bind(setview)
          break
        case INT_32:
          resultArray = new Int32Array(setview.buffer)
          get = getview.getInt32.bind(getview)
          set = setview.setInt32.bind(setview)
          break
        case INT_64:
          resultArray = new BigInt64Array(setview.buffer)
          get = getview.getBigInt64.bind(getview)
          set = setview.setBigInt64.bind(setview)
          break
        case FLOAT_32:
          resultArray = new Float32Array(setview.buffer)
          get = getview.getFloat32.bind(getview)
          set = setview.setFloat32.bind(setview)
          break
        case FLOAT_64:
          resultArray = new Float64Array(setview.buffer)
          get = getview.getFloat64.bind(getview)
          set = setview.setFloat64.bind(setview)
          break
        default:
          throw newError(`Recieved Vector of unknown type ${typeMarker}`)
      }
      for (let i = 0; i < arrayBuffer.length; i += resultArray.BYTES_PER_ELEMENT) {
        set(i, get(i), isLittleEndian)
      }
      return new Vector(resultArray)
    }
  })
}

function checkLittleEndian () {
  const dataview = new DataView(new ArrayBuffer(2))
  dataview.setInt16(0, 1000, true)
  const typeArray = new Int16Array(dataview.buffer)
  return typeArray[0] === 1000
}

export default {
  ...v5x8,
  createVectorTransformer
}
