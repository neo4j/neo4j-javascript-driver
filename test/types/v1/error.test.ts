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

import {Neo4jError, newError, PROTOCOL_ERROR, SERVICE_UNAVAILABLE, SESSION_EXPIRED} from "../../../types/v1/error";

const serviceUnavailable: string = SERVICE_UNAVAILABLE;
const sessionExpired: string = SESSION_EXPIRED;
const protocolError: string = PROTOCOL_ERROR;

const error1: Neo4jError = new Neo4jError("Message");
const error2: Neo4jError = new Neo4jError("Message", "Code");

const error3: Neo4jError = newError("Message");
const error4: Neo4jError = newError("Message", "Code");
