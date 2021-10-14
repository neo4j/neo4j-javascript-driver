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

import BoltProtocolV2 from '../../src/bolt/bolt-protocol-v2'
import utils from '../test-utils'

describe('#unit BoltProtocolV2', () => {
  beforeEach(() => {
    expect.extend(utils.matchers)
  })

  it('should return correct bolt version number', () => {
    const protocol = new BoltProtocolV2(null, null, false)

    expect(protocol.version).toBe(2)
  })

  describe('unpacker configuration', () => {
    test.each([
      [false, false],
      [false, true],
      [true, false],
      [true, true]
    ])(
      'should create unpacker with disableLosslessIntegers=%p and useBigInt=%p',
      (disableLosslessIntegers, useBigInt) => {
        const protocol = new BoltProtocolV2(null, null, {
          disableLosslessIntegers,
          useBigInt
        })
        expect(protocol._unpacker._disableLosslessIntegers).toBe(
          disableLosslessIntegers
        )
        expect(protocol._unpacker._useBigInt).toBe(useBigInt)
      }
    )
  })

  describe('Bolt v4.4', () => {
    /**
     * @param {string} impersonatedUser The impersonated user.
     * @param {function(protocol: BoltProtocolV2)} fn 
     */
    function verifyImpersonationNotSupportedErrror (impersonatedUser, fn) {
      const recorder = new utils.MessageRecordingConnection()
      const protocol = new BoltProtocolV2(recorder, null, false)

      expect(() => fn(protocol)).toThrowError(
        'Driver is connected to the database that does not support user impersonation. ' +
          'Please upgrade to neo4j 4.4.0 or later in order to use this functionality. ' +
          `Trying to impersonate ${impersonatedUser}.`
      )
    }

    describe('beginTransaction', () => {
      function verifyBeginTransaction(impersonatedUser) {
        verifyImpersonationNotSupportedErrror(
          impersonatedUser,
          protocol => protocol.beginTransaction({ impersonatedUser }))
      }

      it('should throw error when impersonatedUser is set', () => {
        verifyBeginTransaction('test')
      })
    })

    describe('run', () => {
      function verifyRun (impersonatedUser) {
        verifyImpersonationNotSupportedErrror(
          impersonatedUser,
          protocol => protocol.run('query', {}, { impersonatedUser }))
      }

      it('should throw error when impersonatedUser is set', () => {
        verifyRun('test')
      })
    })
  })
})
