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

import {
  Node,
  newError,
  error,
  Relationship,
  UnboundRelationship,
  Path,
  toNumber,
  PathSegment
} from 'neo4j-driver-core'

import { structure } from '../packstream'
import { TypeTransformer } from './transformer'

const { PROTOCOL_ERROR } = error

const NODE = 0x4e
const NODE_STRUCT_SIZE = 3

const RELATIONSHIP = 0x52
const RELATIONSHIP_STRUCT_SIZE = 5

const UNBOUND_RELATIONSHIP = 0x72
const UNBOUND_RELATIONSHIP_STRUCT_SIZE = 3

const PATH = 0x50
const PATH_STRUCT_SIZE = 3

export function createNodeTransformer () {
  return new TypeTransformer({
    signature: NODE,
    isTypeInstance: object => object instanceof Node,
    toStructure: object => {
      throw newError(
        `It is not allowed to pass nodes in query parameters, given: ${object}`,
        PROTOCOL_ERROR
      )
    },
    fromStructure: struct => {
      structure.verifyStructSize('Node', NODE_STRUCT_SIZE, struct.size)

      const [identity, labels, properties] = struct.fields

      return new Node(identity, labels, properties)
    }
  })
}

export function createRelationshipTransformer () {
  return new TypeTransformer({
    signature: RELATIONSHIP,
    isTypeInstance: object => object instanceof Relationship,
    toStructure: object => {
      throw newError(
        `It is not allowed to pass relationships in query parameters, given: ${object}`,
        PROTOCOL_ERROR
      )
    },
    fromStructure: struct => {
      structure.verifyStructSize('Relationship', RELATIONSHIP_STRUCT_SIZE, struct.size)

      const [identity, startNodeIdentity, endNodeIdentity, type, properties] = struct.fields

      return new Relationship(identity, startNodeIdentity, endNodeIdentity, type, properties)
    }
  })
}

export function createUnboundRelationshipTransformer () {
  return new TypeTransformer({
    signature: UNBOUND_RELATIONSHIP,
    isTypeInstance: object => object instanceof UnboundRelationship,
    toStructure: object => {
      throw newError(
        `It is not allowed to pass unbound relationships in query parameters, given: ${object}`,
        PROTOCOL_ERROR
      )
    },
    fromStructure: struct => {
      structure.verifyStructSize(
        'UnboundRelationship',
        UNBOUND_RELATIONSHIP_STRUCT_SIZE,
        struct.size
      )

      const [identity, type, properties] = struct.fields

      return new UnboundRelationship(identity, type, properties)
    }
  })
}

export function createPathTransformer () {
  return new TypeTransformer({
    signature: PATH,
    isTypeInstance: object => object instanceof Path,
    toStructure: object => {
      throw newError(
        `It is not allowed to pass paths in query parameters, given: ${object}`,
        PROTOCOL_ERROR
      )
    },
    fromStructure: struct => {
      structure.verifyStructSize('Path', PATH_STRUCT_SIZE, struct.size)

      const [nodes, rels, sequence] = struct.fields

      const segments = []
      let prevNode = nodes[0]

      for (let i = 0; i < sequence.length; i += 2) {
        const nextNode = nodes[sequence[i + 1]]
        const relIndex = toNumber(sequence[i])
        let rel

        if (relIndex > 0) {
          rel = rels[relIndex - 1]
          if (rel instanceof UnboundRelationship) {
            // To avoid duplication, relationships in a path do not contain
            // information about their start and end nodes, that's instead
            // inferred from the path sequence. This is us inferring (and,
            // for performance reasons remembering) the start/end of a rel.
            rels[relIndex - 1] = rel = rel.bindTo(
              prevNode,
              nextNode
            )
          }
        } else {
          rel = rels[-relIndex - 1]
          if (rel instanceof UnboundRelationship) {
            // See above
            rels[-relIndex - 1] = rel = rel.bindTo(
              nextNode,
              prevNode
            )
          }
        }
        // Done hydrating one path segment.
        segments.push(new PathSegment(prevNode, rel, nextNode))
        prevNode = nextNode
      }
      return new Path(nodes[0], nodes[nodes.length - 1], segments)
    }
  })
}
