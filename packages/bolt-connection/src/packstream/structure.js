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

import { newError, error } from 'neo4j-driver-core'

const {
  PROTOCOL_ERROR
} = error

/**
 * A Structure have a signature and fields.
 */
export class Structure {
  /**
   * Create new instance
   */
  constructor (signature, fields) {
    this.signature = signature
    this.fields = fields
  }

  get size () {
    return this.fields.length
  }

  toString () {
    let fieldStr = ''
    for (let i = 0; i < this.fields.length; i++) {
      if (i > 0) {
        fieldStr += ', '
      }
      fieldStr += this.fields[i]
    }
    return 'Structure(' + this.signature + ', [' + fieldStr + '])'
  }
}

export function verifyStructSize (structName, expectedSize, actualSize) {
  if (expectedSize !== actualSize) {
    throw newError(
      `Wrong struct size for ${structName}, expected ${expectedSize} but was ${actualSize}`,
      PROTOCOL_ERROR
    )
  }
}

export default Structure
