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
  spatial,
  temporal,
  DateTime,
  notificationSeverityLevel,
  NotificationSeverityLevel,
  notificationCategory,
  NotificationCategory,
  notificationFilter,
  NotificationFilter
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

const unknownSeverityString: string = notificationSeverityLevel.UNKNOWN
const warningSeverityString: string = notificationSeverityLevel.WARNING
const informationSeverityString: string = notificationSeverityLevel.INFORMATION
const unknownSeverity: NotificationSeverityLevel = notificationSeverityLevel.UNKNOWN
const warningSeverity: NotificationSeverityLevel = notificationSeverityLevel.WARNING
const informationSeverity: NotificationSeverityLevel = notificationSeverityLevel.INFORMATION

const hintCategoryString: string = notificationCategory.HINT
const deprecationCategoryString: string = notificationCategory.DEPRECATION
const performanceCategoryString: string = notificationCategory.PERFORMANCE
const queryCategoryString: string = notificationCategory.QUERY
const genericCategoryString: string = notificationCategory.GENERIC
const unrecognizedCategoryString: string = notificationCategory.UNRECOGNIZED
const unsupportedCategoryString: string = notificationCategory.UNSUPPORTED
const unknownCategoryString: string = notificationCategory.UNKNOWN
const hintCategory: NotificationCategory = notificationCategory.HINT
const deprecationCategory: NotificationCategory = notificationCategory.DEPRECATION
const performanceCategory: NotificationCategory = notificationCategory.PERFORMANCE
const queryCategory: NotificationCategory = notificationCategory.QUERY
const genericCategory: NotificationCategory = notificationCategory.GENERIC
const unrecognizedCategory: NotificationCategory = notificationCategory.UNRECOGNIZED
const unsupportedCategory: NotificationCategory = notificationCategory.UNSUPPORTED
const unknownCategory: NotificationCategory = notificationCategory.UNKNOWN

const allAllString: string = notificationFilter.ALL.ALL
const allDeprecationString: string = notificationFilter.ALL.DEPRECATION
const allPerformanceString: string = notificationFilter.ALL.PERFORMANCE
const allGenericString: string = notificationFilter.ALL.GENERIC
const allUnrecognizedString: string = notificationFilter.ALL.UNRECOGNIZED
const allUnsupportedString: string = notificationFilter.ALL.UNSUPPORTED
const allQueryString: string = notificationFilter.ALL.QUERY
const allHintString: string = notificationFilter.ALL.HINT

const allAllFilter: NotificationFilter = notificationFilter.ALL.ALL
const allDeprecationFilter: NotificationFilter = notificationFilter.ALL.DEPRECATION
const allPerformanceFilter: NotificationFilter = notificationFilter.ALL.PERFORMANCE
const allGenericFilter: NotificationFilter = notificationFilter.ALL.GENERIC
const allUnrecognizedFilter: NotificationFilter = notificationFilter.ALL.UNRECOGNIZED
const allUnsupportedFilter: NotificationFilter = notificationFilter.ALL.UNSUPPORTED
const allQueryFilter: NotificationFilter = notificationFilter.ALL.QUERY
const allHintFilter: NotificationFilter = notificationFilter.ALL.HINT

const informationAllString: string = notificationFilter.INFORMATION.ALL
const informationDeprecationString: string = notificationFilter.INFORMATION.DEPRECATION
const informationPerformanceString: string = notificationFilter.INFORMATION.PERFORMANCE
const informationGenericString: string = notificationFilter.INFORMATION.GENERIC
const informationUnrecognizedString: string = notificationFilter.INFORMATION.UNRECOGNIZED
const informationUnsupportedString: string = notificationFilter.INFORMATION.UNSUPPORTED
const informationQueryString: string = notificationFilter.INFORMATION.QUERY
const informationHintString: string = notificationFilter.INFORMATION.HINT

const informationAllFilter: NotificationFilter = notificationFilter.INFORMATION.ALL
const informationDeprecationFilter: NotificationFilter = notificationFilter.INFORMATION.DEPRECATION
const informationPerformanceFilter: NotificationFilter = notificationFilter.INFORMATION.PERFORMANCE
const informationGenericFilter: NotificationFilter = notificationFilter.INFORMATION.GENERIC
const informationUnrecognizedFilter: NotificationFilter = notificationFilter.INFORMATION.UNRECOGNIZED
const informationUnsupportedFilter: NotificationFilter = notificationFilter.INFORMATION.UNSUPPORTED
const informationQueryFilter: NotificationFilter = notificationFilter.INFORMATION.QUERY
const informationHintFilter: NotificationFilter = notificationFilter.INFORMATION.HINT

const warningAllString: string = notificationFilter.WARNING.ALL
const warningDeprecationString: string = notificationFilter.WARNING.DEPRECATION
const warningPerformanceString: string = notificationFilter.WARNING.PERFORMANCE
const warningGenericString: string = notificationFilter.WARNING.GENERIC
const warningUnrecognizedString: string = notificationFilter.WARNING.UNRECOGNIZED
const warningUnsupportedString: string = notificationFilter.WARNING.UNSUPPORTED
const warningQueryString: string = notificationFilter.WARNING.QUERY
const warningHintString: string = notificationFilter.WARNING.HINT

const warningAllFilter: NotificationFilter = notificationFilter.WARNING.ALL
const warningDeprecationFilter: NotificationFilter = notificationFilter.WARNING.DEPRECATION
const warningPerformanceFilter: NotificationFilter = notificationFilter.WARNING.PERFORMANCE
const warningGenericFilter: NotificationFilter = notificationFilter.WARNING.GENERIC
const warningUnrecognizedFilter: NotificationFilter = notificationFilter.WARNING.UNRECOGNIZED
const warningUnsupportedFilter: NotificationFilter = notificationFilter.WARNING.UNSUPPORTED
const warningQueryFilter: NotificationFilter = notificationFilter.WARNING.QUERY
const warningHintFilter: NotificationFilter = notificationFilter.WARNING.HINT
