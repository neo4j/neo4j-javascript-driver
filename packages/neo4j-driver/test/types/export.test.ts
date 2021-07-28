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

import { Bookmark } from 'neo4j-driver-core/types/internal/bookmark'
import driver, {
  DateTime,
  RxSession,
  RxTransaction,
  RxResult,
  Session,
  ConnectionProvider,
  Record
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
      console.log(level + ' ' + message)
    }
  },
  resolver: (address: string) => [address],
  userAgent: 'my-user-agent'
})

const driverConfiguration1 = driver.driver('driver', undefined, {})

const session = new Session({
  mode: 'READ',
  connectionProvider: new ConnectionProvider(),
  bookmark: Bookmark.empty(),
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
