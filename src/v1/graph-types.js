/**
 * Copyright (c) 2002-2018 "Neo4j,"
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

import Integer from './integer';

/**
 * Class for Node Type.
 */ 
class Node {
  /**
   * @constructor
   * @param {Integer} identity - Unique identity
   * @param {Array<string>} labels - Array for all labels
   * @param {Object} properties - Map with node properties
   */
  constructor(identity, labels, properties) {
    this.identity = identity;
    this.labels = labels;
    this.properties = properties;
  }

  toString() {
    let s = "(" + this.identity;
    for (let i = 0; i < this.labels.length; i++) {
      s += ":" + this.labels[i];
    }
    let keys = Object.keys(this.properties);
    if (keys.length > 0) {
      s += " {";
      for(let i = 0; i < keys.length; i++) {
        if (i > 0) s += ",";
        s += keys[i] + ":" + JSON.stringify(this.properties[keys[i]]);
      }
      s += "}";
    }
    s += ")";
    return s;
  }
}

/**
 * Class for Relationship Type.
 */ 
class Relationship {
  /**
   * @constructor
   * @param {Integer} identity - Unique identity
   * @param {Integer} start - Identity of start Node
   * @param {Integer} end - Identity of end Node
   * @param {string} type - Relationship type
   * @param {Object} properties - Map with relationship properties
   */
  constructor(identity, start, end, type, properties) {
    this.identity = identity;
    this.start = start;
    this.end = end;
    this.type = type;
    this.properties = properties;
  }

  toString() {
    let s = "(" + this.start + ")-[:" + this.type;
    let keys = Object.keys(this.properties);
    if (keys.length > 0) {
      s += " {";
      for(let i = 0; i < keys.length; i++) {
        if (i > 0) s += ",";
        s += keys[i] + ":" + JSON.stringify(this.properties[keys[i]]);
      }
      s += "}";
    }
    s += "]->(" + this.end + ")";
    return s;
  }
}

/**
 * Class for UnboundRelationship Type.
 * @access private
 */ 
class UnboundRelationship {
  /**
   * @constructor
   * @param {Integer} identity - Unique identity
   * @param {string} type - Relationship type
   * @param {Object} properties - Map with relationship properties
   */
  constructor(identity, type, properties) {
    this.identity = identity;
    this.type = type;
    this.properties = properties;
  }

  /**
   * Bind relationship
   * @param {Integer} start - Identity of start node
   * @param {Integer} end - Identity of end node
   * @return {Relationship} - Created relationship
   */
  bind( start, end ) {
    return new Relationship(
      this.identity, 
      start, 
      end, 
      this.type, 
      this.properties);
  }

  toString() {
    let s = "-[:" + this.type;
    let keys = Object.keys(this.properties);
    if (keys.length > 0) {
      s += " {";
      for(let i = 0; i < keys.length; i++) {
        if (i > 0) s += ",";
        s += keys[i] + ":" + JSON.stringify(this.properties[keys[i]]);
      }
      s += "}";
    }
    s += "]->";
    return s;
  }
}

/**
 * Class for PathSegment Type.
 */ 
class PathSegment {
  /**
   * @constructor
   * @param {Node} start - start node
   * @param {Relationship} rel - relationship that connects start and end node
   * @param {Node} end - end node
   */
  constructor(start, rel, end) {
    this.start = start;
    this.relationship = rel;
    this.end = end;
  }
}

/**
 * Class for Path Type.
 */ 
class Path {
  /**
   * @constructor
   * @param {Node} start  - start node
   * @param {Node} end - end node
   * @param {Array<PathSegment>} segments - Array of Segments
   */
  constructor(start, end, segments) {
    this.start = start;
    this.end = end;
    this.segments = segments;
    this.length = segments.length;
  }
}

export {
  Node,
  Relationship,
  UnboundRelationship,
  Path,
  PathSegment
}
