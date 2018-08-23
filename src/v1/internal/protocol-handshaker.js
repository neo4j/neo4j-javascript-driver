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
import BoltProtocolV1 from './bolt-protocol-v1';
import BoltProtocolV2 from './bolt-protocol-v2';

const HTTP_MAGIC_PREAMBLE = 1213486160; // == 0x48545450 == "HTTP"
const BOLT_MAGIC_PREAMBLE = 0x6060B017;

const LATEST_PROTOCOL_VERSION = 2;

export default class ProtocolHandshaker {

  /**
   * @constructor
   * @param {Connection} connection the connection owning this protocol.
   * @param {NodeChannel|WebSocketChannel} channel the network channel.
   * @param {Chunker} chunker the message chunker.
   * @param {boolean} disableLosslessIntegers flag to use native JS numbers.
   * @param {Logger} log the logger.
   */
  constructor(connection, channel, chunker, disableLosslessIntegers, log) {
    this._connection = connection;
    this._channel = channel;
    this._chunker = chunker;
    this._disableLosslessIntegers = disableLosslessIntegers;
    this._log = log;
  }

  /**
   * Create the newest bolt protocol.
   * @return {BoltProtocol} the protocol.
   */
  createLatestProtocol() {
    return this._createProtocolWithVersion(LATEST_PROTOCOL_VERSION);
  }

  /**
   * Write a Bolt handshake into the underlying network channel.
   */
  writeHandshakeRequest() {
    this._channel.write(newHandshakeBuffer());
  }

  /**
   * Read the given handshake response and create the negotiated bolt protocol.
   * @param {BaseBuffer} buffer byte buffer containing the handshake response.
   * @return {BoltProtocol} bolt protocol corresponding to the version suggested by the database.
   * @throws {Neo4jError} when bolt protocol can't be instantiated.
   */
  createNegotiatedProtocol(buffer) {
    const negotiatedVersion = buffer.readInt32();
    if (this._log.isDebugEnabled()) {
      this._log.debug(`${this._connection} negotiated protocol version ${negotiatedVersion}`);
    }
    return this._createProtocolWithVersion(negotiatedVersion);
  }

  /**
   * @return {BoltProtocol}
   * @private
   */
  _createProtocolWithVersion(version) {
    if (version === 1) {
      return new BoltProtocolV1(this._connection, this._chunker, this._disableLosslessIntegers);
    } else if (version === 2) {
      return new BoltProtocolV2(this._connection, this._chunker, this._disableLosslessIntegers);
    } else if (version === HTTP_MAGIC_PREAMBLE) {
      throw newError('Server responded HTTP. Make sure you are not trying to connect to the http endpoint ' +
        '(HTTP defaults to port 7474 whereas BOLT defaults to port 7687)');
    } else {
      throw newError('Unknown Bolt protocol version: ' + version);
    }
  }
}

/**
 * @return {BaseBuffer}
 * @private
 */
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
