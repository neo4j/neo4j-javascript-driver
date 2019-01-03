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

import Integer from "./integer";
import {NumberOrInteger} from "./graph-types";

declare interface ResultSummary<T extends NumberOrInteger = Integer> {
  statement: { text: string, parameters: { [key: string]: any } };
  statementType: string;
  counters: StatementStatistic;
  plan: Plan;
  profile: ProfiledPlan;
  notifications: Notification[];
  server: ServerInfo;
  resultConsumedAfter: T;
  resultAvailableAfter: T;

  hasPlan(): boolean;

  hasProfile(): boolean;
}

declare interface Plan {
  operatorType: string;
  identifiers: string[];
  arguments: { [key: string]: string };
  children: Plan[];
}

declare interface ProfiledPlan {
  operatorType: string;
  identifiers: string[];
  arguments: { [key: string]: string };
  dbHits: number;
  rows: number;
  children: ProfiledPlan[];
}

declare interface StatementStatistic {
  containsUpdates(): boolean;

  nodesCreated(): number;

  nodesDeleted(): number;

  relationshipsCreated(): number;

  relationshipsDeleted(): number;

  propertiesSet(): number;

  labelsAdded(): number;

  labelsRemoved(): number;

  indexesAdded(): number;

  indexesRemoved(): number;

  constraintsAdded(): number;

  constraintsRemoved(): number;
}

declare type NotificationPosition = { offset: number; line: number; column: number; }

declare interface Notification {
  code: string;
  title: string;
  description: string;
  severity: string;
  position: NotificationPosition | {};
}

declare interface ServerInfo {
  address: string;
  version: string;
}

declare const statementType: {
  READ_ONLY: "r";
  READ_WRITE: "rw";
  WRITE_ONLY: "w";
  SCHEMA_WRITE: "s";
};

export {statementType, Plan, ProfiledPlan, StatementStatistic, Notification, ServerInfo, NotificationPosition}

export default ResultSummary;
