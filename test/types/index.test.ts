/**
 * Copyright (c) 2002-2019 "Neo4j,"
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

import neo4j from "../../types/index";

const driver1: neo4j.Driver = neo4j.driver("bolt+routing://localhost");
const driver2: neo4j.Driver = neo4j.driver("bolt://localhost:7687", neo4j.auth.basic("neo4j", "password"));

const sessionModeRead: string = neo4j.session.READ;
const sessionModeWrite: string = neo4j.session.WRITE;

const readSession = driver1.session(neo4j.session.READ);
const writeSession = driver1.session(neo4j.session.WRITE);

const int1: neo4j.Integer = neo4j.int(42);
const int2: neo4j.Integer = neo4j.int("42");
const int3: neo4j.Integer = neo4j.int(neo4j.int(42));
const int4: neo4j.Integer = neo4j.int({low: 1, high: 1});

const isInt1: boolean = neo4j.isInt({});
const isInt2: boolean = neo4j.isInt(neo4j.int("42"));

const toNumber1: number = neo4j.integer.toNumber(1);
const toNumber2: number = neo4j.integer.toNumber("1");
const toNumber3: number = neo4j.integer.toNumber({high: 0, low: 0});
const toNumber4: number = neo4j.integer.toNumber(int1);

const toString1: string = neo4j.integer.toString(1);
const toString2: string = neo4j.integer.toString("1");
const toString3: string = neo4j.integer.toString({high: 0, low: 0});
const toString4: string = neo4j.integer.toString(int1);

const inSafeRange1: boolean = neo4j.integer.inSafeRange(1);
const inSafeRange2: boolean = neo4j.integer.inSafeRange("1");
const inSafeRange3: boolean = neo4j.integer.inSafeRange({high: 0, low: 0});
const inSafeRange4: boolean = neo4j.integer.inSafeRange(int1);

const isPoint1: boolean = neo4j.spatial.isPoint({});
const isPoint2: boolean = neo4j.isPoint({});

const isDuration1: boolean = neo4j.temporal.isDuration({});
const isDuration2: boolean = neo4j.isDuration({});

const isLocalTime1: boolean = neo4j.temporal.isLocalTime({});
const isLocalTime2: boolean = neo4j.isLocalTime({});

const isTime1: boolean = neo4j.temporal.isTime({});
const isTime2: boolean = neo4j.isTime({});

const isDate1: boolean = neo4j.temporal.isDate({});
const isDate2: boolean = neo4j.isDate({});

const isLocalDateTime1: boolean = neo4j.temporal.isLocalDateTime({});
const isLocalDateTime2: boolean = neo4j.isLocalDateTime({});

const isDateTime1: boolean = neo4j.temporal.isDateTime({});
const isDateTime2: boolean = neo4j.isDateTime({});

const serviceUnavailable: string = neo4j.error.SERVICE_UNAVAILABLE;
const sessionExpired: string = neo4j.error.SESSION_EXPIRED;
const protocolError: string = neo4j.error.PROTOCOL_ERROR;

const error1: neo4j.Neo4jError = new neo4j.Neo4jError("Error message");
const error2: neo4j.Neo4jError = new neo4j.Neo4jError("Error message", "Error code");

const result: neo4j.Result = readSession.run("");

result.then(value => {
  const resultSummary: neo4j.ResultSummary = value.summary;
});

const point: neo4j.Point = new neo4j.types.Point(int1, 1, 2, 3);
const duration: neo4j.Duration = new neo4j.types.Duration(int1, int1, int1, int1);
const localTime: neo4j.LocalTime = new neo4j.types.LocalTime(int1, int1, int1, int1);
const time: neo4j.Time = new neo4j.types.Time(int1, int1, int1, int1, int1);
const date: neo4j.Date = new neo4j.types.Date(int1, int1, int1);
const localDateTime: neo4j.LocalDateTime = new neo4j.types.LocalDateTime(int1, int1, int1, int1, int1, int1, int1);
const dateTime: neo4j.DateTime = new neo4j.types.DateTime(int1, int1, int1, int1, int1, int1, int1, int1);
