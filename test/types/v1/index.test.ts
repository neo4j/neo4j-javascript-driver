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

import v1, {auth, AuthToken, Config, driver, error, session, spatial, temporal} from "../../../types/v1/index";

import Driver from "../../../types/v1/driver";

const dummy: any = null;

const config: Config = dummy;

const basicAuthToken1: AuthToken = auth.basic("neo4j", "password");
const basicAuthToken2: AuthToken = auth.basic("neo4j", "password", "realm");

const kerberosAuthToken1: AuthToken = auth.kerberos("base64EncodedTicket");

const customAuthToken1: AuthToken = auth.custom("neo4j", "password", "realm", "scheme");
const customAuthToken2: AuthToken = auth.custom("neo4j", "password", "realm", "scheme", {"key": "value"});

const basicAuthToken3: AuthToken = v1.auth.basic("neo4j", "password");
const basicAuthToken4: AuthToken = v1.auth.basic("neo4j", "password", "realm");

const kerberosAuthToken2: AuthToken = v1.auth.kerberos("base64EncodedTicket");

const customAuthToken3: AuthToken = v1.auth.custom("neo4j", "password", "realm", "scheme");
const customAuthToken4: AuthToken = v1.auth.custom("neo4j", "password", "realm", "scheme", {"key": "value"});

const driver1: Driver = driver("bolt://localhost:7687");
const driver2: Driver = driver("bolt://localhost:7687", basicAuthToken1);
const driver3: Driver = driver("bolt://localhost:7687", basicAuthToken1, config);

const driver4: Driver = v1.driver("bolt://localhost:7687");
const driver5: Driver = v1.driver("bolt://localhost:7687", basicAuthToken1);
const driver6: Driver = v1.driver("bolt://localhost:7687", basicAuthToken1, config);

const readMode1: string = session.READ;
const writeMode1: string = session.WRITE;

const readMode2: string = v1.session.READ;
const writeMode2: string = v1.session.WRITE;

const serviceUnavailable1: string = error.SERVICE_UNAVAILABLE;
const sessionExpired1: string = error.SESSION_EXPIRED;
const protocolError1: string = error.PROTOCOL_ERROR;

const serviceUnavailable2: string = v1.error.SERVICE_UNAVAILABLE;
const sessionExpired2: string = v1.error.SESSION_EXPIRED;
const protocolError2: string = v1.error.PROTOCOL_ERROR;

const isNeo4jPoint: boolean = spatial.isPoint({});
const isNeo4jDate: boolean = temporal.isDate({});
const isNeo4jDateTime: boolean = temporal.isDateTime({});
const isNeo4jDuration: boolean = temporal.isDuration({});
const isNeo4jLocalDateTime: boolean = temporal.isLocalDateTime({});
const isNeo4jLocalTime: boolean = temporal.isLocalTime({});
const isNeo4jTime: boolean = temporal.isTime({});
