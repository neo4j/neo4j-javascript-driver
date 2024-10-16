/**
 * Copyright (c) "Neo4j"
 * Neo4j Sweden AB [https://neo4j.com]
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
  notificationClassification,
  NotificationClassification,
  notificationFilterMinimumSeverityLevel,
  NotificationFilterMinimumSeverityLevel,
  NotificationFilterDisabledCategory,
  notificationFilterDisabledCategory,
  NotificationFilterDisabledClassification,
  notificationFilterDisabledClassification,
  authTokenManagers
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

const driver5: Driver = driver('bolt://localhost:7687', authTokenManagers.bearer({
  tokenProvider: async () => {
    return {
      token: auth.bearer('bearer token')
    }
  }
}))

const driver6: Driver = driver('bolt://localhost:7687', authTokenManagers.basic({
  tokenProvider: async () => {
    return auth.basic('neo4j', 'password')
  }
}))

const readMode1: string = session.READ
const writeMode1: string = session.WRITE

const writersString: string = routing.WRITE
const readersString: string = routing.READ
const writersRoutingControl: RoutingControl = routing.WRITE
const readersRoutingControl: RoutingControl = routing.READ

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
const topologyCategoryString: string = notificationCategory.TOPOLOGY
const securityCategoryString: string = notificationCategory.SECURITY
const schemaCategoryString: string = notificationCategory.SCHEMA
const genericCategoryString: string = notificationCategory.GENERIC
const unrecognizedCategoryString: string = notificationCategory.UNRECOGNIZED
const unsupportedCategoryString: string = notificationCategory.UNSUPPORTED
const unknownCategoryString: string = notificationCategory.UNKNOWN
const hintCategory: NotificationCategory = notificationCategory.HINT
const deprecationCategory: NotificationCategory = notificationCategory.DEPRECATION
const performanceCategory: NotificationCategory = notificationCategory.PERFORMANCE
const topologyCategory: NotificationCategory = notificationCategory.TOPOLOGY
const securityCategory: NotificationCategory = notificationCategory.SECURITY
const schemaCategory: NotificationCategory = notificationCategory.SCHEMA
const genericCategory: NotificationCategory = notificationCategory.GENERIC
const unrecognizedCategory: NotificationCategory = notificationCategory.UNRECOGNIZED
const unsupportedCategory: NotificationCategory = notificationCategory.UNSUPPORTED
const unknownCategory: NotificationCategory = notificationCategory.UNKNOWN

const hintClassificationString: string = notificationClassification.HINT
const deprecationClassificationString: string = notificationClassification.DEPRECATION
const performanceClassificationString: string = notificationClassification.PERFORMANCE
const topologyClassificationString: string = notificationClassification.TOPOLOGY
const securityClassificationString: string = notificationClassification.SECURITY
const schemaClassificationString: string = notificationClassification.SCHEMA
const genericClassificationString: string = notificationClassification.GENERIC
const unrecognizedClassificationString: string = notificationClassification.UNRECOGNIZED
const unsupportedClassificationString: string = notificationClassification.UNSUPPORTED
const unknownClassificationString: string = notificationClassification.UNKNOWN
const hintClassification: NotificationClassification = notificationClassification.HINT
const deprecationClassification: NotificationClassification = notificationClassification.DEPRECATION
const performanceClassification: NotificationClassification = notificationClassification.PERFORMANCE
const topologyClassification: NotificationClassification = notificationClassification.TOPOLOGY
const securityClassification: NotificationClassification = notificationClassification.SECURITY
const schemaClassification: NotificationClassification = notificationClassification.SCHEMA
const genericClassification: NotificationClassification = notificationClassification.GENERIC
const unrecognizedClassification: NotificationClassification = notificationClassification.UNRECOGNIZED
const unsupportedClassification: NotificationClassification = notificationClassification.UNSUPPORTED
const unknownClassification: NotificationClassification = notificationClassification.UNKNOWN

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

const hintDisabledClassificationString: string = notificationFilterDisabledClassification.HINT
const deprecationDisabledClassificationString: string = notificationFilterDisabledClassification.DEPRECATION
const performanceDisabledClassificationString: string = notificationFilterDisabledClassification.PERFORMANCE
const genericDisabledClassificationString: string = notificationFilterDisabledClassification.GENERIC
const unrecognizedDisabledClassificationString: string = notificationFilterDisabledClassification.UNRECOGNIZED
const unsupportedDisabledClassificationString: string = notificationFilterDisabledClassification.UNSUPPORTED
const hintDisabledClassification: NotificationFilterDisabledClassification = notificationFilterDisabledClassification.HINT
const deprecationDisabledClassification: NotificationFilterDisabledClassification = notificationFilterDisabledClassification.DEPRECATION
const performanceDisabledClassification: NotificationFilterDisabledClassification = notificationFilterDisabledClassification.PERFORMANCE
const genericDisabledClassification: NotificationFilterDisabledClassification = notificationFilterDisabledClassification.GENERIC
const unrecognizedDisabledClassification: NotificationFilterDisabledClassification = notificationFilterDisabledClassification.UNRECOGNIZED
const unsupportedDisabledClassification: NotificationFilterDisabledClassification = notificationFilterDisabledClassification.UNSUPPORTED
