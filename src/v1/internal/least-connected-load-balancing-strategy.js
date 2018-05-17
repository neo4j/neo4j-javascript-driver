/**
 * Copyright (c) 2002-2018 "Neo4j,"
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
import RoundRobinArrayIndex from './round-robin-array-index';
import LoadBalancingStrategy from './load-balancing-strategy';

export const LEAST_CONNECTED_STRATEGY_NAME = 'least_connected';

export default class LeastConnectedLoadBalancingStrategy extends LoadBalancingStrategy {

  /**
   * @constructor
   * @param {Pool} connectionPool the connection pool of this driver.
   */
  constructor(connectionPool) {
    super();
    this._readersIndex = new RoundRobinArrayIndex();
    this._writersIndex = new RoundRobinArrayIndex();
    this._connectionPool = connectionPool;
  }

  /**
   * @inheritDoc
   */
  selectReader(knownReaders) {
    return this._select(knownReaders, this._readersIndex);
  }

  /**
   * @inheritDoc
   */
  selectWriter(knownWriters) {
    return this._select(knownWriters, this._writersIndex);
  }

  _select(addresses, roundRobinIndex) {
    const length = addresses.length;
    if (length === 0) {
      return null;
    }

    // choose start index for iteration in round-robin fashion
    const startIndex = roundRobinIndex.next(length);
    let index = startIndex;

    let leastConnectedAddress = null;
    let leastActiveConnections = Number.MAX_SAFE_INTEGER;

    // iterate over the array to find least connected address
    do {
      const address = addresses[index];
      const activeConnections = this._connectionPool.activeResourceCount(address);

      if (activeConnections < leastActiveConnections) {
        leastConnectedAddress = address;
        leastActiveConnections = activeConnections;
      }

      // loop over to the start of the array when end is reached
      if (index === length - 1) {
        index = 0;
      } else {
        index++;
      }
    }
    while (index !== startIndex);

    return leastConnectedAddress;
  }
}
