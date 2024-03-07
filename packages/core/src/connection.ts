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
/* eslint-disable @typescript-eslint/promise-function-async */

import { Bookmarks } from './internal/bookmarks'
import { AccessMode, TelemetryApis } from './internal/constants'
import { ResultStreamObserver } from './internal/observers'
import { TxConfig } from './internal/tx-config'
import NotificationFilter from './notification-filter'

interface ApiTelemetryConfig<Apis extends TelemetryApis = TelemetryApis> {
  api: Apis
  onTelemetrySuccess?: () => void
}

interface HasApiTelemetry {
  apiTelemetryConfig?: ApiTelemetryConfig
}

interface HasBeforeErrorAndAfterComplete {
  beforeError?: (error: Error) => void
  afterComplete?: (metadata: unknown) => void
}

interface BeginTransactionConfig extends HasBeforeErrorAndAfterComplete, HasApiTelemetry {
  bookmarks: Bookmarks
  txConfig: TxConfig
  mode?: AccessMode
  database?: string
  impersonatedUser?: string
  notificationFilter?: NotificationFilter
}

interface CommitTransactionConfig extends HasBeforeErrorAndAfterComplete {

}

interface RollbackConnectionConfig extends HasBeforeErrorAndAfterComplete {

}

interface RunQueryConfig extends BeginTransactionConfig {
  fetchSize: number
  highRecordWatermark: number
  lowRecordWatermark: number
  reactive: boolean
}

/**
 * Interface which defines a connection for the core driver object.
 *
 *
 * This connection exposes only methods used by the code module.
 * Methods with connection implementation details can be defined and used
 * by the implementation layer.
 *
 * @private
 * @interface
 */
class Connection {
  /**
   *
   * @param config
   * @returns {ResultStreamObserver}
   */
  beginTransaction (config: BeginTransactionConfig): ResultStreamObserver {
    throw new Error('Not implemented')
  }

  /**
   *
   * @param query
   * @param parameters
   * @param config
   * @returns {ResultStreamObserver}
   */
  run (query: string, parameters?: Record<string, unknown>, config?: RunQueryConfig): ResultStreamObserver {
    throw new Error('Not implemented')
  }

  /**
   *
   * @param config
   * @returns {ResultStreamObserver}
   */
  commitTransaction (config: CommitTransactionConfig): ResultStreamObserver {
    throw new Error('Not implemented')
  }

  /**
   *
   * @param config
   * @returns {ResultStreamObserver}
   */
  rollbackTransaction (config: RollbackConnectionConfig): ResultStreamObserver {
    throw new Error('Not implemented')
  }

  /**
   *
   * @returns {Promise<void>}
   */
  resetAndFlush (): Promise<void> {
    throw new Error('Not implemented')
  }

  /**
   *
   * @returns {boolean}
   */
  isOpen (): boolean {
    throw new Error('Not implemented')
  }

  /**
   *
   * @returns {number}
   */
  getProtocolVersion (): number {
    throw new Error('Not implemented')
  }

  /**
   *
   * @returns {boolean}
   */
  hasOngoingObservableRequests (): boolean {
    throw new Error('Not implemented')
  }
}

export default Connection

export type {
  BeginTransactionConfig,
  CommitTransactionConfig,
  RollbackConnectionConfig,
  RunQueryConfig,
  ApiTelemetryConfig
}
