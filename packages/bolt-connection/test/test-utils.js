/**
 * Copyright (c) "Neo4j"
 * Neo4j Sweden AB [https://neo4j.com]
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
import Connection from '../../bolt-connection/src/connection/connection'
import { json } from 'neo4j-driver-core'
import timezones from './timezones'
import fc from 'fast-check'

const MIN_UTC_IN_MS = -8_640_000_000_000_000
const MAX_UTC_IN_MS = 8_640_000_000_000_000
const ONE_DAY_IN_MS = 86_400_000

function isClient () {
  return typeof window !== 'undefined' && window.document
}

function isServer () {
  return !isClient()
}

const matchers = {
  toBeElementOf: function (actual, expected) {
    if (expected === undefined) {
      expected = []
    }

    const result = {}

    result.pass = expected in actual
    if (result.pass) {
      result.message = `Expected '${actual}' to be an element of '[${expected}]'`
    } else {
      result.message = `Expected '${actual}' to be an element of '[${expected}]', but it wasn't`
    }
    return result
  },
  toBeMessage: function (actual, expected) {
    if (expected === undefined) {
      expected = {}
    }

    const result = {}
    const failures = []

    if (expected.signature !== actual.signature) {
      failures.push(
        `signature '${actual.signature}' to match '${expected.signature}'`
      )
    }

    if (json.stringify(expected.fields) !== json.stringify(actual.fields)) {
      failures.push(
        `fields '[${json.stringify(
          actual.fields
        )}]' to match '[${json.stringify(expected.fields)}]'`
      )
    }

    result.pass = failures.length === 0
    if (result.pass) {
      result.message = () =>
        `Expected message '${actual}' to match '${expected}'`
    } else {
      result.message = () => `Expected message '[${failures}]', but it didn't`
    }
    return result
  },
  toBeCalledWithThis: function (theMockedFunction, thisArg) {
    return {
      pass: theMockedFunction.mock.contexts.filter(ctx => ctx === thisArg).length > 0,
      message: () => `Expected to be called with this equals to '${json.stringify(thisArg)}', but it wasn't.`
    }
  }
}

class MessageRecordingConnection extends Connection {
  constructor () {
    super(null)

    this.messages = []
    this.observers = []
    this.flushes = []
    this.fatalErrors = []
  }

  write (message, observer, flush) {
    this.messages.push(message)
    this.observers.push(observer)
    this.flushes.push(flush)
  }

  _handleFatalError (error) {
    this.fatalErrors.push(error)
  }

  verifyMessageCount (expected) {
    expect(this.messages.length).toEqual(expected)
    expect(this.observers.length).toEqual(expected)
    expect(this.flushes.length).toEqual(expected)
  }

  get version () {
    return 4.3
  }
}

function spyProtocolWrite (protocol, callRealMethod = false) {
  protocol.messages = []
  protocol.observers = []
  protocol.flushes = []

  const write = callRealMethod ? protocol.write.bind(protocol) : () => true
  protocol.write = (message, observer, flush) => {
    protocol.messages.push(message)
    protocol.observers.push(observer)
    protocol.flushes.push(flush)
    return write(message, observer, flush)
  }

  protocol.verifyMessageCount = expected => {
    expect(protocol.messages.length).toEqual(expected)
    expect(protocol.observers.length).toEqual(expected)
    expect(protocol.flushes.length).toEqual(expected)
  }

  return protocol
}

function arbitraryTimeZoneId () {
  const validTimeZones = timezones.filter(timeZone => {
    try {
      Intl.DateTimeFormat(undefined, { timeZone })
      return true
    } catch (e) {
      return false
    }
  })
  return fc.integer({ min: 0, max: validTimeZones.length - 1 })
    .map(i => validTimeZones[i])
}

export default {
  isClient,
  isServer,
  matchers,
  MessageRecordingConnection,
  spyProtocolWrite,
  MAX_UTC_IN_MS,
  MIN_UTC_IN_MS,
  ONE_DAY_IN_MS,
  arbitraryTimeZoneId
}
