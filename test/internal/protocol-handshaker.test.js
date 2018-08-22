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

import ProtocolHandshaker from '../../src/v1/internal/protocol-handshaker';
import Logger from '../../src/v1/internal/logger';
import BoltProtocol from '../../src/v1/internal/bolt-protocol';
import {alloc} from '../../src/v1/internal/buf';

describe('ProtocolHandshaker', () => {

  it('should create latest protocol', () => {
    const handshaker = new ProtocolHandshaker(null, null, null, false, Logger.noOp());

    const protocol = handshaker.createLatestProtocol();

    expect(protocol).toBeDefined();
    expect(protocol).not.toBeNull();
    expect(protocol instanceof BoltProtocol).toBeTruthy();
  });

  it('should write handshake request', () => {
    const writtenBuffers = [];
    const fakeChannel = {
      write: buffer => writtenBuffers.push(buffer)
    };

    const handshaker = new ProtocolHandshaker(null, fakeChannel, null, false, Logger.noOp());

    handshaker.writeHandshakeRequest();

    expect(writtenBuffers.length).toEqual(1);

    const boltMagicPreamble = '60 60 b0 17';
    const protocolVersion2 = '00 00 00 02';
    const protocolVersion1 = '00 00 00 01';
    const noProtocolVersion = '00 00 00 00';

    expect(writtenBuffers[0].toHex()).toEqual(`${boltMagicPreamble} ${protocolVersion2} ${protocolVersion1} ${noProtocolVersion} ${noProtocolVersion} `);
  });

  it('should read handshake response containing valid protocol version', () => {
    const handshaker = new ProtocolHandshaker(null, null, null, false, Logger.noOp());

    // buffer with Bolt V1
    const buffer = handshakeResponse(1);

    const protocol = handshaker.readHandshakeResponse(buffer);

    expect(protocol).toBeDefined();
    expect(protocol).not.toBeNull();
    expect(protocol instanceof BoltProtocol).toBeTruthy();
  });

  it('should read handshake response containing invalid protocol version', () => {
    const handshaker = new ProtocolHandshaker(null, null, null, false, Logger.noOp());

    // buffer with Bolt V42 which is invalid
    const buffer = handshakeResponse(42);

    expect(() => handshaker.readHandshakeResponse(buffer)).toThrow();
  });

  it('should read handshake response containing HTTP as the protocol version', () => {
    const handshaker = new ProtocolHandshaker(null, null, null, false, Logger.noOp());

    // buffer with HTTP magic int
    const buffer = handshakeResponse(1213486160);

    expect(() => handshaker.readHandshakeResponse(buffer)).toThrow();
  });

});

/**
 * @param {number} version
 * @return {BaseBuffer}
 */
function handshakeResponse(version) {
  const buffer = alloc(4);
  buffer.writeInt32(version);
  buffer.reset();
  return buffer;
}
