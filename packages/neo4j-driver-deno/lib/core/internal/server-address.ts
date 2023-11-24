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
import { assertNumber, assertString } from './util.ts'
import * as urlUtil from './url-util.ts'

export class ServerAddress {
  private readonly _host: string
  private readonly _resolved: string | null
  private readonly _port: number
  private readonly _hostPort: string
  private readonly _stringValue: string

  constructor (
    host: string,
    resolved: string | null | undefined,
    port: number,
    hostPort: string
  ) {
    this._host = assertString(host, 'host')
    this._resolved = resolved != null ? assertString(resolved, 'resolved') : null
    this._port = assertNumber(port, 'port')
    this._hostPort = hostPort
    this._stringValue = resolved != null ? `${hostPort}(${resolved})` : `${hostPort}`
  }

  host (): string {
    return this._host
  }

  resolvedHost (): string {
    return this._resolved != null ? this._resolved : this._host
  }

  port (): number {
    return this._port
  }

  resolveWith (resolved: string): ServerAddress {
    return new ServerAddress(this._host, resolved, this._port, this._hostPort)
  }

  asHostPort (): string {
    return this._hostPort
  }

  asKey (): string {
    return this._hostPort
  }

  toString (): string {
    return this._stringValue
  }

  static fromUrl (url: string): ServerAddress {
    const urlParsed = urlUtil.parseDatabaseUrl(url)
    return new ServerAddress(
      urlParsed.host,
      null,
      urlParsed.port,
      urlParsed.hostAndPort
    )
  }
}
