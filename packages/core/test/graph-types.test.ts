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
  isNode
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

  test.each([
    [10, '10'], 
    [int(12), '12'],
    [BigInt(32), '32'],
  ])('should have elementId default to identity when it is not set', (identity, expected) => {
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
    ]
  }
})
