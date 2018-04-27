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

import Integer, {inSafeRange, int, isInt, toNumber, toString} from "./integer";
import {Node, Path, PathSegment, Relationship, UnboundRelationship} from "./graph-types";
import {isPoint, Point} from "./spatial-types";
import {Date, DateTime, Duration, isDate, isDateTime, isDuration, isLocalDateTime, isLocalTime, isTime, LocalDateTime, LocalTime, Time} from "./temporal-types";
import {Neo4jError, PROTOCOL_ERROR, SERVICE_UNAVAILABLE, SESSION_EXPIRED} from "./error";
import Result, {Observer, StatementResult} from "./result";
import ResultSummary, {Notification, NotificationPosition, Plan, ProfiledPlan, ServerInfo, StatementStatistic} from "./result-summary";
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
  Node: Node;
  Relationship: Relationship;
  UnboundRelationship: UnboundRelationship;
  PathSegment: PathSegment;
  Path: Path;
  Result: Result;
  ResultSummary: ResultSummary;
  Record: Record;
  Point: Point;
  Duration: Duration;
  LocalTime: LocalTime;
  Time: Time;
  Date: Date;
  LocalDateTime: LocalDateTime;
  DateTime: DateTime;
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

declare const spatial: {
  isPoint: typeof isPoint;
};

declare const temporal: {
  isDuration: typeof isDuration;
  isLocalTime: typeof isLocalTime;
  isTime: typeof isTime;
  isDate: typeof isDate;
  isLocalDateTime: typeof isLocalDateTime;
  isDateTime: typeof isDateTime;
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
  spatial: typeof spatial;
  temporal: typeof temporal;
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
  Point: Point;
  isPoint: typeof isPoint;
  Duration: Duration;
  LocalTime: LocalTime;
  Time: Time;
  Date: Date;
  LocalDateTime: LocalDateTime;
  DateTime: DateTime;
  isDuration: typeof isDuration;
  isLocalTime: typeof isLocalTime;
  isTime: typeof isTime;
  isDate: typeof isDate;
  isLocalDateTime: typeof isLocalDateTime;
  isDateTime: typeof isDateTime;
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
  spatial,
  temporal,
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
  Transaction,
  Point,
  isPoint,
  Duration,
  LocalTime,
  Time,
  Date,
  LocalDateTime,
  DateTime,
  isDuration,
  isLocalTime,
  isTime,
  isDate,
  isLocalDateTime,
  isDateTime
}

export default forExport;
