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

import RoundRobinArrayIndex from './round-robin-array-index'
import LoadBalancingStrategy from './load-balancing-strategy'

export const ROUND_ROBIN_STRATEGY_NAME = 'round_robin'

export default class RoundRobinLoadBalancingStrategy extends LoadBalancingStrategy {
  constructor () {
    super()
    this._readersIndex = new RoundRobinArrayIndex()
    this._writersIndex = new RoundRobinArrayIndex()
  }

  /**
   * @inheritDoc
   */
  selectReader (knownReaders) {
    return this._select(knownReaders, this._readersIndex)
  }

  /**
   * @inheritDoc
   */
  selectWriter (knownWriters) {
    return this._select(knownWriters, this._writersIndex)
  }

  _select (addresses, roundRobinIndex) {
    const length = addresses.length
    if (length === 0) {
      return null
    }
    const index = roundRobinIndex.next(length)
    return addresses[index]
  }
}
