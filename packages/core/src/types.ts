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

/**
 * @private
 */
export type Query = string | String | { text: string; parameters?: any }

export type EncryptionLevel = 'ENCRYPTION_ON' | 'ENCRYPTION_OFF'

export type LogLevel = 'error' | 'warn' | 'info' | 'debug'

export type LoggerFunction = (level: LogLevel, message: string) => unknown

export type SessionMode = 'READ' | 'WRITE'

export interface LoggingConfig {
  level?: LogLevel
  logger: LoggerFunction
}

export type TrustStrategy =
  | 'TRUST_ALL_CERTIFICATES'
  | 'TRUST_CUSTOM_CA_SIGNED_CERTIFICATES'
  | 'TRUST_SYSTEM_CA_SIGNED_CERTIFICATES'

export type Parameters = { [key: string]: any }
export interface AuthToken {
  scheme: string
  principal: string
  credentials: string
  realm?: string
  parameters?: Parameters
}
export interface Config {
  encrypted?: boolean | EncryptionLevel
  trust?: TrustStrategy
  trustedCertificates?: string[]
  knownHosts?: string
  fetchSize?: number
  maxConnectionPoolSize?: number
  maxTransactionRetryTime?: number
  maxConnectionLifetime?: number
  connectionAcquisitionTimeout?: number
  connectionTimeout?: number
  disableLosslessIntegers?: boolean
  useBigInt?: boolean
  logging?: LoggingConfig
  resolver?: (address: string) => string[] | Promise<string[]>
  userAgent?: string
}
