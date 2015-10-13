
class Node {
  constructor(identity, labels, properties) {
    this.identity = identity;
    this.labels = labels;
    this.properties = properties;
  }

  toString() {
    let s = "(" + this.identity.split('/')[1];
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

class Relationship {
  constructor(identity, start, end, type, properties) {
    this.identity = identity;
    this.start = start;
    this.end = end;
    this.type = type;
    this.properties = properties;
  }

  toString() {
    let s = "(" + this.start.split('/')[1] + ")-[:" + this.type;
    let keys = Object.keys(this.properties);
    if (keys.length > 0) {
      s += " {";
      for(let i = 0; i < keys.length; i++) {
        if (i > 0) s += ",";
        s += keys[i] + ":" + JSON.stringify(this.properties[keys[i]]);
      }
      s += "}";
    }
    s += "]->(" + this.end.split('/')[1] + ")";
    return s;
  }
}

class PathSegment {
  constructor( start, rel, end ) {
    this.start = start;
    this.relationship = rel;
    this.end = end;
  }
}

class Path {
  constructor(segments) {
    this.segments = segments;
    this.start = segments[0].start;
    this.end = segments[segments.length - 1].end;
    this.length = segments.length;
  }
}

export default {
  Node,
  Relationship,
  Path,
  PathSegment
}