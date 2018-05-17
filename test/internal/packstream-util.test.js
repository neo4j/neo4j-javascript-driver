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

import packStreamUtil from '../../src/v1/internal/packstream-util';
import * as v1 from '../../src/v1/internal/packstream-v1';
import * as v2 from '../../src/v1/internal/packstream-v2';

describe('packstream-util', () => {

  it('should create packer of the specified version', () => {
    const packer1 = packStreamUtil.createPackerForProtocolVersion(1, null);
    expect(packer1 instanceof v1.Packer).toBeTruthy();

    const packer2 = packStreamUtil.createPackerForProtocolVersion(2, null);
    expect(packer2 instanceof v2.Packer).toBeTruthy();
  });

  it('should create unpacker of the specified version', () => {
    const unpacker1 = packStreamUtil.createUnpackerForProtocolVersion(1, null);
    expect(unpacker1 instanceof v1.Unpacker).toBeTruthy();

    const unpacker2 = packStreamUtil.createUnpackerForProtocolVersion(2, null);
    expect(unpacker2 instanceof v2.Unpacker).toBeTruthy();
  });

  it('should fail to create packer for unknown version', () => {
    expect(() => packStreamUtil.createPackerForProtocolVersion(42, null)).toThrow();
  });

  it('should fail to create unpacker for unknown version', () => {
    expect(() => packStreamUtil.createUnpackerForProtocolVersion(42, null)).toThrow();
  });

});
