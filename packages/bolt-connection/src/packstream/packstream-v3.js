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

import * as v2 from './packstream-v2';
import {
  Node
} from 'neo4j-driver-core'

const NODE_STRUCT_SIZE = 4

export class Packer extends v2.Packer {
  // This implementation is the same
}

export class Unpacker extends v2.Unpacker {
  /**
   * @constructor
   * @param {boolean} disableLosslessIntegers if this unpacker should convert all received integers to native JS numbers.
   * @param {boolean} useBigInt if this unpacker should convert all received integers to Bigint
   */
   constructor (disableLosslessIntegers = false, useBigInt = false) {
    super(disableLosslessIntegers, useBigInt)
  }

  _unpackNode (structSize, buffer) {
    this._verifyStructSize('Node', NODE_STRUCT_SIZE, structSize)

    return new Node(
      this.unpack(buffer), // Identity
      this.unpack(buffer), // Labels
      this.unpack(buffer), // Properties,
      this.unpack(buffer) // ElementId
    )
  }
  
}
