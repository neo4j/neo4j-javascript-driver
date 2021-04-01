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
 * Custom version on JSON.stringify that can handle values that normally don't support serialization, such as BigInt.
 * @private
 * @param val A JavaScript value, usually an object or array, to be converted.
 * @returns A JSON string representing the given value.
 */
export function stringify (val: any) {
  return JSON.stringify(val, (_, value) =>
    typeof value === 'bigint' ? `${value}n` : value
  )
}
