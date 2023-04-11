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
/* eslint-disable */
//@ts-ignore
import { fromVersion } from '../../../../../src/internal/bolt-agent/deno/bolt-agent.ts'
//@ts-ignore
import { assertMatch, assertEquals } from "https://deno.land/std@0.182.0/testing/asserts.ts";

//@ts-ignore
Deno.test('Test Contains deno and javascript', () => {
    const boltAgent = fromVersion("5.3")
    assertMatch(boltAgent, new RegExp("^neo4j-javascript/5.3"))
    assertMatch(boltAgent, new RegExp("Deno/"))
});

//@ts-ignore
Deno.test('Test full bolt agent', () => {
    //@ts-ignore
    const HOST_ARCH = Deno.build.arch
    //@ts-ignore
    const DENO_VERSION = `Deno/${Deno.version.deno}`
    //@ts-ignore
    const NODE_V8_VERSION = Deno.version.v8
    //@ts-ignore
    const OS_NAME_VERSION = `${Deno.build.os} ${Deno.osRelease()}`

    const boltAgentExpected = `neo4j-javascript/5.3 (${OS_NAME_VERSION}; ${HOST_ARCH}) ${DENO_VERSION} (v8 ${NODE_V8_VERSION})`

    assertEquals(fromVersion("5.3"), boltAgentExpected)
});
/* eslint-enable */
