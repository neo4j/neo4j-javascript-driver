/**
 * Copyright (c) "Neo4j"
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

import { int, Integer, isPoint, Point } from 'neo4j-driver-core'

const point1: Point = new Point(int(1), 2, 3)
const srid1: Integer = point1.srid
const x1: number = point1.x
const y1: number = point1.y
const isInstance1: boolean = point1 instanceof Point

const point2: Point<number> = new Point(1, 2, 3)
const srid2: number = point2.srid
const x2: number = point2.x
const y2: number = point2.y
const isInstance2: boolean = point2 instanceof Point

const point3: Point = new Point(int(1), 2, 3, 4)
const srid3: Integer = point3.srid
const x3: number = point3.x
const y3: number = point3.y
const z3: number | undefined = point3.z
const isInstance3: boolean = point3 instanceof Point

const point4: Point<number> = new Point(1, 2, 3, 4)
const srid4: number = point4.srid
const x4: number = point4.x
const y4: number = point4.y
const z4: number | undefined = point4.z
const isInstance4: boolean = point4 instanceof Point

const isPoint1: boolean = isPoint(point1)
const isPoint2: boolean = isPoint({})
