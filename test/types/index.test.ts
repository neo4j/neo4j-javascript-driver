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

import neo4j from "../../types/index";
import {Driver} from "../../types/v1/driver";
import Integer from "../../types/v1/integer";
import {Neo4jError} from "../../types/v1/error";

const driver1: Driver = neo4j.driver("bolt+routing://localhost");
const driver2: Driver = neo4j.driver("bolt://localhost:7687", neo4j.auth.basic("neo4j", "password"));

const readSession = driver1.session(neo4j.session.READ);
const writeSession = driver1.session(neo4j.session.WRITE);

const int1: Integer = neo4j.int(42);
const int2: Integer = neo4j.int("42");
const int3: Integer = neo4j.int(neo4j.int(42));
const int4: Integer = neo4j.int({low: 1, high: 1});

const isInt1: boolean = neo4j.isInt({});
const isInt2: boolean = neo4j.isInt(neo4j.int("42"));

const serviceUnavailable: string = neo4j.error.SERVICE_UNAVAILABLE;
const sessionExpired: string = neo4j.error.SESSION_EXPIRED;
const protocolError: string = neo4j.error.PROTOCOL_ERROR;

const error1: Neo4jError = new neo4j.Neo4jError("Error message");
const error2: Neo4jError = new neo4j.Neo4jError("Error message", "Error code");
