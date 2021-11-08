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

import crypto from 'crypto'
import { utf8 } from '../../src/channel'

const { encode, decode } = utf8

describe('uft8', () => {
  it.each([
    makeString(85000),
    '1234567890',
    '',
    '±!@#$%^&*()_+~`\'|][{}=-+±§<>,."',
    'àáâäæãåā',
    'èéêëēėę',
    'îïíīīįì',
    'ôöòóœøōõ',
    'ûüùúū',
    '⚡ 🏃‍♀️'
  ])('should decode encoded string', str => {
    const encoded = encode(str)
    
    const encodedThenDecoded = decode(encoded, encoded.length)

    expect(encodedThenDecoded).toEqual(str)
  })

  it.each([
    '1234567890',
    '',
    '±!@#$%^&*()_+~`\'|][{}=-+±§<>,."',
    'àáâäæãåā',
    'èéêëēėę',
    'îïíīīįì',
    'ôöòóœøōõ',
    'ûüùúū',
    '⚡ 🏃‍♀️'
  ])('.encode("%s") should match snapshot', str => {
    const encoded = encode(str)
    
    expect(encoded.toString()).toMatchSnapshot()
  })
})


function makeString ( len ) {
  return crypto.randomBytes(len).toString('hex')
}
