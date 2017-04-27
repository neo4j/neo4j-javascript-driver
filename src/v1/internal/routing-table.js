/**
 * Copyright (c) 2002-2017 "Neo Technology,","
 * Network Engine for Objects in Lund AB [http://neotechnology.com]
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
import {int} from '../integer';
import RoundRobinArray from './round-robin-array';
import {READ, WRITE} from '../driver';

const MIN_ROUTERS = 1;

export default class RoutingTable {

  constructor(routers, readers, writers, expirationTime) {
    this.routers = routers || new RoundRobinArray();
    this.readers = readers || new RoundRobinArray();
    this.writers = writers || new RoundRobinArray();
    this.expirationTime = expirationTime || int(0);
  }

  forget(address) {
    // Don't remove it from the set of routers, since that might mean we lose our ability to re-discover,
    // just remove it from the set of readers and writers, so that we don't use it for actual work without
    // performing discovery first.
    this.readers.remove(address);
    this.writers.remove(address);
  }

  forgetRouter(address) {
    this.routers.remove(address);
  }

  forgetWriter(address) {
    this.writers.remove(address);
  }

  serversDiff(otherRoutingTable) {
    const oldServers = new Set(this._allServers());
    const newServers = otherRoutingTable._allServers();
    newServers.forEach(newServer => oldServers.delete(newServer));
    return Array.from(oldServers);
  }

  /**
   * Check if this routing table is fresh to perform the required operation.
   * @param {string} accessMode the type of operation. Allowed values are {@link READ} and {@link WRITE}.
   * @return {boolean} <code>true</code> when this table contains servers to serve the required operation,
   * <code>false</code> otherwise.
   */
  isStaleFor(accessMode) {
    return this.expirationTime.lessThan(Date.now()) ||
      this.routers.size() < MIN_ROUTERS ||
      accessMode === READ && this.readers.isEmpty() ||
      accessMode === WRITE && this.writers.isEmpty();
  }

  _allServers() {
    return [...this.routers.toArray(), ...this.readers.toArray(), ...this.writers.toArray()];
  }

  toString() {
    return `RoutingTable[` +
      `expirationTime=${this.expirationTime}, ` +
      `routers=${this.routers}, ` +
      `readers=${this.readers}, ` +
      `writers=${this.writers}]`;
  }
}
