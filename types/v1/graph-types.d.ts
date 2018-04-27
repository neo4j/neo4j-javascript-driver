/**
 * Copyright (c) 2002-2018 Neo4j Sweden AB [http://neo4j.com]
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

declare type NumberOrInteger = number | Integer;

declare class Node<T extends NumberOrInteger = Integer> {
  identity: T;
  labels: string[];
  properties: object;

  constructor(identity: T,
              labels: string[],
              properties: object)

  toString(): string;
}

declare class Relationship<T extends NumberOrInteger = Integer> {
  identity: T;
  start: T;
  end: T;
  type: string;
  properties: object;

  constructor(identity: T,
              start: T,
              end: T,
              type: string,
              properties: object);

  toString(): string;
}

declare class UnboundRelationship<T extends NumberOrInteger = Integer> {
  identity: T;
  type: string;
  properties: object;

  constructor(identity: T,
              type: string,
              properties: object);

  bind(start: T, end: T): Relationship<T>;

  toString(): string;
}

declare class PathSegment<T extends NumberOrInteger = Integer> {
  start: Node<T>;
  relationship: Relationship<T>;
  end: Node<T>;

  constructor(start: Node<T>,
              rel: Relationship<T>,
              end: Node<T>);
}

declare class Path<T extends NumberOrInteger = Integer> {
  start: Node<T>;
  end: Node<T>;
  segments: PathSegment<T>[];
  length: number;

  constructor(start: Node<T>,
              end: Node<T>,
              segments: PathSegment<T>[]);
}

export {
  Node,
  Relationship,
  UnboundRelationship,
  Path,
  PathSegment,
  NumberOrInteger
}
