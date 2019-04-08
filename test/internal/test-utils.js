/**
 * Copyright (c) 2002-2019 "Neo4j,"
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

        let result = {}

        result.pass = util.contains(expected, actual)
        if (result.pass) {
          result.message = `Expected '${actual}' to be an element of '[${expected}]'`
        } else {
          result.message = `Expected '${actual}' to be an element of '[${expected}]', but it wasn't`
        }
        return result
      }
    }
  }
}

export default {
  isClient,
  isServer,
  fakeStandardDateWithOffset,
  matchers
}
