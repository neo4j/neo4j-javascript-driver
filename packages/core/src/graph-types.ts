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
import Integer from './integer'
import { stringify } from './json'

type StandardDate = Date
type NumberOrInteger = number | Integer | bigint
type Properties = { [key: string]: any }

const IDENTIFIER_PROPERTY_ATTRIBUTES = {
  value: true,
  enumerable: false,
  configurable: false,
  writable: false
}

const NODE_IDENTIFIER_PROPERTY: string = '__isNode__'
const RELATIONSHIP_IDENTIFIER_PROPERTY: string = '__isRelationship__'
const UNBOUND_RELATIONSHIP_IDENTIFIER_PROPERTY: string =
  '__isUnboundRelationship__'
const PATH_IDENTIFIER_PROPERTY: string = '__isPath__'
const PATH_SEGMENT_IDENTIFIER_PROPERTY: string = '__isPathSegment__'

function hasIdentifierProperty(obj: any, property: string): boolean {
  return (obj && obj[property]) === true
}

/**
 * Class for Node Type.
 */
class Node<T extends NumberOrInteger = Integer, P extends Properties = Properties> {
  identity: T
  labels: string[]
  properties: P
  /**
   * @constructor
   * @protected
   * @param {Integer|number} identity - Unique identity
   * @param {Array<string>} labels - Array for all labels
   * @param {Properties} properties - Map with node properties
   */
  constructor(identity: T, labels: string[], properties: P) {
    /**
     * Identity of the node.
     * @type {Integer|number}
     */
    this.identity = identity
    /**
     * Labels of the node.
     * @type {string[]}
     */
    this.labels = labels
    /**
     * Properties of the node.
     * @type {Properties}
     */
    this.properties = properties
  }

  /**
   * @ignore
   */
  toString() {
    let s = '(' + this.identity
    for (let i = 0; i < this.labels.length; i++) {
      s += ':' + this.labels[i]
    }
    const keys = Object.keys(this.properties)
    if (keys.length > 0) {
      s += ' {'
      for (let i = 0; i < keys.length; i++) {
        if (i > 0) s += ','
        s += keys[i] + ':' + stringify(this.properties[keys[i]])
      }
      s += '}'
    }
    s += ')'
    return s
  }
}

Object.defineProperty(
  Node.prototype,
  NODE_IDENTIFIER_PROPERTY,
  IDENTIFIER_PROPERTY_ATTRIBUTES
)

/**
 * Test if given object is an instance of {@link Node} class.
 * @param {Object} obj the object to test.
 * @return {boolean} `true` if given object is a {@link Node}, `false` otherwise.
 */
function isNode(obj: object): obj is Node {
  return hasIdentifierProperty(obj, NODE_IDENTIFIER_PROPERTY)
}

/**
 * Class for Relationship Type.
 */
class Relationship<T extends NumberOrInteger = Integer, P extends Properties = Properties> {
  identity: T
  start: T
  end: T
  type: string
  properties: P

  /**
   * @constructor
   * @protected
   * @param {Integer|number} identity - Unique identity
   * @param {Integer|number} start - Identity of start Node
   * @param {Integer|number} end - Identity of end Node
   * @param {string} type - Relationship type
   * @param {Properties} properties - Map with relationship properties
   */
  constructor(identity: T, start: T, end: T, type: string, properties: P) {
    /**
     * Identity of the relationship.
     * @type {Integer|number}
     */
    this.identity = identity
    /**
     * Identity of the start node.
     * @type {Integer|number}
     */
    this.start = start
    /**
     * Identity of the end node.
     * @type {Integer|number}
     */
    this.end = end
    /**
     * Type of the relationship.
     * @type {string}
     */
    this.type = type
    /**
     * Properties of the relationship.
     * @type {Properties}
     */
    this.properties = properties
  }

  /**
   * @ignore
   */
  toString(): string {
    let s = '(' + this.start + ')-[:' + this.type
    const keys = Object.keys(this.properties)
    if (keys.length > 0) {
      s += ' {'
      for (let i = 0; i < keys.length; i++) {
        if (i > 0) s += ','
        s += keys[i] + ':' + stringify(this.properties[keys[i]])
      }
      s += '}'
    }
    s += ']->(' + this.end + ')'
    return s
  }
}

Object.defineProperty(
  Relationship.prototype,
  RELATIONSHIP_IDENTIFIER_PROPERTY,
  IDENTIFIER_PROPERTY_ATTRIBUTES
)

/**
 * Test if given object is an instance of {@link Relationship} class.
 * @param {Object} obj the object to test.
 * @return {boolean} `true` if given object is a {@link Relationship}, `false` otherwise.
 */
function isRelationship(obj: object): obj is Relationship {
  return hasIdentifierProperty(obj, RELATIONSHIP_IDENTIFIER_PROPERTY)
}

/**
 * Class for UnboundRelationship Type.
 * @access private
 */
class UnboundRelationship<T extends NumberOrInteger = Integer, P extends Properties = Properties> {
  identity: T
  type: string
  properties: P

  /**
   * @constructor
   * @protected
   * @param {Integer|number} identity - Unique identity
   * @param {string} type - Relationship type
   * @param {Properties} properties - Map with relationship properties
   */
  constructor(identity: T, type: string, properties: any) {
    /**
     * Identity of the relationship.
     * @type {Integer|number}
     */
    this.identity = identity
    /**
     * Type of the relationship.
     * @type {string}
     */
    this.type = type
    /**
     * Properties of the relationship.
     * @type {Properties}
     */
    this.properties = properties
  }

  /**
   * Bind relationship
   *
   * @protected
   * @param {Integer} start - Identity of start node
   * @param {Integer} end - Identity of end node
   * @return {Relationship} - Created relationship
   */
  bind(start: T, end: T): Relationship<T> {
    return new Relationship(
      this.identity,
      start,
      end,
      this.type,
      this.properties
    )
  }

  /**
   * @ignore
   */
  toString() {
    let s = '-[:' + this.type
    const keys = Object.keys(this.properties)
    if (keys.length > 0) {
      s += ' {'
      for (let i = 0; i < keys.length; i++) {
        if (i > 0) s += ','
        s += keys[i] + ':' + stringify(this.properties[keys[i]])
      }
      s += '}'
    }
    s += ']->'
    return s
  }
}

Object.defineProperty(
  UnboundRelationship.prototype,
  UNBOUND_RELATIONSHIP_IDENTIFIER_PROPERTY,
  IDENTIFIER_PROPERTY_ATTRIBUTES
)

/**
 * Test if given object is an instance of {@link UnboundRelationship} class.
 * @param {Object} obj the object to test.
 * @return {boolean} `true` if given object is a {@link UnboundRelationship}, `false` otherwise.
 */
function isUnboundRelationship(obj: object): obj is UnboundRelationship {
  return hasIdentifierProperty(obj, UNBOUND_RELATIONSHIP_IDENTIFIER_PROPERTY)
}

/**
 * Class for PathSegment Type.
 */
class PathSegment<T extends NumberOrInteger = Integer> {
  start: Node<T>
  relationship: Relationship<T>
  end: Node<T>
  /**
   * @constructor
   * @protected
   * @param {Node} start - start node
   * @param {Relationship} rel - relationship that connects start and end node
   * @param {Node} end - end node
   */
  constructor(start: Node<T>, rel: Relationship<T>, end: Node<T>) {
    /**
     * Start node.
     * @type {Node}
     */
    this.start = start
    /**
     * Relationship.
     * @type {Relationship}
     */
    this.relationship = rel
    /**
     * End node.
     * @type {Node}
     */
    this.end = end
  }
}

Object.defineProperty(
  PathSegment.prototype,
  PATH_SEGMENT_IDENTIFIER_PROPERTY,
  IDENTIFIER_PROPERTY_ATTRIBUTES
)

/**
 * Test if given object is an instance of {@link PathSegment} class.
 * @param {Object} obj the object to test.
 * @return {boolean} `true` if given object is a {@link PathSegment}, `false` otherwise.
 */
function isPathSegment(obj: object): obj is PathSegment {
  return hasIdentifierProperty(obj, PATH_SEGMENT_IDENTIFIER_PROPERTY)
}

/**
 * Class for Path Type.
 */
class Path<T extends NumberOrInteger = Integer> {
  start: Node<T>
  end: Node<T>
  segments: PathSegment<T>[]
  length: number
  /**
   * @constructor
   * @protected
   * @param {Node} start  - start node
   * @param {Node} end - end node
   * @param {Array<PathSegment>} segments - Array of Segments
   */
  constructor(start: Node<T>, end: Node<T>, segments: PathSegment<T>[]) {
    /**
     * Start node.
     * @type {Node}
     */
    this.start = start
    /**
     * End node.
     * @type {Node}
     */
    this.end = end
    /**
     * Segments.
     * @type {Array<PathSegment>}
     */
    this.segments = segments
    /**
     * Length of the segments.
     * @type {Number}
     */
    this.length = segments.length
  }
}

Object.defineProperty(
  Path.prototype,
  PATH_IDENTIFIER_PROPERTY,
  IDENTIFIER_PROPERTY_ATTRIBUTES
)

/**
 * Test if given object is an instance of {@link Path} class.
 * @param {Object} obj the object to test.
 * @return {boolean} `true` if given object is a {@link Path}, `false` otherwise.
 */
function isPath(obj: object): obj is Path {
  return hasIdentifierProperty(obj, PATH_IDENTIFIER_PROPERTY)
}

export {
  Node,
  isNode,
  Relationship,
  isRelationship,
  UnboundRelationship,
  isUnboundRelationship,
  Path,
  isPath,
  PathSegment,
  isPathSegment
}
export type {
  StandardDate,
  NumberOrInteger,
}
