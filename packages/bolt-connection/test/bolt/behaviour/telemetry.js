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

import { internal } from 'neo4j-driver-core'
import { CompletedObserver } from '../../../src/bolt'

const {
  constants: {
    TELEMETRY_APIS
  }
} = internal

/**
 * Test setup for protocol versions which doesn't supports telemetry
 *
 * @param {function()} createProtocol
 * @returns {void}
 */
export function protocolNotSupportsTelemetry (createProtocol) {
  describe('.telemetry()', () => {
    describe.each(telemetryApiFixture())('when called with { api= %s } and onComplete defined', (api) => {
      let onComplete
      let result

      beforeEach(() => {
        onComplete = jest.fn()
        const protocol = createProtocol()

        result = protocol.telemetry({ api }, { onComplete })
      })

      it('should return a completed observer', () => {
        expect(result).toBeInstanceOf(CompletedObserver)
      })

      it('should call onComplete', () => {
        expect(onComplete).toHaveBeenCalledTimes(1)
      })
    })
  })
}

export function telemetryApiFixture () {
  return [
    ...Object.values(TELEMETRY_APIS)
  ]
}
