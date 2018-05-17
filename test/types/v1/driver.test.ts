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

import Driver, {AuthToken, Config, EncryptionLevel, LoadBalancingStrategy, READ, SessionMode, TrustStrategy, WRITE} from "../../../types/v1/driver";
import {Parameters} from "../../../types/v1/statement-runner";
import Session from "../../../types/v1/session";
import {Neo4jError} from "../../../types/v1/error";
import {ServerInfo} from "../../../types/v1/result-summary";

const dummy: any = null;

const authToken: AuthToken = dummy;
const scheme: string = authToken.scheme;
const principal: string = authToken.principal;
const credentials: string = authToken.credentials;
const realm1: undefined = <undefined>authToken.realm;
const realm2: string = <string>authToken.realm;
const parameters1: undefined = <undefined>authToken.parameters;
const parameters2: { [key: string]: any } = <{ [key: string]: any }>authToken.parameters;
const parameters3: Parameters = <Parameters>authToken.parameters;

const encryptionLevel: EncryptionLevel = dummy;
const encryptionLevelStr: string = encryptionLevel;

const trustStrategy: TrustStrategy = dummy;
const trustStrategyStr: string = trustStrategy;

const config: Config = dummy;
const encrypted: undefined | boolean | EncryptionLevel = config.encrypted;
const trust: undefined | TrustStrategy = config.trust;
const trustedCertificates: undefined | string[] = config.trustedCertificates;
const knownHosts: undefined | string = config.knownHosts;
const connectionPoolSize: undefined | number = config.connectionPoolSize;
const maxTransactionRetryTime: undefined | number = config.maxTransactionRetryTime;
const loadBalancingStrategy1: undefined | LoadBalancingStrategy = config.loadBalancingStrategy;
const loadBalancingStrategy2: undefined | string = config.loadBalancingStrategy;
const maxConnectionLifetime: undefined | number = config.maxConnectionLifetime;
const connectionTimeout: undefined | number = config.connectionTimeout;
const disableLosslessIntegers: undefined | boolean = config.disableLosslessIntegers;

const sessionMode: SessionMode = dummy;
const sessionModeStr: string = sessionMode;

const readMode1: SessionMode = READ;
const readMode2: string = READ;

const writeMode1: SessionMode = WRITE;
const writeMode2: string = WRITE;

const driver: Driver = dummy;

const session1: Session = driver.session();
const session2: Session = driver.session("READ");
const session3: Session = driver.session(READ);
const session4: Session = driver.session("WRITE");
const session5: Session = driver.session(WRITE);
const session6: Session = driver.session(READ, "bookmark1");
const session7: Session = driver.session(WRITE, "bookmark2");

session1.run("RETURN 1").then(result => {
  session1.close();
  result.records.forEach(record => {
    console.log(record);
  });
});

const close: void = driver.close();

driver.onCompleted = (serverInfo: ServerInfo) => {
  console.log(serverInfo.version);
  console.log(serverInfo.address);
};

driver.onCompleted({version: "Neo4j/3.2.0", address: "localhost:7687"});

driver.onError = (error: Neo4jError) => {
  console.log(error);
};

driver.onError(new Neo4jError("message", "code"));
