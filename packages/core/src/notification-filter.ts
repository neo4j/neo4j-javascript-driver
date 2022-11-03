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
import { NotificationCategory, NotificationSeverityLevel } from './result-summary'

type ExcludeUnknown<T> = Exclude<T, 'UNKNOWN'>

type FilterKeys = ExcludeUnknown<NotificationSeverityLevel> | 'ALL'
type FilterInnerKeys = ExcludeUnknown<NotificationCategory> | 'ALL'

type SeverityDotCategoryFilters = { [key in FilterKeys]: { [k in FilterInnerKeys]: NotificationFilter } }

type NotificationFilter =
  'NONE' | 'SERVER_DEFAULT' |
  'ALL.ALL' | 'ALL.DEPRECATION' | 'ALL.GENERIC' | 'ALL.HINT' |
  'ALL.PERFORMANCE' | 'ALL.QUERY' | 'ALL.UNRECOGNIZED' | 'ALL.UNSUPPORTED' |
  'INFORMATION.ALL' | 'INFORMATION.DEPRECATION' | 'INFORMATION.GENERIC' | 'INFORMATION.HINT' |
  'INFORMATION.PERFORMANCE' | 'INFORMATION.QUERY' | 'INFORMATION.UNRECOGNIZED' | 'INFORMATION.UNSUPPORTED' |
  'WARNING.ALL' | 'WARNING.DEPRECATION' | 'WARNING.GENERIC' | 'WARNING.HINT' |
  'WARNING.PERFORMANCE' | 'WARNING.QUERY' | 'WARNING.UNRECOGNIZED' | 'WARNING.UNSUPPORTED'

/**
 * @typedef { 'NONE' | 'SERVER_DEFAULT' |
 * 'ALL.ALL' | 'ALL.DEPRECATION' | 'ALL.GENERIC' | 'ALL.HINT' |
 * 'ALL.PERFORMANCE' | 'ALL.QUERY' | 'ALL.UNRECOGNIZED' | 'ALL.UNSUPPORTED' |
 * 'INFORMATION.ALL' | 'INFORMATION.DEPRECATION' | 'INFORMATION.GENERIC' | 'INFORMATION.HINT' |
 * 'INFORMATION.PERFORMANCE' | 'INFORMATION.QUERY' | 'INFORMATION.UNRECOGNIZED' | 'INFORMATION.UNSUPPORTED' |
 * 'WARNING.ALL' | 'WARNING.DEPRECATION' | 'WARNING.GENERIC' | 'WARNING.HINT' |
 * 'WARNING.PERFORMANCE' | 'WARNING.QUERY' | 'WARNING.UNRECOGNIZED' | 'WARNING.UNSUPPORTED' } NotificationFilter
 */

/**
 * Constants that represents the available notification filters
 *
 * @property {function(): Array<NotificationFilter>} disabled Creates a configuration with notifications disabled
 * @property {function(): Array<NotificationFilter>} serverDefault Creates a configuration for using the server default
 */
const notificationFilter: SeverityDotCategoryFilters & {
  disabled: () => NotificationFilter[]
  serverDefault: () => NotificationFilter[]
} = {
  disabled: () => ['NONE'],
  serverDefault: () => ['SERVER_DEFAULT'],
  ALL: {
    ALL: 'ALL.ALL',
    DEPRECATION: 'ALL.DEPRECATION',
    GENERIC: 'ALL.GENERIC',
    HINT: 'ALL.HINT',
    PERFORMANCE: 'ALL.PERFORMANCE',
    QUERY: 'ALL.QUERY',
    UNRECOGNIZED: 'ALL.UNRECOGNIZED',
    UNSUPPORTED: 'ALL.UNSUPPORTED'
  },
  INFORMATION: {
    ALL: 'INFORMATION.ALL',
    DEPRECATION: 'INFORMATION.DEPRECATION',
    GENERIC: 'INFORMATION.GENERIC',
    HINT: 'INFORMATION.HINT',
    PERFORMANCE: 'INFORMATION.PERFORMANCE',
    QUERY: 'INFORMATION.QUERY',
    UNRECOGNIZED: 'INFORMATION.UNRECOGNIZED',
    UNSUPPORTED: 'INFORMATION.UNSUPPORTED'
  },
  WARNING: {
    ALL: 'WARNING.ALL',
    DEPRECATION: 'WARNING.DEPRECATION',
    GENERIC: 'WARNING.GENERIC',
    HINT: 'WARNING.HINT',
    PERFORMANCE: 'WARNING.PERFORMANCE',
    QUERY: 'WARNING.QUERY',
    UNRECOGNIZED: 'WARNING.UNRECOGNIZED',
    UNSUPPORTED: 'WARNING.UNSUPPORTED'
  }
}

Object.freeze(notificationFilter)

const filters = Object.values(notificationFilter)
  .map(value => {
    if (typeof value === 'function') {
      return value()
    }
    return Object.values(value)
  })
  .reduce((previous, current) => [...previous, ...current], [])

/**
 * @private
 */
function isValidFilter (value: any): boolean {
  return filters.includes(value)
}

export default notificationFilter

export {
  isValidFilter
}

export type {
  NotificationFilter
}
