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

import Integer, {inSafeRange, int, isInt, toNumber, toString} from "./integer";
import {Node, Path, PathSegment, Relationship, UnboundRelationship} from "./graph-types";
import {Neo4jError, PROTOCOL_ERROR, SERVICE_UNAVAILABLE, SESSION_EXPIRED} from "./error";
import Result, {Observer, StatementResult} from "./result";
import ResultSummary, {
  Notification,
  NotificationPosition,
  Plan,
  ProfiledPlan,
  ServerInfo,
  StatementStatistic
} from "./result-summary";
import Record from "./record";
import Session from "./session";
import {AuthToken, Config, Driver, EncryptionLevel, READ, SessionMode, TrustStrategy, WRITE} from "./driver";
import Transaction from "./transaction";
import {Parameters} from "./statement-runner";

declare const auth: {
  basic: (username: string,
          password: string,
          realm?: string) => AuthToken,

  kerberos: (base64EncodedTicket: string) => AuthToken,

  custom: (principal: string,
           credentials: string,
           realm: string,
           scheme: string,
           parameters?: Parameters) => AuthToken,
};

declare function driver(url: string,
                        authToken?: AuthToken,
                        config?: Config): Driver;

declare const types: {
  Node: typeof Node;
  Relationship: typeof Relationship;
  UnboundRelationship: typeof UnboundRelationship;
  PathSegment: typeof PathSegment;
  Path: typeof Path;
  Result: Result;
  ResultSummary: ResultSummary;
  Record: typeof Record;
};

declare const session: {
  READ: typeof READ;
  WRITE: typeof WRITE;
};

declare const error: {
  SERVICE_UNAVAILABLE: typeof SERVICE_UNAVAILABLE;
  SESSION_EXPIRED: typeof SESSION_EXPIRED;
  PROTOCOL_ERROR: typeof PROTOCOL_ERROR;
};

declare const integer: {
  toNumber: typeof toNumber;
  toString: typeof toString;
  inSafeRange: typeof inSafeRange;
};

/*
 Both default and non-default exports declare all visible types so that they can be used in client code like this:

 import neo4j from "neo4j-driver";
 const driver: neo4j.Driver = neo4j.driver("bolt://localhost");
 const session: neo4j.Session = driver.session();
 ...
*/

declare const forExport: {
  driver: typeof driver;
  int: typeof int;
  isInt: typeof isInt;
  integer: typeof integer;
  auth: typeof auth;
  types: typeof types;
  session: typeof session;
  error: typeof error;
  Driver: Driver;
  AuthToken: AuthToken;
  Config: Config;
  EncryptionLevel: EncryptionLevel;
  TrustStrategy: TrustStrategy;
  SessionMode: SessionMode;
  Neo4jError: Neo4jError;
  Node: Node;
  Relationship: Relationship;
  UnboundRelationship: UnboundRelationship;
  PathSegment: PathSegment;
  Path: Path;
  Integer: Integer;
  Record: Record;
  Result: Result;
  StatementResult: StatementResult;
  Observer: Observer;
  ResultSummary: ResultSummary;
  Plan: Plan,
  ProfiledPlan: ProfiledPlan,
  StatementStatistic: StatementStatistic,
  Notification: Notification,
  ServerInfo: ServerInfo,
  NotificationPosition: NotificationPosition,
  Session: Session;
  Transaction: Transaction;
};

export {
  driver,
  int,
  isInt,
  integer,
  auth,
  types,
  session,
  error,
  Driver,
  AuthToken,
  Config,
  EncryptionLevel,
  TrustStrategy,
  SessionMode,
  Neo4jError,
  Node,
  Relationship,
  UnboundRelationship,
  PathSegment,
  Path,
  Integer,
  Record,
  Result,
  StatementResult,
  Observer,
  ResultSummary,
  Plan,
  ProfiledPlan,
  StatementStatistic,
  Notification,
  ServerInfo,
  NotificationPosition,
  Session,
  Transaction
}

export default forExport;
