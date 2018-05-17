/**
 * Copyright (c) 2002-2018 "Neo4j,"
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

import {alloc} from '../../src/v1/internal/buf';
import {Packer, Structure, Unpacker} from '../../src/v1/internal/packstream-v1';
import {int} from '../../src/v1';

describe('packstream-v1', () => {

  it('should pack integers', () => {
    let n, i;
    // test small numbers
    for (n = -999; n <= 999; n += 1) {
      i = int(n);
      expect(packAndUnpack(i).toString()).toBe(i.toString());
    }
    // positive numbers
    for (n = 16; n <= 16; n += 1) {
      i = int(Math.pow(2, n));
      expect(packAndUnpack(i).toString()).toBe(i.toString());
    }
    // negative numbers
    for (n = 0; n <= 63; n += 1) {
      i = int(-Math.pow(2, n));
      expect(packAndUnpack(i).toString()).toBe(i.toString());
    }
  });

  it('should pack strings', () => {
    expect(packAndUnpack('')).toBe('');
    expect(packAndUnpack('abcdefg123567')).toBe('abcdefg123567');
    const str = Array(65536 + 1).join('a'); // 2 ^ 16 + 1
    expect(packAndUnpack(str, str.length + 8)).toBe(str);
  });

  it('should pack structures', () => {
    expect(packAndUnpack(new Structure(1, ['Hello, world!!!'])).fields[0])
      .toBe('Hello, world!!!');
  });

  it('should pack lists', () => {
    const list = ['a', 'b'];
    const unpacked = packAndUnpack(list);
    expect(unpacked[0]).toBe(list[0]);
    expect(unpacked[1]).toBe(list[1]);
  });

  it('should pack long lists', () => {
    const listLength = 256;
    const list = [];
    for (let i = 0; i < listLength; i++) {
      list.push(null);
    }
    const unpacked = packAndUnpack(list, 1400);
    expect(unpacked[0]).toBe(list[0]);
    expect(unpacked[1]).toBe(list[1]);
  });
});

function packAndUnpack(val, bufferSize) {
  bufferSize = bufferSize || 128;
  const buffer = alloc(bufferSize);
  new Packer(buffer).packable(val)();
  buffer.reset();
  return new Unpacker().unpack(buffer);
}
