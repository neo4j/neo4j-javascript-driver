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

/* eslint-disable @typescript-eslint/no-unused-vars */

import { Bookmarks } from 'neo4j-driver-core/types/internal/bookmarks'
import { ConnectionProvider } from 'neo4j-driver-core'
import driver, {
  DateTime,
  RxSession,
  RxTransaction,
  RxResult,
  Session,
  Record,
  types
} from '../../'

const dateTime = DateTime.fromStandardDate(new Date())
const dateTime2 = new DateTime(2, 2, 2, 2, 2, 3, 4, 6, null)

const driverConfiguration0 = driver.driver('driver', undefined, {
  encrypted: 'ENCRYPTION_ON',
  trust: 'TRUST_ALL_CERTIFICATES',
  trustedCertificates: [],
  maxConnectionPoolSize: 100,
  maxConnectionLifetime: 60 * 60 * 1000,
  connectionAcquisitionTimeout: 60000,
  maxTransactionRetryTime: 30000,
  connectionTimeout: 3000,
  disableLosslessIntegers: false,
  logging: {
    level: 'info',
    logger: (level: 'info' | 'warn' | 'error' | 'debug', message?: string) => {
      console.log(level + ' ' + (message ?? ''))
    }
  },
  resolver: (address: string) => [address],
  userAgent: 'my-user-agent'
})

const driverConfiguration1 = driver.driver('driver', undefined, {})

const session = new Session({
  mode: 'READ',
  connectionProvider: new ConnectionProvider(),
  bookmarks: Bookmarks.empty(),
  database: 'default',
  config: {},
  reactive: false,
  fetchSize: 100
})

const dummy: any = null

const rxSession: RxSession = dummy
const rxTransaction: RxTransaction = dummy
const rxResult: RxResult = dummy

const record: Record = new Record(['role'], [124])

const instanceOfNode: boolean = dummy instanceof types.Node
const instanceOfPathSegment: boolean = dummy instanceof types.PathSegment
const instanceOfPath: boolean = dummy instanceof types.Path
const instanceOfRelationship: boolean = dummy instanceof types.Relationship
const instanceOfPoint: boolean = dummy instanceof types.Point
const instanceOfDate: boolean = dummy instanceof types.Date
const instanceOfDateTime: boolean = dummy instanceof types.DateTime
const instanceOfDuration: boolean = dummy instanceof types.Duration
const instanceOfLocalDateTime: boolean = dummy instanceof types.LocalDateTime
const instanceOfLocalTime: boolean = dummy instanceof types.LocalTime
const instanceOfTime: boolean = dummy instanceof types.Time
const instanceOfInteger: boolean = dummy instanceof types.Integer
const instanceOfResult: boolean = dummy instanceof types.Result
const instanceOfResultSummary: boolean = dummy instanceof types.ResultSummary
const instanceOfRecord: boolean = dummy instanceof types.Record
const instanceOfRxSession: boolean = dummy instanceof types.RxSession
const instanceOfRxTransaction: boolean = dummy instanceof types.RxTransaction
const instanceOfRxManagedTransaction: boolean = dummy instanceof types.RxManagedTransaction
const instanceOfRxResult: boolean = dummy instanceof types.RxResult

const instanceOfDriverDriver: boolean = dummy instanceof driver.Driver
const instanceOfDriverNeo4jError: boolean = dummy instanceof driver.Neo4jError
const instanceOfDriverNode: boolean = dummy instanceof driver.Node
const instanceOfDriverRelationship: boolean = dummy instanceof driver.Relationship
const instanceOfDriverUnboundRelationship: boolean = dummy instanceof driver.UnboundRelationship
const instanceOfDriverPathSegment: boolean = dummy instanceof driver.PathSegment
const instanceOfDriverPath: boolean = dummy instanceof driver.Path
const instanceOfDriverInteger: boolean = dummy instanceof driver.Integer
const instanceOfDriverRecord: boolean = dummy instanceof driver.Record
const instanceOfDriverResult: boolean = dummy instanceof driver.Result
const instanceOfDriverResultSummary: boolean = dummy instanceof driver.ResultSummary
const instanceOfDriverPlan: boolean = dummy instanceof driver.Plan
const instanceOfDriverProfiledPlan: boolean = dummy instanceof driver.ProfiledPlan
const instanceOfDriverQueryStatistics: boolean = dummy instanceof driver.QueryStatistics
const instanceOfDriverNotification: boolean = dummy instanceof driver.Notification
const instanceOfDriverServerInfo: boolean = dummy instanceof driver.ServerInfo
const instanceOfDriverSession: boolean = dummy instanceof driver.Session
const instanceOfDriverTransaction: boolean = dummy instanceof driver.Transaction
const instanceOfDriverManagedTransaction: boolean = dummy instanceof driver.ManagedTransaction
const instanceOfDriverPoint: boolean = dummy instanceof driver.Point
const instanceOfDriverDuration: boolean = dummy instanceof driver.Duration
const instanceOfDriverLocalTime: boolean = dummy instanceof driver.LocalTime
const instanceOfDriverTime: boolean = dummy instanceof driver.Time
const instanceOfDriverDate: boolean = dummy instanceof driver.Date
const instanceOfDriverLocalDateTime: boolean = dummy instanceof driver.LocalDateTime
const instanceOfDriverDateTime: boolean = dummy instanceof driver.DateTime
const instanceOfDriverRxSession: boolean = dummy instanceof driver.RxSession
const instanceOfDriverRxTransaction: boolean = dummy instanceof driver.RxTransaction
const instanceOfDriverRxManagedTransaction: boolean = dummy instanceof driver.RxManagedTransaction
const instanceOfDriverRxResult: boolean = dummy instanceof driver.RxResult
