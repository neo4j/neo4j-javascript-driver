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
/* eslint-disable no-unused-vars */

import {
  int,
  Integer,
  Node,
  Path,
  PathSegment,
  Relationship,
  UnboundRelationship,
  isNode,
  isPath,
  isPathSegment,
  isRelationship,
  isUnboundRelationship
} from 'neo4j-driver-core'

const node1: Node = new Node(int(1), ['Person', 'Employee'], { name: 'Alice' })
const node1String: string = node1.toString()
const node1Id: Integer = node1.identity
const node1Labels: string[] = node1.labels
const node1Props: object = node1.properties
const isNode1: boolean = node1 instanceof Node
const isNode1B: boolean = isNode(node1)
const nodeAsObj: object = node1
if (isNode(nodeAsObj)) {
  const test = nodeAsObj.properties
}

const node2: Node<number> = new Node(2, ['Person', 'Employee'], {
  name: 'Alice'
})
const node2Id: number = node2.identity

type NodeProps = { name: string }
const node3: Node<number, NodeProps> = new Node(2, ['Person', 'Employee'], {
  name: 'Alice'
})
const node3Props: NodeProps = node3.properties
const node3PropertyName: string = node3.properties.name

const rel1: Relationship = new Relationship(int(1), int(2), int(3), 'KNOWS', {
  since: 12345
})
const rel1String: string = rel1.toString()
const rel1Id: Integer = rel1.identity
const rel1Start: Integer = rel1.start
const rel1End: Integer = rel1.end
const rel1Type: string = rel1.type
const rel1Props: object = rel1.properties
const isRel1: boolean = rel1 instanceof Relationship
const isRel1B: boolean = isRelationship(rel1)
const relationshipAsObj: object = rel1
if (isRelationship(relationshipAsObj)) {
  const test = relationshipAsObj.properties
}

const rel2: UnboundRelationship = new UnboundRelationship(int(1), 'KNOWS', {
  since: 12345
})
const rel2String: string = rel2.toString()
const rel3: Relationship = rel2.bind(int(1), int(2))
const rel2Id: Integer = rel2.identity
const rel2Type: string = rel2.type
const rel2Props: object = rel2.properties
const isRel2: boolean = rel2 instanceof UnboundRelationship
const isRel2B: boolean = isUnboundRelationship(rel2)
const unboundRelationshipAsObj: object = rel2
if (isUnboundRelationship(unboundRelationshipAsObj)) {
  const test = unboundRelationshipAsObj.properties
}

const rel4: Relationship<number> = new Relationship(2, 3, 4, 'KNOWS', {
  since: 12345
})
const rel4Id: number = rel4.identity
const rel4Start: number = rel4.start
const rel4End: number = rel4.end
const isRel4: boolean = rel4 instanceof Relationship

const rel5: UnboundRelationship<number> = new UnboundRelationship(5, 'KNOWS', {
  since: 12345
})
const rel5Id: number = rel5.identity
const rel6 = rel5.bind(24, 42)
const rel6Id: number = rel6.identity
const rel6Start: number = rel6.start
const rel6End: number = rel6.end
const isRel6: boolean = rel6 instanceof UnboundRelationship

type RelationshipProps = { since: number }
const rel7: Relationship<number, RelationshipProps> = new Relationship(
  2,
  3,
  4,
  'KNOWS',
  {
    since: 12345
  }
)
const rel7Props: RelationshipProps = rel7.properties
const rel7PropertySince: number = rel7.properties.since

const rel8: UnboundRelationship<
  number,
  RelationshipProps
> = new UnboundRelationship(5, 'KNOWS', {
  since: 12345
})
const rel8Props: RelationshipProps = rel8.properties
const rel8PropertySince: number = rel8.properties.since

const pathSegment1: PathSegment = new PathSegment(node1, rel1, node1)
const pathSegment1Start: Node = pathSegment1.start
const pathSegment1Rel: Relationship = pathSegment1.relationship
const pathSegment1End: Node = pathSegment1.end
const isPathSegment1: boolean = pathSegment1 instanceof PathSegment
const isPathSegment1B: boolean = isPathSegment(pathSegment1)
const pathSegmentAsObj: object = pathSegment1
if (isPathSegment(pathSegmentAsObj)) {
  const test = pathSegmentAsObj.start
}

const pathSegment2: PathSegment<number> = new PathSegment(node2, rel4, node2)
const pathSegment2Start: Node<number> = pathSegment2.start
const pathSegment2Rel: Relationship<number> = pathSegment2.relationship
const pathSegment2End: Node<number> = pathSegment2.end

const path1: Path = new Path(node1, node1, [pathSegment1])
const path1Start: Node = path1.start
const path1End: Node = path1.end
const path1Segments: PathSegment[] = path1.segments
const path1Length: number = path1.length
const isPath1: boolean = path1 instanceof Path
const isPath1B: boolean = isPath(path1)
const pathAsObj: object = path1
if (isPath(pathAsObj)) {
  const test = pathAsObj.segments
}

const path2: Path<number> = new Path(node2, node2, [pathSegment2])
const path2Start: Node<number> = path2.start
const path2End: Node<number> = path2.end
const path2Segments: PathSegment<number>[] = path2.segments
const isPath2: boolean = path2 instanceof Path
