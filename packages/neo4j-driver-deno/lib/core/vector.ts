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

import { newError } from './error.ts'

export enum VectorType {
    "INT8",
    "INT16",
    "INT32",
    "INT64",
    "FLOAT32",
    "FLOAT64",

}

/**
 * A wrapper class for JavaScript TypedArrays that makes the driver send them as a Vector type to the database.
 * @access public
 * @exports Vector
 * @class A Integer class for representing a 64 bit two's-complement integer value.
 * @param {Float32Array | Float64Array | Int8Array | Int16Array | Int32Array | BigInt64Array} typedArray The TypedArray to convert to a vector
 *
 * @constructor
 * 
 */
export default class Vector {
    typedArray : Float32Array | Float64Array | Int8Array | Int16Array | Int32Array | BigInt64Array
    type: VectorType
    constructor(typedArray: Float32Array | Float64Array | Int8Array | Int16Array | Int32Array | BigInt64Array ){
        if(typedArray instanceof Int8Array) {
            this.type = VectorType.INT8
        }
        if(typedArray instanceof Int16Array) {
            this.type = VectorType.INT16
        }
        if(typedArray instanceof Int32Array) {
            this.type = VectorType.INT32
        }
        if(typedArray instanceof BigInt64Array) {
            this.type = VectorType.INT64
        }
        if(typedArray instanceof Float32Array) {
            this.type = VectorType.FLOAT32
        }
        if(typedArray instanceof Float64Array) {
            this.type = VectorType.FLOAT64
        }
        else {
            throw newError("The neo4j Vector class is a wrapper for TypedArrays")
        }
        this.typedArray = typedArray
    }
}


/**
 * Cast a TypedArray to a {@link Vector}
 * @access public
 * @param {Float32Array | Float64Array | Int8Array | Int16Array | Int32Array | BigInt64Array} typedArray - The value to use.
 * @return {Vector} - The Neo4j Vector ready to be used as a query parameter
 */
export function vector(typedArray: Float32Array | Float64Array | Int8Array | Int16Array | Int32Array | BigInt64Array ) : Vector {
    return new Vector(typedArray)
}
