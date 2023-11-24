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

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    interface Matchers<R> {
      toBeSortedEqual: (expected: Iterable<string>) => CustomMatcherResult
    }
  }
}

export function installMatchers (): void {
  expect.extend({
    toBeSortedEqual (this: jest.MatcherContext, received: Iterable<string>, expected: Iterable<string>): jest.CustomMatcherResult {
      const sortedReceived = [...received].sort()
      const sortedExpected = [...expected].sort()

      return {
        pass: this.equals(sortedReceived, sortedExpected),
        message: () =>
          `Expected sorted:\n\n\t${JSON.stringify(sortedExpected)}\n\nGot sorted:\n\n\t${JSON.stringify(sortedReceived)}`
      }
    }
  })
}
