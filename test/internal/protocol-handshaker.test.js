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

import * as v1 from '../../src/v1/internal/packstream-v1';
import * as v2 from '../../src/v1/internal/packstream-v2';
import ProtocolHandshaker from '../../src/v1/internal/protocol-handshaker';
import Logger from '../../src/v1/internal/logger';

describe('ProtocolHandshaker', () => {

  const protocolHandshaker = new ProtocolHandshaker(null, false, Logger.noOp());

  it('should create packer of the specified version', () => {
    const packer1 = protocolHandshaker._createPackerForProtocolVersion(1);
    expect(packer1 instanceof v1.Packer).toBeTruthy();

    const packer2 = protocolHandshaker._createPackerForProtocolVersion(2);
    expect(packer2 instanceof v2.Packer).toBeTruthy();
  });

  it('should create unpacker of the specified version', () => {
    const unpacker1 = protocolHandshaker._createUnpackerForProtocolVersion(1);
    expect(unpacker1 instanceof v1.Unpacker).toBeTruthy();

    const unpacker2 = protocolHandshaker._createUnpackerForProtocolVersion(2);
    expect(unpacker2 instanceof v2.Unpacker).toBeTruthy();
  });

  it('should fail to create packer for unknown version', () => {
    expect(() => protocolHandshaker._createPackerForProtocolVersion(42)).toThrow();
  });

  it('should fail to create unpacker for unknown version', () => {
    expect(() => protocolHandshaker._createUnpackerForProtocolVersion(42)).toThrow();
  });

});
