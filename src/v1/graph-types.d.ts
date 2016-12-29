declare class Node {
  constructor(identity: string,
    labels: string[],
    properties: Object
  )

  toString(): string;
}

declare class Relationship {
  identity: string;
  start: string;
  end: string;
  type: string;
  properties: Object;

  constructor(identity: string,
    start: string,
    end: string,
    type: string,
    properties: Object)

  toString(): string;
}

declare class UnboundRelationship {
  identity: string;
  type: string;
  properties: Object;

  constructor(identity: string,
    type: string,
    properties: Object)

  bind( start: string, end: string ): Relationship;

  toString(): string;
}

declare class PathSegment {
  start: string;
  rel: Relationship;
  end: string;

  constructor(start: string,
    rel: Relationship,
    end: string)
}

declare class Path {
  start: Node;
  end: Node;
  segments: PathSegment[];
}

export {
  Node,
  Relationship,
  UnboundRelationship,
  Path,
  PathSegment
}
