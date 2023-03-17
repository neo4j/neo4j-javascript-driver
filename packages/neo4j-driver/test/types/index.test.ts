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

import {
  auth,
  AuthToken,
  Config,
  driver,
  error,
  session,
  routing,
  spatial,
  temporal,
  DateTime,
  graph,
  isNode,
  isPath,
  isPathSegment,
  isRelationship,
  isUnboundRelationship,
  RoutingControl,
  notificationSeverityLevel,
  NotificationSeverityLevel,
  notificationCategory,
  NotificationCategory,
  notificationFilterMinimumSeverityLevel,
  NotificationFilterMinimumSeverityLevel,
  NotificationFilterDisabledCategory,
  notificationFilterDisabledCategory
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
    resolver: async address => await Promise.resolve([address1, address2])
  }
)

const readMode1: string = session.READ
const writeMode1: string = session.WRITE

const writersString: string = routing.WRITERS
const readersString: string = routing.READERS
const writersRoutingControl: RoutingControl = routing.WRITERS
const readersRoutingControl: RoutingControl = routing.READERS

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

const graphIsNode: boolean = graph.isNode({})
const graphIsPath: boolean = graph.isPath({})
const graphIsPathSegment: boolean = graph.isPathSegment({})
const graphIsRelationship: boolean = graph.isRelationship({})
const graphIsUnboundRelationship: boolean = graph.isUnboundRelationship({})

const neo4jIsNode: boolean = isNode({})
const neo4jIsPath: boolean = isPath({})
const neo4jIsPathSegment: boolean = isPathSegment({})
const neo4jIsRelationship: boolean = isRelationship({})
const neo4jIsUnboundRelationship: boolean = isUnboundRelationship({})

const unknownSeverityString: string = notificationSeverityLevel.UNKNOWN
const warningSeverityString: string = notificationSeverityLevel.WARNING
const informationSeverityString: string = notificationSeverityLevel.INFORMATION
const unknownSeverity: NotificationSeverityLevel = notificationSeverityLevel.UNKNOWN
const warningSeverity: NotificationSeverityLevel = notificationSeverityLevel.WARNING
const informationSeverity: NotificationSeverityLevel = notificationSeverityLevel.INFORMATION

const hintCategoryString: string = notificationCategory.HINT
const deprecationCategoryString: string = notificationCategory.DEPRECATION
const performanceCategoryString: string = notificationCategory.PERFORMANCE
const genericCategoryString: string = notificationCategory.GENERIC
const unrecognizedCategoryString: string = notificationCategory.UNRECOGNIZED
const unsupportedCategoryString: string = notificationCategory.UNSUPPORTED
const unknownCategoryString: string = notificationCategory.UNKNOWN
const hintCategory: NotificationCategory = notificationCategory.HINT
const deprecationCategory: NotificationCategory = notificationCategory.DEPRECATION
const performanceCategory: NotificationCategory = notificationCategory.PERFORMANCE
const genericCategory: NotificationCategory = notificationCategory.GENERIC
const unrecognizedCategory: NotificationCategory = notificationCategory.UNRECOGNIZED
const unsupportedCategory: NotificationCategory = notificationCategory.UNSUPPORTED
const unknownCategory: NotificationCategory = notificationCategory.UNKNOWN

const offNotificationFilterMinimumSeverityLevelString: string = notificationFilterMinimumSeverityLevel.OFF
const warningNotificationFilterMinimumSeverityLevelString: string = notificationFilterMinimumSeverityLevel.WARNING
const infoNotificationFilterMinimumSeverityLevelString: string = notificationFilterMinimumSeverityLevel.INFORMATION
const offNotificationFilterMinimumSeverityLevel: NotificationFilterMinimumSeverityLevel = notificationFilterMinimumSeverityLevel.OFF
const warningNotificationFilterMinimumSeverityLevel: NotificationFilterMinimumSeverityLevel = notificationFilterMinimumSeverityLevel.WARNING
const infoNotificationFilterMinimumSeverityLevel: NotificationFilterMinimumSeverityLevel = notificationFilterMinimumSeverityLevel.INFORMATION

const hintDisabledCategoryString: string = notificationFilterDisabledCategory.HINT
const deprecationDisabledCategoryString: string = notificationFilterDisabledCategory.DEPRECATION
const performanceDisabledCategoryString: string = notificationFilterDisabledCategory.PERFORMANCE
const genericDisabledCategoryString: string = notificationFilterDisabledCategory.GENERIC
const unrecognizedDisabledCategoryString: string = notificationFilterDisabledCategory.UNRECOGNIZED
const unsupportedDisabledCategoryString: string = notificationFilterDisabledCategory.UNSUPPORTED
const hintDisabledCategory: NotificationFilterDisabledCategory = notificationFilterDisabledCategory.HINT
const deprecationDisabledCategory: NotificationFilterDisabledCategory = notificationFilterDisabledCategory.DEPRECATION
const performanceDisabledCategory: NotificationFilterDisabledCategory = notificationFilterDisabledCategory.PERFORMANCE
const genericDisabledCategory: NotificationFilterDisabledCategory = notificationFilterDisabledCategory.GENERIC
const unrecognizedDisabledCategory: NotificationFilterDisabledCategory = notificationFilterDisabledCategory.UNRECOGNIZED
const unsupportedDisabledCategory: NotificationFilterDisabledCategory = notificationFilterDisabledCategory.UNSUPPORTED
