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
import Integer from './integer'
import { stringify } from './json'

type StandardDate = Date
/**
 * @typedef {number | Integer | bigint} NumberOrInteger
 */
type NumberOrInteger = number | Integer | bigint
interface Properties { [key: string]: any }

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

function hasIdentifierProperty (obj: any, property: string): boolean {
  return obj != null && obj[property] === true
}

/**
 * Class for Node Type.
 */
class Node<T extends NumberOrInteger = Integer, P extends Properties = Properties, Label extends string = string> {
  identity: T
  labels: Label[]
  properties: P
  elementId: string
  /**
   * @constructor
   * @protected
   * @param {NumberOrInteger} identity - Unique identity
   * @param {Array<string>} labels - Array for all labels
   * @param {Properties} properties - Map with node properties
   * @param {string} elementId - Node element identifier
   */
  constructor (identity: T, labels: Label[], properties: P, elementId?: string) {
    /**
     * Identity of the node.
     * @type {NumberOrInteger}
     * @deprecated use {@link Node#elementId} instead
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
    /**
     * The Node element identifier.
     * @type {string}
     */
    this.elementId = _valueOrGetDefault(elementId, () => identity.toString())
  }

  /**
   * @ignore
   */
  toString (): string {
    let s = '(' + this.elementId
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
function isNode<
    T extends NumberOrInteger = Integer,
    P extends Properties = Properties,
    Label extends string = string> (obj: unknown): obj is Node<T, P, Label> {
  return hasIdentifierProperty(obj, NODE_IDENTIFIER_PROPERTY)
}

/**
 * Class for Relationship Type.
 */
class Relationship<T extends NumberOrInteger = Integer, P extends Properties = Properties, Type extends string = string> {
  identity: T
  start: T
  end: T
  type: Type
  properties: P
  elementId: string
  startNodeElementId: string
  endNodeElementId: string

  /**
   * @constructor
   * @protected
   * @param {NumberOrInteger} identity - Unique identity
   * @param {NumberOrInteger} start - Identity of start Node
   * @param {NumberOrInteger} end - Identity of end Node
   * @param {string} type - Relationship type
   * @param {Properties} properties - Map with relationship properties
   * @param {string} elementId - Relationship element identifier
   * @param {string} startNodeElementId - Start Node element identifier
   * @param {string} endNodeElementId - End Node element identifier
   */
  constructor (
    identity: T, start: T, end: T, type: Type, properties: P,
    elementId?: string, startNodeElementId?: string, endNodeElementId?: string
  ) {
    /**
     * Identity of the relationship.
     * @type {NumberOrInteger}
     * @deprecated use {@link Relationship#elementId} instead
     */
    this.identity = identity
    /**
     * Identity of the start node.
     * @type {NumberOrInteger}
     * @deprecated use {@link Relationship#startNodeElementId} instead
     */
    this.start = start
    /**
     * Identity of the end node.
     * @type {NumberOrInteger}
     * @deprecated use {@link Relationship#endNodeElementId} instead
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

    /**
     * The Relationship element identifier.
     * @type {string}
     */
    this.elementId = _valueOrGetDefault(elementId, () => identity.toString())

    /**
     * The Start Node element identifier.
     * @type {string}
     */
    this.startNodeElementId = _valueOrGetDefault(startNodeElementId, () => start.toString())

    /**
     * The End Node element identifier.
     * @type {string}
     */
    this.endNodeElementId = _valueOrGetDefault(endNodeElementId, () => end.toString())
  }

  /**
   * @ignore
   */
  toString (): string {
    let s = '(' + this.startNodeElementId + ')-[:' + this.type
    const keys = Object.keys(this.properties)
    if (keys.length > 0) {
      s += ' {'
      for (let i = 0; i < keys.length; i++) {
        if (i > 0) s += ','
        s += keys[i] + ':' + stringify(this.properties[keys[i]])
      }
      s += '}'
    }
    s += ']->(' + this.endNodeElementId + ')'
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
function isRelationship<
    T extends NumberOrInteger = Integer,
    P extends Properties = Properties,
    Type extends string = string> (obj: unknown): obj is Relationship<T, P, Type> {
  return hasIdentifierProperty(obj, RELATIONSHIP_IDENTIFIER_PROPERTY)
}

/**
 * Class for UnboundRelationship Type.
 * @access private
 */
class UnboundRelationship<T extends NumberOrInteger = Integer, P extends Properties = Properties, Type extends string = string> {
  identity: T
  type: Type
  properties: P
  elementId: string

  /**
   * @constructor
   * @protected
   * @param {NumberOrInteger} identity - Unique identity
   * @param {string} type - Relationship type
   * @param {Properties} properties - Map with relationship properties
   * @param {string} elementId - Relationship element identifier
   */
  constructor (identity: T, type: Type, properties: any, elementId?: string) {
    /**
     * Identity of the relationship.
     * @type {NumberOrInteger}
     * @deprecated use {@link UnboundRelationship#elementId} instead
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

    /**
     * The Relationship element identifier.
     * @type {string}
     */
    this.elementId = _valueOrGetDefault(elementId, () => identity.toString())
  }

  /**
   * Bind relationship
   *
   * @protected
   * @deprecated use {@link UnboundRelationship#bindTo} instead
   * @param {Integer} start - Identity of start node
   * @param {Integer} end - Identity of end node
   * @return {Relationship} - Created relationship
   */
  bind (start: T, end: T): Relationship<T> {
    return new Relationship(
      this.identity,
      start,
      end,
      this.type,
      this.properties,
      this.elementId
    )
  }

  /**
   * Bind relationship
   *
   * @protected
   * @param {Node} start - Start Node
   * @param {Node} end - End Node
   * @return {Relationship} - Created relationship
   */
  bindTo (start: Node<T>, end: Node<T>): Relationship<T> {
    return new Relationship(
      this.identity,
      start.identity,
      end.identity,
      this.type,
      this.properties,
      this.elementId,
      start.elementId,
      end.elementId
    )
  }

  /**
   * @ignore
   */
  toString (): string {
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
 * @access private
 */
function isUnboundRelationship<
    T extends NumberOrInteger = Integer,
    P extends Properties = Properties,
    Type extends string = string> (obj: unknown): obj is UnboundRelationship<T, P, Type> {
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
  constructor (start: Node<T>, rel: Relationship<T>, end: Node<T>) {
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
function isPathSegment<T extends NumberOrInteger = Integer> (obj: unknown): obj is PathSegment<T> {
  return hasIdentifierProperty(obj, PATH_SEGMENT_IDENTIFIER_PROPERTY)
}

/**
 * Class for Path Type.
 */
class Path<T extends NumberOrInteger = Integer> {
  start: Node<T>
  end: Node<T>
  segments: Array<PathSegment<T>>
  length: number
  /**
   * @constructor
   * @protected
   * @param {Node} start  - start node
   * @param {Node} end - end node
   * @param {Array<PathSegment>} segments - Array of Segments
   */
  constructor (start: Node<T>, end: Node<T>, segments: Array<PathSegment<T>>) {
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
function isPath<T extends NumberOrInteger = Integer> (obj: unknown): obj is Path<T> {
  return hasIdentifierProperty(obj, PATH_IDENTIFIER_PROPERTY)
}

function _valueOrGetDefault<T> (value: T | undefined | null, getDefault: () => T): T {
  return value === undefined || value === null ? getDefault() : value
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
  NumberOrInteger
}
