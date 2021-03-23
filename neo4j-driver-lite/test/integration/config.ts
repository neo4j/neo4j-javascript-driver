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

// @ts-ignore
const env = process.env

const username = env.TEST_NEO4J_USER || 'neo4j'
const password = env.TEST_NEO4J_PASS || 'password'
const hostname = env.TEST_NEO4J_HOST || 'localhost'
const scheme = env.TEST_NEO4J_SCHEME || 'bolt'
const cluster =
  env.TEST_NEO4J_IS_CLUSTER !== undefined
    ? env.TEST_NEO4J_IS_CLUSTER === '1'
    : false

const testNonClusterSafe = cluster ? test.skip.bind(test) : test

export { username, password, hostname, scheme, cluster, testNonClusterSafe }
