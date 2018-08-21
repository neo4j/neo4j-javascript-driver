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

import {alloc} from './buf';
import {newError} from '../error';
import * as v1 from './packstream-v1';
import * as v2 from './packstream-v2';

const HTTP_MAGIC_PREAMBLE = 1213486160; // == 0x48545450 == "HTTP"
const BOLT_MAGIC_PREAMBLE = 0x6060B017;

const PACKER_CONSTRUCTORS_BY_VERSION = [null, v1.Packer, v2.Packer];
const UNPACKER_CONSTRUCTORS_BY_VERSION = [null, v1.Unpacker, v2.Unpacker];

export default class ProtocolHandshaker {

  constructor(channel, chunker, disableLosslessIntegers, log) {
    this._channel = channel;
    this._chunker = chunker;
    this._disableLosslessIntegers = disableLosslessIntegers;
    this._log = log;
  }

  createLatestPacker() {
    return this._createPackerForProtocolVersion(PACKER_CONSTRUCTORS_BY_VERSION.length - 1);
  }

  createLatestUnpacker() {
    return this._createUnpackerForProtocolVersion(UNPACKER_CONSTRUCTORS_BY_VERSION.length - 1);
  }

  writeHandshakeRequest() {
    this._channel.write(newHandshakeBuffer());
  }

  readHandshakeResponse(buffer) {
    const proposedVersion = buffer.readInt32();

    if (proposedVersion === 1 || proposedVersion === 2) {
      return this._createPackerAndUnpackerForProtocolVersion(proposedVersion);
    } else if (proposedVersion === HTTP_MAGIC_PREAMBLE) {
      throw newError('Server responded HTTP. Make sure you are not trying to connect to the http endpoint ' +
        '(HTTP defaults to port 7474 whereas BOLT defaults to port 7687)');
    } else {
      throw newError('Unknown Bolt protocol version: ' + proposedVersion);
    }
  }

  _createPackerAndUnpackerForProtocolVersion(version) {
    if (this._log.isDebugEnabled()) {
      this._log.debug(`${this} negotiated protocol version ${version}`);
    }
    const packer = this._createPackerForProtocolVersion(version);
    const unpacker = this._createUnpackerForProtocolVersion(version);
    return {packer, unpacker};
  }

  _createPackerForProtocolVersion(version) {
    const packerConstructor = PACKER_CONSTRUCTORS_BY_VERSION[version];
    if (!packerConstructor) {
      throw new Error(`Packer can't be created for protocol version ${version}`);
    }
    return new packerConstructor(this._chunker);
  }

  _createUnpackerForProtocolVersion(version) {
    const unpackerConstructor = UNPACKER_CONSTRUCTORS_BY_VERSION[version];
    if (!unpackerConstructor) {
      throw new Error(`Unpacker can't be created for protocol version ${version}`);
    }
    return new unpackerConstructor(this._disableLosslessIntegers);
  }
}

function newHandshakeBuffer() {
  const handshakeBuffer = alloc(5 * 4);

  //magic preamble
  handshakeBuffer.writeInt32(BOLT_MAGIC_PREAMBLE);

  //proposed versions
  handshakeBuffer.writeInt32(2);
  handshakeBuffer.writeInt32(1);
  handshakeBuffer.writeInt32(0);
  handshakeBuffer.writeInt32(0);

  // reset the reader position
  handshakeBuffer.reset();

  return handshakeBuffer;
}
