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

import { structure } from '../packstream'
import { Node, Relationship, UnboundRelationship } from 'neo4j-driver-core'
import * as v4x4 from './bolt-protocol-v4x4.transformer'

const NODE_STRUCT_SIZE = 4
const RELATIONSHIP_STRUCT_SIZE = 8
const UNBOUND_RELATIONSHIP_STRUCT_SIZE = 4

function createNodeTransformer (config) {
  const node4x4Transformer = v4x4.createNodeTransformer(config)
  return node4x4Transformer.extendsWith({
    toStructure: struct => {
      structure.verifyStructSize('Node', NODE_STRUCT_SIZE, struct)

      const [identity, lables, properties, elementId] = struct.fields

      return new Node(
        identity,
        lables,
        properties,
        elementId
      )
    }
  })
}

function createRelationshipTransformer (config) {
  const relationship4x4Transformer = v4x4.createRelationshipTransformer(config)
  return relationship4x4Transformer.extendsWith({
    toStructure: struct => {
      structure.verifyStructSize('Relationship', RELATIONSHIP_STRUCT_SIZE, structure.size)

      const [
        identity,
        startNodeIdentity,
        endNodeIdentity,
        type,
        properties,
        elementId,
        startNodeElementId,
        endNodeElementId
      ] = struct.fields

      return new Relationship(
        identity,
        startNodeIdentity,
        endNodeIdentity,
        type,
        properties,
        elementId,
        startNodeElementId,
        endNodeElementId
      )
    }
  })
}

function createUnboundRelationshipTransformer (config) {
  const unboundRelationshipTransformer = v4x4.createUnboundRelationshipTransformer(config)
  return unboundRelationshipTransformer.extendsWith({
    toStructure: struct => {
      this._verifyStructSize(
        'UnboundRelationship',
        UNBOUND_RELATIONSHIP_STRUCT_SIZE,
        struct.size
      )

      const [
        identity,
        type,
        properties,
        elementId
      ] = struct.fields

      return new UnboundRelationship(
        identity,
        type,
        properties,
        elementId
      )
    }
  })
}

module.exports = {
  ...v4x4,
  createNodeTransformer,
  createRelationshipTransformer,
  createUnboundRelationshipTransformer
}
