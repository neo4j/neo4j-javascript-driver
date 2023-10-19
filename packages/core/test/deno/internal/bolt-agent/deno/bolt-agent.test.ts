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
import { fromVersion, SystemInfo } from '../../../../../src/internal/bolt-agent/deno/bolt-agent.ts'
//@ts-ignore
import { assertEquals } from "https://deno.land/std@0.182.0/testing/asserts.ts";

//@ts-ignore
Deno.test('Test full bolt agent', () => {
    //@ts-ignore
    const HOST_ARCH = Deno.build.arch
    //@ts-ignore
    const DENO_VERSION = `Deno/${Deno.version.deno}`
    //@ts-ignore
    const NODE_V8_VERSION = Deno.version.v8
    //@ts-ignore
    const OS_NAME_VERSION = `${Deno.build.os} ${Deno.osRelease ? Deno.osRelease() : ''}`.trim()

    const boltAgent = fromVersion('5.3')

    assertEquals(boltAgent, {
        product: 'neo4j-javascript/5.3',
        platform: `${OS_NAME_VERSION}; ${HOST_ARCH}`,
        languageDetails: `${DENO_VERSION} (v8 ${NODE_V8_VERSION})` 
    })
});

// @ts-ignore
Deno.test('Test full bolt agent for mocked values', () => {
    const systemInfo: SystemInfo = {
        hostArch: 'myArch',
        denoVersion: '1.19.1',
        v8Version: '8.1.39',
        osVersion: 'macos',
        osRelease: '14.1'
    }
    const boltAgent = fromVersion('5.3', () => systemInfo)

    assertEquals(boltAgent, {
        product: 'neo4j-javascript/5.3',
        platform: 'macos 14.1; myArch',
        languageDetails: `Deno/1.19.1 (v8 8.1.39)` 
    })
});

// @ts-ignore
Deno.test('Test full bolt agent for mocked values', () => {
    const originalConsoleWarn = console.warn
    const consoleWarnCalls = [] as any[][]
    const myConsoleWarn = (...args: any[]) => consoleWarnCalls.push(args)
    
    try {
        console.warn = myConsoleWarn;

        fromVersion('5.3')
    
        assertEquals(consoleWarnCalls.length, 1)
        assertEquals(consoleWarnCalls[0].length, 1)

        const [[message]] = consoleWarnCalls

        assertEquals(message, "WARNING! neo4j-driver-deno stills in preview.")
    } finally {
        console.warn = originalConsoleWarn
    }
    
});


/* eslint-enable */
