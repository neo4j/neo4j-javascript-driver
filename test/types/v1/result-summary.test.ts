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

import ResultSummary, {
  Notification,
  NotificationPosition,
  Plan,
  ProfiledPlan,
  ServerInfo,
  StatementStatistic
} from "../../../types/v1/result-summary";
import Integer from "../../../types/v1/integer";

const dummy: any = null;

const sum: ResultSummary = dummy;

const stmt = sum.statement;
const stmtText: string = stmt.text;
const stmtParams: object = stmt.parameters;

const str: string = sum.statementType;

const counters: StatementStatistic = sum.counters;

const containsUpdates: boolean = counters.containsUpdates();
const nodesCreated: number = counters.nodesCreated();
const nodesDeleted: number = counters.nodesDeleted();
const relationshipsCreated: number = counters.relationshipsCreated();
const relationshipsDeleted: number = counters.relationshipsDeleted();
const propertiesSet: number = counters.propertiesSet();
const labelsAdded: number = counters.labelsAdded();
const labelsRemoved: number = counters.labelsRemoved();
const indexesAdded: number = counters.indexesAdded();
const indexesRemoved: number = counters.indexesRemoved();
const constraintsAdded: number = counters.constraintsAdded();
const constraintsRemoved: number = counters.constraintsRemoved();

const plan: Plan = sum.plan;
const planOperatorType: string = plan.operatorType;
const planIdentifiers: string[] = plan.identifiers;
const planArguments: { [key: string]: string } = plan.arguments;
const planChildren: Plan[] = plan.children;

const profile: ProfiledPlan = sum.profile;
const profileOperatorType: string = profile.operatorType;
const profileIdentifiers: string[] = profile.identifiers;
const profileArguments: { [key: string]: string } = profile.arguments;
const profileDbHits: number = profile.dbHits;
const profileRows: number = profile.rows;
const profileChildren: ProfiledPlan[] = profile.children;

const notifications: Notification[] = sum.notifications;
const notification: Notification = notifications[0];
const code: string = notification.code;
const title: string = notification.title;
const description: string = notification.description;
const severity: string = notification.severity;
const position1: {} = notification.position;
const position2: NotificationPosition = <NotificationPosition>notification.position;
const offset: number = position2.offset;
const line: number = position2.line;
const column: number = position2.column;

const server: ServerInfo = sum.server;
const address: string = server.address;
const version: string = server.version;

const resultConsumedAfter: Integer = sum.resultConsumedAfter;
const resultAvailableAfter: Integer = sum.resultAvailableAfter;

const hasPlan: boolean = sum.hasPlan();
const hasProfile: boolean = sum.hasProfile();
