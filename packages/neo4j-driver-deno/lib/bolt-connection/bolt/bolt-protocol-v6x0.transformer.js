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
      const isLittleEndian = checkLittleEndian()
      const setview = new DataView(new ArrayBuffer(vector.typedArray.byteLength))
      // we want exact byte accuracy, so we cannot simply get the valye from the typed array
      const getview = new DataView(vector.typedArray.buffer)
      let set
      let get
      let typeMarker
      switch (vector.type) {
        case 'INT8':
          typeMarker = Int8Array.from([INT_8])
          set = setview.setInt8.bind(setview)
          get = getview.getInt8.bind(getview)
          break
        case 'INT16':
          typeMarker = Int8Array.from([INT_16])
          set = setview.setInt16.bind(setview)
          get = getview.getInt16.bind(getview)
          break
        case 'INT32':
          typeMarker = Int8Array.from([INT_32])
          set = setview.setInt32.bind(setview)
          get = getview.getInt32.bind(getview)
          break
        case 'INT64':
          typeMarker = Int8Array.from([INT_64])
          set = setview.setBigInt64.bind(setview)
          get = getview.getBigInt64.bind(getview)
          break
        case 'FLOAT32':
          typeMarker = Int8Array.from([FLOAT_32])
          set = setview.setUint32.bind(setview)
          get = getview.getUint32.bind(getview)
          break
        case 'FLOAT64':
          typeMarker = Int8Array.from([FLOAT_64])
          set = setview.setBigInt64.bind(setview)
          get = getview.getBigInt64.bind(getview)
          break
        default:
          throw newError(`Vector is of unsupported type ${vector.type}`)
      }
      for (let i = 0; i < vector.typedArray.length; i++) {
        set(i * vector.typedArray.BYTES_PER_ELEMENT, get(i * vector.typedArray.BYTES_PER_ELEMENT, isLittleEndian))
      }
      const struct = new structure.Structure(VECTOR, [typeMarker, new Int8Array(setview.buffer)])
      return struct
    },
    fromStructure: structure => {
      const isLittleEndian = checkLittleEndian()
      const typeMarker = Uint8Array.from(structure.fields[0])[0]
      const arrayBuffer = structure.fields[1]
      const getview = new DataView(arrayBuffer.buffer)
      if (isLittleEndian) {
        const setview = new DataView(new ArrayBuffer(arrayBuffer.byteLength))
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
            if (!isLittleEndian) {
              return new Float64Array(getview.buffer)
            }
            resultArray = new Float32Array(setview.buffer)
            // Due to JS imprecision when working with float32, we will get incorrect byte values if using the float functions
            get = getview.getUint32.bind(getview)
            set = setview.setUint32.bind(setview)
            break
          case FLOAT_64:
            if (!isLittleEndian) {
              return new Float64Array(getview.buffer)
            }
            resultArray = new Float64Array(setview.buffer)
            get = getview.getBigInt64.bind(getview)
            set = setview.setBigInt64.bind(setview)
            break
          default:
            throw newError(`Recieved Vector of unknown type ${typeMarker}`)
        }
        for (let i = 0; i < arrayBuffer.length; i += resultArray.BYTES_PER_ELEMENT) {
          set(i, get(i), isLittleEndian)
        }
        return new Vector(resultArray)
      } else {
        switch (typeMarker) {
          case INT_8:
            return new Vector(Int8Array.from(arrayBuffer))
          case INT_16:
            return new Vector(new Int16Array(getview.buffer))
          case INT_32:
            return new Vector(new Int32Array(getview.buffer))
          case INT_64:
            return new Vector(new BigInt64Array(getview.buffer))
          case FLOAT_32:
            return new Vector(new Float32Array(getview.buffer))
          case FLOAT_64:
            return new Vector(new Float64Array(getview.buffer))
          default:
            throw newError(`Recieved Vector of unknown type ${typeMarker}`)
        }
      }
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
