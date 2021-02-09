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

import ResultSummary, {
  Notification,
  NotificationPosition,
  Plan,
  ProfiledPlan,
  ServerInfo,
  QueryStatistic
} from '../../types/result-summary'
import { Integer } from 'neo4j-driver-core'

const dummy: any = null

const sum1: ResultSummary = dummy

const stmt = sum1.query
const stmtText: string = stmt.text
const stmtParams: object = stmt.parameters

const str: string = sum1.queryType

const counters: QueryStatistic = sum1.counters

const containsUpdates: boolean = counters.containsUpdates()
const containsSystemUpdates: boolean = counters.containsSystemUpdates()
const systemUpdates: number = counters.systemUpdates()
const updates: { [key: string]: number } = counters.updates()

const plan: Plan = sum1.plan
const planOperatorType: string = plan.operatorType
const planIdentifiers: string[] = plan.identifiers
const planArguments: { [key: string]: string } = plan.arguments
const planChildren: Plan[] = plan.children

const profile: ProfiledPlan = sum1.profile
const profileOperatorType: string = profile.operatorType
const profileIdentifiers: string[] = profile.identifiers
const profileArguments: { [key: string]: string } = profile.arguments
const profileDbHits: number = profile.dbHits
const profileRows: number = profile.rows
const hasPageCacheStats: boolean = profile.hasPageCacheStats()
const profilePageCacheMisses: number = profile.pageCacheMisses
const profilePageCacheHits: number = profile.pageCacheHits
const profilePageCacheHitRatio: number = profile.pageCacheHitRatio
const time: number = profile.time
const profileChildren: ProfiledPlan[] = profile.children

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
