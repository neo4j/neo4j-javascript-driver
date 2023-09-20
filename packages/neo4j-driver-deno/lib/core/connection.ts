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
/* eslint-disable @typescript-eslint/promise-function-async */

import { Bookmarks } from './internal/bookmarks.ts'
import { AccessMode, TelemetryApis } from './internal/constants.ts'
import { ResultStreamObserver } from './internal/observers.ts'
import { TxConfig } from './internal/tx-config.ts'
import NotificationFilter from './notification-filter.ts'

interface ApiTelemetryConfig {
  api?: TelemetryApis
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
  beginTransaction (config: BeginTransactionConfig): ResultStreamObserver {
    throw new Error('Not implemented')
  }

  run (query: string, parameters?: Record<string, unknown>, config?: RunQueryConfig): ResultStreamObserver {
    throw new Error('Not implemented')
  }

  commitTransaction (config: CommitTransactionConfig): ResultStreamObserver {
    throw new Error('Not implemented')
  }

  rollbackTransaction (config: RollbackConnectionConfig): ResultStreamObserver {
    throw new Error('Not implemented')
  }

  resetAndFlush (): Promise<void> {
    throw new Error('Not implemented')
  }

  isOpen (): boolean {
    throw new Error('Not implemented')
  }

  getProtocolVersion (): number {
    throw new Error('Not implemented')
  }

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
