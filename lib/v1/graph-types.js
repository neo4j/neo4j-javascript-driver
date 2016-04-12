/**
 * Copyright (c) 2002-2016 "Neo Technology,"
 * Network Engine for Objects in Lund AB [http://neotechnology.com]
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

/**
 * Class for Node Type.
 */
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Node = (function () {
  /**
   * @constructor
   * @param {string} identity - Unique identity
   * @param {Array} labels - Array for all labels
   * @param {Object} properties - Map with node properties
   */

  function Node(identity, labels, properties) {
    _classCallCheck(this, Node);

    this.identity = identity;
    this.labels = labels;
    this.properties = properties;
  }

  /**
   * Class for Relationship Type.
   */

  _createClass(Node, [{
    key: "toString",
    value: function toString() {
      var s = "(" + this.identity;
      for (var i = 0; i < this.labels.length; i++) {
        s += ":" + this.labels[i];
      }
      var keys = Object.keys(this.properties);
      if (keys.length > 0) {
        s += " {";
        for (var i = 0; i < keys.length; i++) {
          if (i > 0) s += ",";
          s += keys[i] + ":" + JSON.stringify(this.properties[keys[i]]);
        }
        s += "}";
      }
      s += ")";
      return s;
    }
  }]);

  return Node;
})();

var Relationship = (function () {
  /**
   * @constructor
   * @param {string} identity - Unique identity
   * @param {string} start - Identity of start Node
   * @param {string} end - Identity of end Node
   * @param {string} type - Relationship type
   * @param {Object} properties - Map with relationship properties
   */

  function Relationship(identity, start, end, type, properties) {
    _classCallCheck(this, Relationship);

    this.identity = identity;
    this.start = start;
    this.end = end;
    this.type = type;
    this.properties = properties;
  }

  /**
   * Class for UnboundRelationship Type.
   * @access private
   */

  _createClass(Relationship, [{
    key: "toString",
    value: function toString() {
      var s = "(" + this.start + ")-[:" + this.type;
      var keys = Object.keys(this.properties);
      if (keys.length > 0) {
        s += " {";
        for (var i = 0; i < keys.length; i++) {
          if (i > 0) s += ",";
          s += keys[i] + ":" + JSON.stringify(this.properties[keys[i]]);
        }
        s += "}";
      }
      s += "]->(" + this.end + ")";
      return s;
    }
  }]);

  return Relationship;
})();

var UnboundRelationship = (function () {
  /**
   * @constructor
   * @param {string} identity - Unique identity
   * @param {string} type - Relationship type
   * @param {Object} properties - Map with relationship properties
   */

  function UnboundRelationship(identity, type, properties) {
    _classCallCheck(this, UnboundRelationship);

    this.identity = identity;
    this.type = type;
    this.properties = properties;
  }

  /**
   * Class for PathSegment Type.
   */

  /**
   * Bind relationship
   * @param {string} start - Indentity of start node
   * @param {string} end - Indentity of end node
   * @return {Relationship} - Created relationship
   */

  _createClass(UnboundRelationship, [{
    key: "bind",
    value: function bind(start, end) {
      return new Relationship(this.identity, start, end, this.type, this.properties);
    }
  }, {
    key: "toString",
    value: function toString() {
      var s = "-[:" + this.type;
      var keys = Object.keys(this.properties);
      if (keys.length > 0) {
        s += " {";
        for (var i = 0; i < keys.length; i++) {
          if (i > 0) s += ",";
          s += keys[i] + ":" + JSON.stringify(this.properties[keys[i]]);
        }
        s += "}";
      }
      s += "]->";
      return s;
    }
  }]);

  return UnboundRelationship;
})();

var PathSegment =
/**
 * @constructor
 * @param {string} start - Identity of start Node
 * @param {Relationship} rel - Relationship segment
 * @param {string} end - Identity of end Node
 */
function PathSegment(start, rel, end) {
  _classCallCheck(this, PathSegment);

  this.start = start;
  this.relationship = rel;
  this.end = end;
}

/**
 * Class for Path Type.
 */
;

var Path =
/**
 * @constructor
 * @param {Node} start  - start node
 * @param {Node} end - end node
 * @param {Array} segments - Array of Segments
 */
function Path(start, end, segments) {
  _classCallCheck(this, Path);

  this.start = start;
  this.end = end;
  this.segments = segments;
  this.length = segments.length;
};

exports["default"] = {
  Node: Node,
  Relationship: Relationship,
  UnboundRelationship: UnboundRelationship,
  Path: Path,
  PathSegment: PathSegment
};
module.exports = exports["default"];