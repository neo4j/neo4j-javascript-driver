/**
 * Copyright (c) 2002-2018 "Neo Technology,"
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

import Integer from "./integer";

declare class Node {
  identity: Integer;
  labels: string[];
  properties: object;

  constructor(identity: Integer,
              labels: string[],
              properties: object)

  toString(): string;
}

declare class Relationship {
  identity: Integer;
  start: Integer;
  end: Integer;
  type: string;
  properties: object;

  constructor(identity: Integer,
              start: Integer,
              end: Integer,
              type: string,
              properties: object);

  toString(): string;
}

declare class UnboundRelationship {
  identity: Integer;
  type: string;
  properties: object;

  constructor(identity: Integer,
              type: string,
              properties: object);

  bind(start: Integer, end: Integer): Relationship;

  toString(): string;
}

declare class PathSegment {
  start: Node;
  relationship: Relationship;
  end: Node;

  constructor(start: Node,
              rel: Relationship,
              end: Node);
}

declare class Path {
  start: Node;
  end: Node;
  segments: PathSegment[];
  length: number;

  constructor(start: Node,
              end: Node,
              segments: PathSegment[]);
}

export {
  Node,
  Relationship,
  UnboundRelationship,
  Path,
  PathSegment
}
