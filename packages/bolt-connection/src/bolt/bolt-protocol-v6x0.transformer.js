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

import v5x8 from './bolt-protocol-v5x8.transformer'
import { TypeTransformer } from './transformer'
import { structure } from '../packstream'
import { Vector, newError } from 'neo4j-driver-core'
const VECTOR = 0x56
const FLOAT_32 = 0xc6
const FLOAT_64 = 0xc1
const INT_8 = 0xc8
const INT_16 = 0xc9
const INT_32 = 0xca
const INT_64 = 0xcb

const typeToTypeMarker = {
  INT8: INT_8,
  INT16: INT_16,
  INT32: INT_32,
  INT64: INT_64,
  FLOAT32: FLOAT_32,
  FLOAT64: FLOAT_64
}

function createVectorTransformer () {
  return new TypeTransformer({
    signature: VECTOR,
    isTypeInstance: object => object instanceof Vector,
    toStructure: vector => {
      const typeMarker = typeToTypeMarker[vector.getType()]
      const buffer = fixBufferEndianness(typeMarker, vector.asTypedArray().buffer)
      const struct = new structure.Structure(VECTOR, [Int8Array.from([typeMarker]), new Int8Array(buffer)])
      return struct
    },
    fromStructure: structure => {
      const typeMarker = Uint8Array.from(structure.fields[0])[0]
      const byteArray = structure.fields[1]
      const buffer = fixBufferEndianness(typeMarker, byteArray.buffer)
      switch (typeMarker) {
        case INT_8:
          return new Vector(new Int8Array(buffer))
        case INT_16:
          return new Vector(new Int16Array(buffer))
        case INT_32:
          return new Vector(new Int32Array(buffer))
        case INT_64:
          return new Vector(new BigInt64Array(buffer))
        case FLOAT_32:
          return new Vector(new Float32Array(buffer))
        case FLOAT_64:
          return new Vector(new Float64Array(buffer))
      }
    }
  })
}

function fixBufferEndianness (typeMarker, buffer) {
  const isLittleEndian = checkLittleEndian()
  if (isLittleEndian) {
    const setview = new DataView(new ArrayBuffer(buffer.byteLength))
    // we want exact byte accuracy, so we cannot simply get the value from the typed array
    const getview = new DataView(buffer)
    let set
    let get
    let elementSize
    switch (typeMarker) {
      case INT_8:
        elementSize = 1
        set = setview.setInt8.bind(setview)
        get = getview.getInt8.bind(getview)
        break
      case INT_16:
        elementSize = 2
        set = setview.setInt16.bind(setview)
        get = getview.getInt16.bind(getview)
        break
      case INT_32:
        elementSize = 4
        set = setview.setInt32.bind(setview)
        get = getview.getInt32.bind(getview)
        break
      case INT_64:
        elementSize = 8
        set = setview.setBigInt64.bind(setview)
        get = getview.getBigInt64.bind(getview)
        break
      case FLOAT_32:
        elementSize = 4
        set = setview.setInt32.bind(setview)
        get = getview.getInt32.bind(getview)
        break
      case FLOAT_64:
        elementSize = 8
        set = setview.setBigInt64.bind(setview)
        get = getview.getBigInt64.bind(getview)
        break
      default:
        throw newError(`Vector is of unsupported type ${typeMarker}`)
    }
    for (let i = 0; i < buffer.byteLength; i += elementSize) {
      set(i, get(i, isLittleEndian))
    }
    return setview.buffer
  } else {
    return buffer
  }
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
