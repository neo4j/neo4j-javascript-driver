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
import { fromVersion } from '../../../../src/internal/bolt-agent/browser'

describe('#unit boltAgent', () => {
  // This test is very fragile but the exact look of this string should not change without PM approval
  it('should return the correct bolt agent for specified version', () => {
    const version = '5.3'
    const getSystemInfo = (): any => {
      return {
        appVersion: '5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/111.0.0.0 Safari/537.36'
      }
    }

    const boltAgent = fromVersion(version, getSystemInfo)

    expect(boltAgent).toEqual({
      product: 'neo4j-javascript/5.3',
      platform: 'Macintosh; Intel Mac OS X 10_15_7'
    })
  })

  it('should handle null appVersion', () => {
    const version = '5.3'
    const getSystemInfo = (): any => {
      return {
        appVersion: null
      }
    }

    const boltAgent = fromVersion(version, getSystemInfo)

    expect(boltAgent).toEqual({
      product: 'neo4j-javascript/5.3'
    })
  })

  it('should handle undefined appVersion', () => {
    const version = '5.3'
    const getSystemInfo = (): any => {
      return {
      }
    }

    const boltAgent = fromVersion(version, getSystemInfo)

    expect(boltAgent).toEqual({
      product: 'neo4j-javascript/5.3'
    })
  })
})
