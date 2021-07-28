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
import Connection from '../../../bolt-connection/lib/connection/connection'

function isClient () {
  return typeof window !== 'undefined' && window.document
}

function isServer () {
  return !isClient()
}

function fakeStandardDateWithOffset (offsetMinutes) {
  const date = new Date()
  date.getTimezoneOffset = () => offsetMinutes
  return date
}

const matchers = {
  toBeElementOf: function (util, customEqualityTesters) {
    return {
      compare: function (actual, expected) {
        if (expected === undefined) {
          expected = []
        }

        const result = {}

        result.pass = util.contains(expected, actual)
        if (result.pass) {
          result.message = `Expected '${actual}' to be an element of '[${expected}]'`
        } else {
          result.message = `Expected '${actual}' to be an element of '[${expected}]', but it wasn't`
        }
        return result
      }
    }
  },
  toBeMessage: function (util, customEqualityTesters) {
    return {
      compare: function (actual, expected) {
        if (expected === undefined) {
          expected = {}
        }

        const result = {}
        const failures = []

        if (!util.equals(expected.signature, actual.signature)) {
          failures.push(
            `signature '${actual.signature}' to match '${expected.signature}'`
          )
        }

        if (!util.equals(expected.fields, actual.fields)) {
          failures.push(
            `fields '[${JSON.stringify(
              actual.fields
            )}]' to match '[${JSON.stringify(expected.fields)}]'`
          )
        }

        result.pass = failures.length === 0
        if (result.pass) {
          result.message = `Expected message '${actual}' to match '${expected}'`
        } else {
          result.message = `Expected message '[${failures}]', but it didn't`
        }
        return result
      }
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

export default {
  isClient,
  isServer,
  fakeStandardDateWithOffset,
  matchers,
  MessageRecordingConnection,
  spyProtocolWrite
}
