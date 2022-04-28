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

import Record from './record'
import { Query, SessionMode } from './types'


export default class PlannedQuery<T = Record> {
  
  constructor (
    private readonly _query: Query, 
    private readonly _accessMode: SessionMode,
    private readonly _isAutoCommit: boolean = false,
    private readonly _recordMapper: (result: Record) => T = (r) => r as unknown as T
  ) {}

  withParameters(parameters: any): PlannedQuery<T> {
    return new PlannedQuery(
      { 
        // @ts-ignore
        text: this.query,
        parameters
      },
      this._accessMode,
      this._isAutoCommit,
      this._recordMapper
    )
  }

  mergeParameters (parameters: any): PlannedQuery<T> {
    // @ts-ignore
    return this.withParameters({ ... this.parameters, ... parameters })
  }

  withRecordMapper<R> ( mapper: (result: Record) => R ): PlannedQuery<R> {
    return new PlannedQuery(
      this._query,
      this._accessMode,
      this._isAutoCommit,
      mapper
    )
  }

  map(record: Record): T {
    return this._recordMapper(record)
  }

  get query (): string {
    // @ts-ignore
    return typeof this._query === 'string' ? this._query : this._query.text
  }

  get parameters (): any {
    // @ts-ignore
    return typeof this._query === 'string' ? {} : this._query.parameters
  }

  get accessMode () {
    return this._accessMode
  }

  get isAutoCommit () {
    return this._isAutoCommit
  }
}
