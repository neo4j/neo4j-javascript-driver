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

import {
  Integer,
  ResultSummary,
  Notification,
  NotificationPosition,
  Plan,
  ProfiledPlan,
  ServerInfo,
  QueryStatistics
} from 'neo4j-driver-core'

const dummy: any = null

const sum1: ResultSummary = dummy

const stmt = sum1.query
const stmtText: string = stmt.text
const stmtParams: object = stmt.parameters

const str: string = sum1.queryType

const counters: QueryStatistics = sum1.counters

const containsUpdates: boolean = counters.containsUpdates()
const containsSystemUpdates: boolean = counters.containsSystemUpdates()
const systemUpdates: number = counters.systemUpdates()
const updates: { [key: string]: number } = counters.updates()

const plan: Plan | undefined = sum1.plan
const planOperatorType: string | undefined = plan?.operatorType
const planIdentifiers: string[] | undefined = plan?.identifiers
const planArguments: { [key: string]: string } | undefined = plan?.arguments
const planChildren: Plan[] | undefined = plan?.children

const profile: ProfiledPlan | undefined = sum1.profile
const profileOperatorType: string | undefined = profile?.operatorType
const profileIdentifiers: string[] | undefined = profile?.identifiers
const profileArguments: { [key: string]: string } | undefined =
  profile?.arguments
const profileDbHits: number | undefined = profile?.dbHits
const profileRows: number | undefined = profile?.rows
const hasPageCacheStats: boolean | undefined = profile?.hasPageCacheStats()
const profilePageCacheMisses: number | undefined = profile?.pageCacheMisses
const profilePageCacheHits: number | undefined = profile?.pageCacheHits
const profilePageCacheHitRatio: number | undefined = profile?.pageCacheHitRatio
const time: number | undefined = profile?.time
const profileChildren: ProfiledPlan[] | undefined = profile?.children

const notifications: Notification[] = sum1.notifications
const notification: Notification = notifications[0]
const code: string = notification.code
const title: string = notification.title
const description: string = notification.description
const severity: string = notification.severity
const position1: NotificationPosition | {} = notification.position
const position2: NotificationPosition = <NotificationPosition>(
  notification.position
)
const offset: number = position2.offset
const line: number = position2.line
const column: number = position2.column

const server: ServerInfo = sum1.server
const address: string = server.address
const version: string = server.version

const resultConsumedAfter1: Integer = sum1.resultConsumedAfter
const resultAvailableAfter1: Integer = sum1.resultAvailableAfter

const hasPlan: boolean = sum1.hasPlan()
const hasProfile: boolean = sum1.hasProfile()

const sum2: ResultSummary<number> = dummy
const resultConsumedAfter2: number = sum2.resultConsumedAfter
const resultAvailableAfter2: number = sum2.resultAvailableAfter

const sum3: ResultSummary<Integer> = dummy
const resultConsumedAfter3: Integer = sum3.resultConsumedAfter
const resultAvailableAfter3: Integer = sum3.resultAvailableAfter
