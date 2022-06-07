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

import * as v2 from './packstream-v2'
import {
  Node,
  Relationship,
  UnboundRelationship,
  int
} from 'neo4j-driver-core'

const NODE_STRUCT_SIZE = 4
const RELATIONSHIP_STRUCT_SIZE = 8
const UNBOUND_RELATIONSHIP_STRUCT_SIZE = 4

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
    this._defaultIdentity = this._getDefaultIdentity()
  }

  _getDefaultIdentity () {
    if (this._useBigInt) {
      return BigInt(-1)
    } else if (this._disableLosslessIntegers) {
      return -1
    } else {
      return int(-1)
    }
  }

  _unpackNode (structure) {
    this._verifyStructSize('Node', NODE_STRUCT_SIZE, structure.size)

    const [identity, lables, properties, elementId] = structure.fields

    return new Node(
      _valueOrDefault(identity, this._defaultIdentity), // Identity
      lables, // Labels
      properties, // Properties,
      elementId // ElementId
    )
  }

  _unpackRelationship (structure) {
    this._verifyStructSize('Relationship', RELATIONSHIP_STRUCT_SIZE, structure.size)

    const [
      identity,
      startNodeIdentity,
      endNodeIdentity,
      type,
      properties,
      elementId,
      startNodeElementId,
      endNodeElementId
    ] = structure.fields

    return new Relationship(
      _valueOrDefault(identity, this._defaultIdentity), // Identity
      _valueOrDefault(startNodeIdentity, this._defaultIdentity), // Start Node Identity
      _valueOrDefault(endNodeIdentity, this._defaultIdentity), // End Node Identity
      type,
      properties,
      elementId,
      startNodeElementId,
      endNodeElementId
    )
  }

  _unpackUnboundRelationship (structure) {
    this._verifyStructSize(
      'UnboundRelationship',
      UNBOUND_RELATIONSHIP_STRUCT_SIZE,
      structure.size
    )

    const [
      identity,
      type,
      properties,
      elementId
    ] = structure.fields

    return new UnboundRelationship(
      _valueOrDefault(identity, this._defaultIdentity), // Identity
      type,
      properties,
      elementId
    )
  }
}

function _valueOrDefault (value, defaultValue) {
  return value === null ? defaultValue : value
}
