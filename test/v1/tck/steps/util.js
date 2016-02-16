var neo4j = require("../../../../lib/v1");

INT = 'integer';
FLOAT = 'float';
STRING = 'string';
BOOL = 'boolean';
NULL = 'null';
RELATIONSHIP = 'relationship';
NODE = 'node';
PATH = 'path';

module.exports = {
  literalTableToTestObject,
  literalValueToTestValue,
  compareValues,
  sizeOfObject,
  clone,
  printable
};

function literalTableToTestObject(literalResults) {
  var resultValues = [];
  for ( var i = 0 ; i < literalResults.length ; i++) {
      resultValues.push(literalLineToObjects(literalResults[i]));
  }
  return resultValues;
}

function literalLineToObjects(resultRow) {
  resultObject = {};
  for ( var key in resultRow)
  {
    resultObject[key] = literalValueToTestValue(resultRow[key]);
  }
  return resultObject;
}

function literalValueToTestValue(values) {
  if (isLiteralArray(values)) {
    values = getLiteralArray(values);
  }
  if (isLiteralMap(values)) {
    return getProperties(values);
  }
  if (values instanceof Array) {
    var res = [];
    for (var i in values) {
      res.push(literalValueToTestValue(values[i]));
    }
  }
  else {
     var res = convertValue(values);
  }
  return res;
}

function convertValue(value) {
  if (value === NULL) {
    return null;
  }
  else if (value === "true" || value === "false"){
    return Boolean(value);
  }
  else if (value.charAt(0) === '"' && value.charAt(value.length-1) === '"') {
    return value.substring(1, value.length-1);
  }
  else if (value.indexOf('[:') === 0 && value.indexOf(']') === value.length-1) {
    return createUndirectedRelationship(value);
  }
  else if (value.indexOf('(') === 0 && value.indexOf(')') === value.length-1) {
    return createNode(value);
  }
  else if (value.indexOf('<(') === 0 && value.indexOf(')>') === value.length-2) {
    return createPath(value);
  }
  if (value.match( "^(-?[0-9]+)$")) {
    return neo4j.int(value)
  }
  return parseFloat(value);
}


function createUndirectedRelationship(val) {
  var base = createBaseRelationship(val);
  return base;
}

function createDirectedRelationship(val, n1, n2) {
  var base = createBaseRelationship(val);
  if (val.indexOf("->") <0 ) {
    base.end = n1;
    base.start = n2;
  }
  else if (val.indexOf("<-") <0 ) {
    base.start = n1;
    base.end = n2;
  }
  else {
    throw new Error("Not a directed relationship: " + val);
  }
  return base;
}

function createBaseRelationship(val) {
  var rel = {}
  val = val.substring(val.indexOf("["));
  val = val.substring(0, val.indexOf("]"));
  rel.properties = getProperties(val);
  rel.type = getType(val);
  rel.identity = neo4j.int(0);
  rel.start = neo4j.int(0);
  rel.end = neo4j.int(0);
  return rel;
}

function createNode(val) {
  var node = {}
  val = val.substring(val.indexOf("("));
  val = val.substring(0, val.indexOf(")"));
  node.properties = getProperties(val);
  node.labels = getLabels(val);
  node.identity = neo4j.int(0);
  return node;
}

function createPath(val) {
  var path = {}
  val = val.substring(1, val.length -1);
  var entities = parseNodesAndRelationshipsFromPath(val);
  path.start = entities[0];
  path.end = entities[entities.length-1];
  path.length = (entities.length - 1) / 2;
  path.segments = [];
  if (entities.length > 2) {
    for (var i = 0; i < entities.length-2; i+=2) {
      segment = {"start": entities[i],
                 "end": entities[i+2],
                 "relationship": entities[i+1]};
       path.segments.push(segment);
     }
   }
  return path;
}

function parseNodesAndRelationshipsFromPath(val) {
  var first = val.split(")");
  var nodesAndRels = [];
  var id = 0;
  for (var i = 0; i < first.length-1 ; i++) {
    var second = first[i].split("(");
    var node = createNode("(" + second[1] + ")");
    node.identity = neo4j.int(id++);
    if (i > 0) {
      var rel= createDirectedRelationship(second[0], nodesAndRels[nodesAndRels.length-1].identity, node.identity)
      nodesAndRels.push(rel);
    }
    nodesAndRels.push(node);
  }
  return nodesAndRels;
}

function getProperties(val) {
  var startIndex = val.indexOf("{");
  var endIndex = val.indexOf("}");
  if (!(startIndex >= 0 && endIndex >= 0)) {
    return {};
  }
  val = val.substring(startIndex, endIndex + 1);
  return properties = JSON.parse(val, function(k, v) {
    if (Number.isInteger(v)) {
      return neo4j.int(v);
    }
    return v;
  });
}

function printable(array) {
  return JSON.stringify(array);
}

function getType(val) {
  var labels = getLabels(val);
  if (labels.length > 1) {
    throw new Error("Shuld be single type. Found many: " + labels)
  }
  if (labels.length === 0) {
    return [];
  }
  return labels[0];
}

function getLabels(val) {
  var startIndex = val.indexOf("{");
  var endIndex = val.indexOf("}");
  if ((startIndex >= 0 && endIndex >= 0)) {
    val = val.substring(0, startIndex) + val.substring(endIndex + 1, val.length);
  }
  val = val.substring(val.indexOf(":"), val.length);
  if (val.indexOf(" ") > 0) {
    val = val.substring(0, val.indexOf(" "));
  }
  if ( val.indexOf(":") < 0) {
    return [];
  }
  labels = val.split(":")
  labels.splice(0, labels.length-1);
  return labels;
}


function isLiteralArray(result) {
  if (result[0] == '[' && result[result.length - 1] == ']')
  {
    if (result[1] != ":") {
        return true;
    }
  }
  return false;
}

function isLiteralMap(result) {
  return result[0] == '{' && result[result.length - 1] == '}';
}

function getLiteralArray(result) {
  result = result.substring(1, result.length - 1);
  return result.split(', ');
}

function compareValues(given, expected) {
  if (neo4j.isInt(given)) {
    if (given.equals(expected)) {
      return true;
    }
  }
  else if (typeof given === "object" && given instanceof Array){
    if (sizeOfObject(given) != sizeOfObject(expected)) return false;
    for (var i = 0; i < given.length; ++i) {
      if (!compareValues(given[i], expected[i])) {
        return false;
      }
    }
    return true;
  }
  else if (typeof given === "object" && given instanceof Object){
    if (given.length != expected.length) return false;
    var keys = Object.keys(given);
    const union = new Set(keys.concat(Object.keys(expected)));
    if (union.size !== keys.length) {
      return false;
    }
    for (var key in given) {
      if (typeof expected[key] == "undefined") return false;
      if (!compareValues(given[key], expected[key])) {
        return false;
      }
    }
    return true;
  }
  else if (given === expected) {
    return true;
  }
  return false;
}

function sizeOfObject(obj) {
  var size = 0, key;
  for (key in obj) {
      if (obj.hasOwnProperty(key)) size++;
  }
  return size;
}

function clone(obj) {
    if (null == obj || "object" != typeof obj) return obj;
    if (obj.constructor.name.toLowerCase() === INT ) return obj;
    var copy = obj.constructor();
    for (var attr in obj) {
        if (obj.hasOwnProperty(attr)) {
          copy[attr] = clone(obj[attr]);
        }
    }
    return copy;
}
