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
  auth,
  AuthToken,
  Config,
  driver,
  error,
  session,
  spatial,
  temporal,
  DateTime
} from '../../types/index'

import Driver from '../../types/driver'

const dummy: any = null

const config: Config = dummy

const basicAuthToken1: AuthToken = auth.basic('neo4j', 'password')
const basicAuthToken2: AuthToken = auth.basic('neo4j', 'password', 'realm')

const kerberosAuthToken1: AuthToken = auth.kerberos('base64EncodedTicket')
const bearerAuthToken1: AuthToken = auth.bearer('base64EncodedToken')

const customAuthToken1: AuthToken = auth.custom(
  'neo4j',
  'password',
  'realm',
  'scheme'
)
const customAuthToken2: AuthToken = auth.custom(
  'neo4j',
  'password',
  'realm',
  'scheme',
  { key: 'value' }
)

const driver1: Driver = driver('bolt://localhost:7687')
const driver2: Driver = driver('bolt://localhost:7687', basicAuthToken1)
const driver3: Driver = driver('bolt://localhost:7687', basicAuthToken1, config)

const address1 = 'db-1.internal:7687'
const address2 = 'db-2.internal:7687'
const driver4: Driver = driver(
  'bolt://localhost',
  auth.basic('neo4j', 'password'),
  {
    resolver: address => Promise.resolve([address1, address2])
  }
)

const readMode1: string = session.READ
const writeMode1: string = session.WRITE

const serviceUnavailable1: string = error.SERVICE_UNAVAILABLE
const sessionExpired1: string = error.SESSION_EXPIRED
const protocolError1: string = error.PROTOCOL_ERROR

const isNeo4jPoint: boolean = spatial.isPoint({})
const isNeo4jDate: boolean = temporal.isDate({})
const isNeo4jDateTime: boolean = temporal.isDateTime({})
const isNeo4jDuration: boolean = temporal.isDuration({})
const isNeo4jLocalDateTime: boolean = temporal.isLocalDateTime({})
const isNeo4jLocalTime: boolean = temporal.isLocalTime({})
const isNeo4jTime: boolean = temporal.isTime({})
const dateTime = DateTime.fromStandardDate(new Date())
