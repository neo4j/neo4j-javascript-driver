/**
 * Copyright (c) 2002-2020 "Neo4j,"
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

const IDENTIFIER_PROPERTY_ATTRIBUTES = {
  value: true,
  enumerable: false,
  configurable: false,
  writable: false
}

const NODE_IDENTIFIER_PROPERTY = '__isNode__'
const RELATIONSHIP_IDENTIFIER_PROPERTY = '__isRelationship__'
const UNBOUND_RELATIONSHIP_IDENTIFIER_PROPERTY = '__isUnboundRelationship__'
const PATH_IDENTIFIER_PROPERTY = '__isPath__'
const PATH_SEGMENT_IDENTIFIER_PROPERTY = '__isPathSegment__'

function hasIdentifierProperty (obj, property) {
  return (obj && obj[property]) === true
}

/**
 * Class for Node Type.
 */
class Node {
  /**
   * @constructor
   * @protected
   * @param {Integer} identity - Unique identity
   * @param {Array<string>} labels - Array for all labels
   * @param {Object} properties - Map with node properties
   */
  constructor (identity, labels, properties) {
    /**
     * Identity of the node.
     * @type {Integer}
     */
    this.identity = identity
    /**
     * Labels of the node.
     * @type {string[]}
     */
    this.labels = labels
    /**
     * Properties of the node.
     * @type {Object}
     */
    this.properties = properties
  }

  /**
   * @ignore
   */
  toString () {
    let s = '(' + this.identity
    for (let i = 0; i < this.labels.length; i++) {
      s += ':' + this.labels[i]
    }
    const keys = Object.keys(this.properties)
    if (keys.length > 0) {
      s += ' {'
      for (let i = 0; i < keys.length; i++) {
        if (i > 0) s += ','
        s += keys[i] + ':' + JSON.stringify(this.properties[keys[i]])
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
function isNode (obj) {
  return hasIdentifierProperty(obj, NODE_IDENTIFIER_PROPERTY)
}

/**
 * Class for Relationship Type.
 */
class Relationship {
  /**
   * @constructor
   * @protected
   * @param {Integer} identity - Unique identity
   * @param {Integer} start - Identity of start Node
   * @param {Integer} end - Identity of end Node
   * @param {string} type - Relationship type
   * @param {Object} properties - Map with relationship properties
   */
  constructor (identity, start, end, type, properties) {
    /**
     * Identity of the relationship.
     * @type {Integer}
     */
    this.identity = identity
    /**
     * Identity of the start node.
     * @type {Integer}
     */
    this.start = start
    /**
     * Identity of the end node.
     * @type {Integer}
     */
    this.end = end
    /**
     * Type of the relationship.
     * @type {string}
     */
    this.type = type
    /**
     * Properties of the relationship.
     * @type {Object}
     */
    this.properties = properties
  }

  /**
   * @ignore
   */
  toString () {
    let s = '(' + this.start + ')-[:' + this.type
    const keys = Object.keys(this.properties)
    if (keys.length > 0) {
      s += ' {'
      for (let i = 0; i < keys.length; i++) {
        if (i > 0) s += ','
        s += keys[i] + ':' + JSON.stringify(this.properties[keys[i]])
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
function isRelationship (obj) {
  return hasIdentifierProperty(obj, RELATIONSHIP_IDENTIFIER_PROPERTY)
}

/**
 * Class for UnboundRelationship Type.
 * @access private
 */
class UnboundRelationship {
  /**
   * @constructor
   * @protected
   * @param {Integer} identity - Unique identity
   * @param {string} type - Relationship type
   * @param {Object} properties - Map with relationship properties
   */
  constructor (identity, type, properties) {
    /**
     * Identity of the relationship.
     * @type {Integer}
     */
    this.identity = identity
    /**
     * Type of the relationship.
     * @type {string}
     */
    this.type = type
    /**
     * Properties of the relationship.
     * @type {Object}
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
  bind (start, end) {
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
  toString () {
    let s = '-[:' + this.type
    const keys = Object.keys(this.properties)
    if (keys.length > 0) {
      s += ' {'
      for (let i = 0; i < keys.length; i++) {
        if (i > 0) s += ','
        s += keys[i] + ':' + JSON.stringify(this.properties[keys[i]])
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
function isUnboundRelationship (obj) {
  return hasIdentifierProperty(obj, UNBOUNT_RELATIONSHIP_IDENTIFIER_PROPERTY)
}

/**
 * Class for PathSegment Type.
 */
class PathSegment {
  /**
   * @constructor
   * @protected
   * @param {Node} start - start node
   * @param {Relationship} rel - relationship that connects start and end node
   * @param {Node} end - end node
   */
  constructor (start, rel, end) {
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
function isPathSegment (obj) {
  return hasIdentifierProperty(obj, PATH_SEGMENT_IDENTIFIER_PROPERTY)
}

/**
 * Class for Path Type.
 */
class Path {
  /**
   * @constructor
   * @protected
   * @param {Node} start  - start node
   * @param {Node} end - end node
   * @param {Array<PathSegment>} segments - Array of Segments
   */
  constructor (start, end, segments) {
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
function isPath (obj) {
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
