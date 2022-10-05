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
 * A facility to select most appropriate reader or writer among the given addresses for request processing.
 */
export default class LoadBalancingStrategy {
  /**
   * Select next most appropriate reader from the list of given readers.
   * @param {string[]} knownReaders an array of currently known readers to select from.
   * @return {string} most appropriate reader or `null` if given array is empty.
   */
  selectReader (knownReaders) {
    throw new Error('Abstract function')
  }

  /**
   * Select next most appropriate writer from the list of given writers.
   * @param {string[]} knownWriters an array of currently known writers to select from.
   * @return {string} most appropriate writer or `null` if given array is empty.
   */
  selectWriter (knownWriters) {
    throw new Error('Abstract function')
  }
}
