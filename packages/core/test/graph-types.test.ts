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
  isNode,
  Relationship,
  isRelationship,
  UnboundRelationship,
  isUnboundRelationship,
  Path,
  PathSegment,
  isPath,
  isPathSegment
} from '../src/graph-types'

import {
  int
} from '../src/integer'

describe('Node', () => {
  test('should have identity', () => {
    const node = new Node(1, [], {})

    expect(node.identity).toEqual(1)
  })

  test('should have labels', () => {
    const node = new Node(1, ['label'], {})

    expect(node.labels).toEqual(['label'])
  })

  test('should have properties', () => {
    const node = new Node(1, [], {
      property: 'value'
    })

    expect(node.properties).toEqual({
      property: 'value'
    })
  })

  test('should have elementId', () => {
    const node = new Node(1, [], {}, 'elementId')

    expect(node.elementId).toEqual('elementId')
  })

  test.each(
    validIdentityAndExpectedElementIds()
  )('should have elementId default to identity when it is not set', (identity, expected) => {
    const node = new Node(identity, [], {})

    expect(node.elementId).toEqual(expected)
  })

  test.each(validNodes())('should be serialized as string', node => {
    expect(node.toString()).toMatchSnapshot()
  })

  test.each(validNodes())('should be consider a node', (node: unknown) => {
    expect(isNode(node)).toBe(true)

    if (isNode(node)) {
      const typedNode: Node = node
      expect(typedNode).toEqual(node)
    } else {
      // @ts-expect-error
      const typedNode: Node = node
      expect(typedNode).toEqual(node)
    }
  })

  test.each(nonNodes())('should not consider a non-node object as node', (nonNode: unknown) => {
    expect(isNode(nonNode)).toBe(false)

    if (isNode(nonNode)) {
      const typedNode: Node = nonNode
      expect(typedNode).toEqual(nonNode)
    } else {
      // @ts-expect-error
      const typedNode: Node = nonNode
      expect(typedNode).toEqual(nonNode)
    }
  })

  test('should type mapping labels', () => {
    type PersonLabels = 'Person' | 'Actor'
    const labels: PersonLabels[] = ['Actor', 'Person']
    type Person = Node<number, {}, PersonLabels>

    const p: Person = new Node(1, labels, {})

    const receivedLabels: PersonLabels[] = p.labels

    expect(receivedLabels).toEqual(labels)

    // @ts-expect-error
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _: 'Movie'|Array<'TvShow'> = p.labels
  })

  function validNodes (): any[] {
    return [
      [new Node(1, ['label'], {}, 'elementId')],
      [new Node(1, ['label'], {})],
      [new Node(1, [], {})],
      [new Node(BigInt(2), ['label'], {})],
      [new Node(int(3), ['label'], {})],
      [new Node(1, [], { property: 'value' })],
      [new Node(1, ['label'], { property: 'value' })]
    ]
  }

  function nonNodes (): any[] {
    return [
      [undefined],
      [null],
      [{ identity: 1, labels: ['label'], properties: { property: 'value' } }],
      [{ identity: 1, labels: ['label'], properties: { property: 'value' }, elementId: 'elementId' }],
      [{}],
      [{ property: 'value' }],
      [{ property: 'value', labels: ['label'] }],
      [{ property: 'value', labels: ['label'], identity: 1 }],
      [{ identity: BigInt(2), labels: ['label'], properties: { property: 'value' } }],
      [{ identity: int(3), labels: ['label'], properties: { property: 'value' } }]
    ]
  }
})

describe('Relationship', () => {
  test('should have identity', () => {
    const relationship = new Relationship(1, 2, 3, 'Rel', {})

    expect(relationship.identity).toEqual(1)
  })

  test('should have start', () => {
    const relationship = new Relationship(1, 2, 3, 'Rel', {})

    expect(relationship.start).toEqual(2)
  })

  test('should have end', () => {
    const relationship = new Relationship(1, 2, 3, 'Rel', {})

    expect(relationship.end).toEqual(3)
  })

  test('should have type', () => {
    const relationship = new Relationship(1, 2, 3, 'Rel', {})

    expect(relationship.type).toEqual('Rel')
  })

  test('should have properties', () => {
    const relationship = new Relationship(1, 2, 3, 'Rel', { property: 'value' })

    expect(relationship.properties).toEqual({ property: 'value' })
  })

  test('should have elementId', () => {
    const relationship = new Relationship(1, 2, 3, 'Rel', {}, 'elementId')

    expect(relationship.elementId).toEqual('elementId')
  })

  test.each(
    validIdentityAndExpectedElementIds()
  )('should default elementId to indentity when it is not set', (identity, expected) => {
    const relationship = new Relationship(identity, 2, 3, 'Rel', {})

    expect(relationship.elementId).toEqual(expected)
  })

  test('should have startNodeElementId', () => {
    const relationship = new Relationship(1, 2, 3, 'Rel', {}, 'elementId', 'startNodeElementId')

    expect(relationship.startNodeElementId).toEqual('startNodeElementId')
  })

  test.each(
    validIdentityAndExpectedElementIds()
  )('should default startNodeElementId to start when it is not set', (identity, expected) => {
    const relationship = new Relationship(1, identity, 3, 'Rel', {})

    expect(relationship.startNodeElementId).toEqual(expected)
  })

  test('should have endNodeElementId', () => {
    const relationship = new Relationship(1, 2, 3, 'Rel', {}, 'elementId', 'startNodeElementId', 'endNodeElementId')

    expect(relationship.endNodeElementId).toEqual('endNodeElementId')
  })

  test.each(
    validIdentityAndExpectedElementIds()
  )('should default endNodeElementId to start when it is not set', (identity, expected) => {
    const relationship = new Relationship(1, 2, identity, 'Rel', {})

    expect(relationship.endNodeElementId).toEqual(expected)
  })

  test.each(validRelationships())('should be serialized as string', relationship => {
    expect(relationship.toString()).toMatchSnapshot()
  })

  test.each(validRelationships())('should be consider a relationship', relationship => {
    expect(isRelationship(relationship)).toBe(true)
  })

  test.each(nonRelationships())('should not consider a non-relationship object as relationship', nonRelationship => {
    expect(isRelationship(nonRelationship)).toBe(false)
  })

  test('should type mapping relationship type', () => {
    type ActedIn = Relationship<number, { [key in string]: any }, 'ACTED_IN'>
    const a: ActedIn = new Relationship(1, 1, 2, 'ACTED_IN', {})

    const receivedType: 'ACTED_IN' = a.type
    expect(receivedType).toEqual('ACTED_IN')

    // @ts-expect-error
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _: 'DIRECTED' = a.type
  })

  test.each(validRelationships())('should be consider a relationship', (relationship: unknown) => {
    expect(isRelationship(relationship)).toBe(true)

    if (isRelationship(relationship)) {
      const typedRelationship: Relationship = relationship
      expect(typedRelationship).toEqual(relationship)
    } else {
      // @ts-expect-error
      const typedRelationship: Relationship = relationship
      expect(typedRelationship).toEqual(relationship)
    }
  })

  test.each(nonRelationships())('should not consider a non-relationship object as relationship', (nonRelationship: unknown) => {
    expect(isRelationship(nonRelationship)).toBe(false)

    if (isRelationship(nonRelationship)) {
      const typedRelationship: Relationship = nonRelationship
      expect(typedRelationship).toEqual(nonRelationship)
    } else {
      // @ts-expect-error
      const typedRelationship: Relationship = nonRelationship
      expect(typedRelationship).toEqual(nonRelationship)
    }
  })

  function validRelationships (): any[] {
    return [
      [new Relationship(1, 2, 3, 'Rel', {}, 'elementId', 'startNodeElementId', 'endNodeElementId')],
      [new Relationship(1, 2, 3, 'Rel', {}, 'elementId', 'startNodeElementId')],
      [new Relationship(1, 2, 3, 'Rel', {}, 'elementId')],
      [new Relationship(1, 2, 3, 'Rel', {})],
      [new Relationship(1, 2, 3, 'Rel', { property: 'value' })],
      [new Relationship(BigInt(4), BigInt(5), BigInt(6), 'Rel', {})],
      [new Relationship(int(6), int(7), int(8), 'Rel', {})]
    ]
  }

  function nonRelationships (): any[] {
    return [
      [undefined],
      [null],
      ['Relationship'],
      [{}],
      [{ property: 'value' }],
      [{
        identity: 1,
        start: 2,
        end: 3,
        type: 'Rel',
        properties: { property: 'value' }
      }],
      [{
        identity: 1,
        start: 2,
        end: 3,
        type: 'Rel',
        properties: { property: 'value' },
        elementId: 'elementId'
      }],
      [{
        identity: 1,
        start: 2,
        end: 3,
        type: 'Rel',
        properties: { property: 'value' },
        elementId: 'elementId',
        startNodeElementId: 'startNodeElementId',
        endNodeElementId: 'endNodeElementId'
      }]
    ]
  }
})

describe('UnboundRelationship', () => {
  test('should have identity', () => {
    const relationship = new UnboundRelationship(1, 'Rel', {})

    expect(relationship.identity).toEqual(1)
  })

  test('should have type', () => {
    const relationship = new UnboundRelationship(1, 'Rel', {})

    expect(relationship.type).toEqual('Rel')
  })

  test('should have properties', () => {
    const relationship = new UnboundRelationship(1, 'Rel', { property: 'value' })

    expect(relationship.properties).toEqual({ property: 'value' })
  })

  test.each(validUnboundRelationships())('should be serialized as string', relationship => {
    expect(relationship.toString()).toMatchSnapshot()
  })

  test.each(validUnboundRelationships())('should be consider a unbound relationship', relationship => {
    expect(isUnboundRelationship(relationship)).toBe(true)
  })

  test.each(
    nonUnboundRelationships()
  )('should not consider a non-unbound relationship object as unbound relationship', nonUnboundRelationship => {
    expect(isUnboundRelationship(nonUnboundRelationship)).toBe(false)
  })

  test.each(
    bindUnboundRelationshipFixture()
  )('should bind with node identity', (rel, startNode, endNode) => {
    expect(rel.bind(startNode.identity, endNode.identity))
      .toEqual(
        new Relationship(
          rel.identity,
          startNode.identity,
          endNode.identity,
          rel.type,
          rel.properties,
          rel.elementId
        )
      )
  })

  test.each(
    bindUnboundRelationshipFixture()
  )('should bind to nodes', (rel, startNode, endNode) => {
    expect(rel.bindTo(startNode, endNode))
      .toEqual(
        new Relationship(
          rel.identity,
          startNode.identity,
          endNode.identity,
          rel.type,
          rel.properties,
          rel.elementId,
          startNode.elementId,
          endNode.elementId
        )
      )
  })

  test('should type mapping relationship type', () => {
    type ActedIn = UnboundRelationship<number, { [key in string]: any }, 'ACTED_IN'>
    const a: ActedIn = new UnboundRelationship(1, 'ACTED_IN', {})

    const receivedType: 'ACTED_IN' = a.type
    expect(receivedType).toEqual('ACTED_IN')

    // @ts-expect-error
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _: 'DIRECTED' = a.type
  })

  test.each(validUnboundRelationships())('should be consider a unbound relationship', (unboundRelationship: unknown) => {
    expect(isUnboundRelationship(unboundRelationship)).toBe(true)

    if (isUnboundRelationship(unboundRelationship)) {
      const typedRelationship: UnboundRelationship = unboundRelationship
      expect(typedRelationship).toEqual(unboundRelationship)
    } else {
      // @ts-expect-error
      const typedRelationship: UnboundRelationship = unboundRelationship
      expect(typedRelationship).toEqual(unboundRelationship)
    }
  })

  test.each(nonUnboundRelationships())('should not consider a non-unbound relationship object as unbound relationship', (nonUnboundRelationship: unknown) => {
    expect(isUnboundRelationship(nonUnboundRelationship)).toBe(false)

    if (isUnboundRelationship(nonUnboundRelationship)) {
      const typedRelationship: UnboundRelationship = nonUnboundRelationship
      expect(typedRelationship).toEqual(nonUnboundRelationship)
    } else {
      // @ts-expect-error
      const typedRelationship: UnboundRelationship = nonUnboundRelationship
      expect(typedRelationship).toEqual(nonUnboundRelationship)
    }
  })

  function validUnboundRelationships (): any[] {
    return [
      [new UnboundRelationship(1, 'Rel', {}, 'elementId')],
      [new UnboundRelationship(1, 'Rel', {})],
      [new UnboundRelationship(1, 'Rel', { property: 'value' })],
      [new UnboundRelationship(BigInt(2), 'Rel', { property: 'value' })],
      [new UnboundRelationship(int(3), 'Rel', { property: 'value' })]
    ]
  }

  function nonUnboundRelationships (): any[] {
    return [
      [undefined],
      [null],
      ['Relationship'],
      [{}],
      [{ property: 'value' }],
      [{
        identity: 1,
        type: 'Rel',
        properties: { property: 'value' }
      }],
      [{
        identity: 1,
        type: 'Rel',
        properties: { property: 'value' },
        elementId: 'elementId'
      }]
    ]
  }

  function bindUnboundRelationshipFixture (): any[] {
    return [
      [new UnboundRelationship(0, 'Rel', {}), new Node(1, ['Node'], {}), new Node(2, ['Node'], {})],
      [new UnboundRelationship(0, 'Rel', {}, 'elementId'), new Node(1, ['Node'], {}), new Node(2, ['Node'], {})],
      [new UnboundRelationship(0, 'Rel', {}), new Node(1, ['Node'], {}, 'nodeElementId'), new Node(2, ['Node'], {})],
      [new UnboundRelationship(0, 'Rel', {}), new Node(1, ['Node'], {}, 'nodeElementId'), new Node(2, ['Node'], {}), 'nodeElementId2'],
      [new UnboundRelationship(0, 'Rel', {}, 'elementId'), new Node(1, ['Node'], {}, 'nodeElementId'), new Node(2, ['Node'], {}), 'nodeElementId2']
    ]
  }
})

describe('Path', () => {
  test.each(validPaths())('should be consider a path', (path: unknown) => {
    expect(isPath(path)).toBe(true)

    if (isPath(path)) {
      const typed: Path = path
      expect(typed).toEqual(path)
    } else {
      // @ts-expect-error
      const typed: Path = path
      expect(typed).toEqual(path)
    }
  })

  test.each(nonPaths())('should not consider a non-path object as path', (nonPath: unknown) => {
    expect(isPath(nonPath)).toBe(false)

    if (isPath(nonPath)) {
      const typed: Path = nonPath
      expect(typed).toEqual(nonPath)
    } else {
      // @ts-expect-error
      const typed: Path = nonPath
      expect(typed).toEqual(nonPath)
    }
  })

  function validPaths (): any[] {
    return [
      [new Path(new Node(1, [], {}), new Node(2, [], {}), [])],
      [new Path(new Node(1, [], {}), new Node(2, [], {}), [new PathSegment(new Node(1, [], {}), new Relationship(1, 1, 2, 'type', {}), new Node(2, [], {}))])]
    ]
  }

  function nonPaths (): any[] {
    return [
      [{
        start: new Node(1, [], {}),
        end: new Node(2, [], {}),
        length: 1,
        segments: [
          new PathSegment(
            new Node(1, [], {}),
            new Relationship(1, 1, 2, 'type', {}),
            new Node(2, [], {}))
        ]
      }],
      [null],
      [undefined],
      [{}],
      [1]
    ]
  }
})

describe('Path', () => {
  test.each(validPathSegments())('should be consider a path segment', (pathSegment: unknown) => {
    expect(isPathSegment(pathSegment)).toBe(true)

    if (isPathSegment(pathSegment)) {
      const typed: PathSegment = pathSegment
      expect(typed).toEqual(pathSegment)
    } else {
      // @ts-expect-error
      const typed: PathSegment = pathSegment
      expect(typed).toEqual(pathSegment)
    }
  })

  test.each(nonPathSegments())('should not consider a non-path object as path segument', (nonPathSegment: unknown) => {
    expect(isPathSegment(nonPathSegment)).toBe(false)

    if (isPathSegment(nonPathSegment)) {
      const typed: PathSegment = nonPathSegment
      expect(typed).toEqual(nonPathSegment)
    } else {
      // @ts-expect-error
      const typed: PathSegment = nonPathSegment
      expect(typed).toEqual(nonPathSegment)
    }
  })

  function validPathSegments (): any[] {
    return [
      [new PathSegment(new Node(1, [], {}), new Relationship(1, 1, 2, 'type', {}), new Node(2, [], {}))],
      [new PathSegment(new Node(int(1), [], {}), new Relationship(int(1), int(1), int(2), 'type', {}), new Node(int(2), [], {}))]
    ]
  }

  function nonPathSegments (): any[] {
    return [
      [{

        start: new Node(1, [], {}),
        end: new Node(2, [], {}),
        relationship: new Relationship(1, 1, 2, 'type', {})
      }],
      [null],
      [undefined],
      [{}],
      [1]
    ]
  }
})

function validIdentityAndExpectedElementIds (): any[] {
  return [
    [10, '10'],
    [int(12), '12'],
    [BigInt(32), '32']
  ]
}
