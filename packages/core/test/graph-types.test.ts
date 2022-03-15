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

  test.each(validNodes())('should be consider a node', (node: any) => {
    expect(isNode(node)).toBe(true)
  })

  test.each(nonNodes())('should not consider a non-node object as node', nonNode => {
    expect(isNode(nonNode)).toBe(false)
  })

  function validNodes(): any[] {
    return [
      [new Node(1, ['label'], {}, 'elementId')],
      [new Node(1, ['label'], {})],
      [new Node(1, [], {})],
      [new Node(BigInt(2), ['label'], {})],
      [new Node(int(3), ['label'], {})],
      [new Node(1, [], { 'property': 'value' })],
      [new Node(1, ['label'], { 'property': 'value' })],
    ]
  }

  function nonNodes(): any[] {
    return [
      [undefined],
      [null],
      [{ identity: 1, labels: ['label'], properties: { 'property': 'value' } }],
      [{ identity: 1, labels: ['label'], properties: { 'property': 'value' }, elementId: 'elementId' }],
      [{}],
      [{ 'property': 'value' }],
      [{ 'property': 'value', 'labels': ['label'] }],
      [{ 'property': 'value', 'labels': ['label'], 'identity': 1 }],
      [{ identity: BigInt(2), labels: ['label'], properties: { 'property': 'value' } }],
      [{ identity: int(3), labels: ['label'], properties: { 'property': 'value' } }],
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
    const relationship = new Relationship(1, 2, 3, 'Rel', { 'property': 'value' })

    expect(relationship.properties).toEqual({ 'property': 'value' })
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

  function validRelationships (): any[] {
    return [
      [new Relationship(1, 2, 3, 'Rel', {}, 'elementId', 'startNodeElementId', 'endNodeElementId')],
      [new Relationship(1, 2, 3, 'Rel', {}, 'elementId', 'startNodeElementId')],
      [new Relationship(1, 2, 3, 'Rel', {}, 'elementId')],
      [new Relationship(1, 2, 3, 'Rel', {})],
      [new Relationship(1, 2, 3, 'Rel', { 'property': 'value' })],
      [new Relationship(BigInt(4), BigInt(5), BigInt(6), 'Rel', {})],
      [new Relationship(int(6), int(7), int(8), 'Rel', {})],
    ]
  }

  function nonRelationships (): any[] {
    return [
      [undefined],
      [null],
      ['Relationship'],
      [{}],
      [{ 'property': 'value' }],
      [{
        identity: 1, start: 2, end: 3, type: 'Rel',
        properties: { 'property': 'value' }
      }],
      [{
        identity: 1, start: 2, end: 3, type: 'Rel',
        properties: { 'property': 'value' }, elementId: 'elementId'
      }],
      [{
        identity: 1, start: 2, end: 3, type: 'Rel',
        properties: { 'property': 'value' }, elementId: 'elementId',
        startNodeElementId: 'startNodeElementId', endNodeElementId: 'endNodeElementId'
      }],
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
    const relationship = new UnboundRelationship(1, 'Rel', { 'property': 'value' })

    expect(relationship.properties).toEqual({ 'property': 'value' })
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

  function validUnboundRelationships (): any[] {
    return [
      [new UnboundRelationship(1, 'Rel', {}, 'elementId')],
      [new UnboundRelationship(1, 'Rel', {})],
      [new UnboundRelationship(1, 'Rel', { 'property': 'value' })],
      [new UnboundRelationship(BigInt(2), 'Rel', { 'property': 'value' })],
      [new UnboundRelationship(int(3), 'Rel', { 'property': 'value' })],
    ]
  }

  function nonUnboundRelationships (): any[] {
    return [
      [undefined],
      [null],
      ['Relationship'],
      [{}],
      [{ 'property': 'value' }],
      [{
        identity: 1, type: 'Rel',
        properties: { 'property': 'value' }
      }],
      [{
        identity: 1, type: 'Rel',
        properties: { 'property': 'value' }, elementId: 'elementId'
      }]
    ]
  }

  function bindUnboundRelationshipFixture (): any[]  {
    return [
      [new UnboundRelationship(0, 'Rel', {}), new Node(1, ['Node'], {}), new Node(2, ['Node'], {})],
      [new UnboundRelationship(0, 'Rel', {}, 'elementId'), new Node(1, ['Node'], {}), new Node(2, ['Node'], {})],
      [new UnboundRelationship(0, 'Rel', {}), new Node(1, ['Node'], {}, 'nodeElementId'), new Node(2, ['Node'], {})],
      [new UnboundRelationship(0, 'Rel', {}), new Node(1, ['Node'], {}, 'nodeElementId'), new Node(2, ['Node'], {}), 'nodeElementId2'],
      [new UnboundRelationship(0, 'Rel', {}, 'elementId'), new Node(1, ['Node'], {}, 'nodeElementId'), new Node(2, ['Node'], {}), 'nodeElementId2'],
    ]
  }
})

function validIdentityAndExpectedElementIds (): any[] {
  return [
    [10, '10'],
    [int(12), '12'],
    [BigInt(32), '32'],
  ]
}
