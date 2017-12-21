/**
 * Copyright (c) 2002-2017 "Neo Technology,","
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

import {Node, Path, PathSegment, Relationship, UnboundRelationship} from "../../../types/v1/graph-types";
import Integer, {int} from "../../../types/v1/integer";

const node1: Node = new Node(int(1), ["Person", "Employee"], {name: "Alice"});
const node1String: string = node1.toString();
const node1Id: Integer = node1.identity;
const node1Labels: string[] = node1.labels;
const node1Props: object = node1.properties;

const rel1: Relationship = new Relationship(int(1), int(2), int(3), "KNOWS", {since: 12345});
const rel1String: string = rel1.toString();
const rel1Id: Integer = rel1.identity;
const rel1Start: Integer = rel1.start;
const rel1End: Integer = rel1.end;
const rel1Type: string = rel1.type;
const rel1Props: object = rel1.properties;

const rel2: UnboundRelationship = new UnboundRelationship(int(1), "KNOWS", {since: 12345});
const rel2String: string = rel2.toString();
const rel3: Relationship = rel2.bind(int(1), int(2));
const rel2Id: Integer = rel2.identity;
const rel2Type: string = rel2.type;
const rel2Props: object = rel2.properties;

const pathSegment1: PathSegment = new PathSegment(node1, rel1, node1);
const pathSegment1Start: Node = pathSegment1.start;
const pathSegment1Rel: Relationship = pathSegment1.relationship;
const pathSegment1End: Node = pathSegment1.end;

const path1: Path = new Path(node1, node1, [pathSegment1]);
const path1Start: Node = path1.start;
const path1End: Node = path1.end;
const path1Segments: PathSegment[] = path1.segments;
const path1Length: number = path1.length;
