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

import { newError } from 'neo4j-driver-core'
import BoltProtocolV1 from './bolt-protocol-v1'
import BoltProtocolV2 from './bolt-protocol-v2'
import BoltProtocolV3 from './bolt-protocol-v3'
import BoltProtocolV4x0 from './bolt-protocol-v4x0'
import BoltProtocolV4x1 from './bolt-protocol-v4x1'
import BoltProtocolV4x2 from './bolt-protocol-v4x2'
import BoltProtocolV4x3 from './bolt-protocol-v4x3'
import BoltProtocolV4x4 from './bolt-protocol-v4x4'
import { Chunker, Dechunker } from '../channel'
import ResponseHandler from './response-handler'

/**
 * Creates a protocol with a given version
 *
 * @param {object} config
 * @param {number} config.version The version of the protocol
 * @param {channel} config.channel The channel
 * @param {Chunker} config.chunker The chunker
 * @param {Dechunker} config.dechunker The dechunker
 * @param {Logger} config.log The logger
 * @param {ResponseHandler~Observer} config.observer Observer
 * @param {boolean} config.disableLosslessIntegers Disable the lossless integers
 * @param {boolean} packstreamConfig.useBigInt if this connection should convert all received integers to native BigInt numbers.
 * @param {boolean} config.serversideRouting It's using server side routing
 */
export default function create ({
  version,
  chunker,
  dechunker,
  channel,
  disableLosslessIntegers,
  useBigInt,
  serversideRouting,
  server, // server info
  log,
  observer
} = {}) {
  const createResponseHandler = protocol => {
    const responseHandler = new ResponseHandler({
      transformMetadata: protocol.transformMetadata.bind(protocol),
      log,
      observer
    })

    // reset the error handler to just handle errors and forget about the handshake promise
    channel.onerror = observer.onError.bind(observer)

    // Ok, protocol running. Simply forward all messages to the dechunker
    channel.onmessage = buf => dechunker.write(buf)

    // setup dechunker to dechunk messages and forward them to the message handler
    dechunker.onmessage = buf => {
      responseHandler.handleResponse(protocol.unpacker().unpack(buf))
    }

    return responseHandler
  }

  return createProtocol(
    version,
    server,
    chunker,
    { disableLosslessIntegers, useBigInt },
    serversideRouting,
    createResponseHandler,
    observer.onProtocolError.bind(observer),
    log
  )
}

function createProtocol (
  version,
  server,
  chunker,
  packingConfig,
  serversideRouting,
  createResponseHandler,
  onProtocolError,
  log
) {
  switch (version) {
    case 1:
      return new BoltProtocolV1(
        server,
        chunker,
        packingConfig,
        createResponseHandler,
        log,
        onProtocolError
      )
    case 2:
      return new BoltProtocolV2(
        server,
        chunker,
        packingConfig,
        createResponseHandler,
        log,
        onProtocolError
      )
    case 3:
      return new BoltProtocolV3(
        server,
        chunker,
        packingConfig,
        createResponseHandler,
        log,
        onProtocolError
      )
    case 4.0:
      return new BoltProtocolV4x0(
        server,
        chunker,
        packingConfig,
        createResponseHandler,
        log,
        onProtocolError
      )
    case 4.1:
      return new BoltProtocolV4x1(
        server,
        chunker,
        packingConfig,
        createResponseHandler,
        log,
        onProtocolError,
        serversideRouting
      )
    case 4.2:
      return new BoltProtocolV4x2(
        server,
        chunker,
        packingConfig,
        createResponseHandler,
        log,
        onProtocolError,
        serversideRouting
      )
    case 4.3:
      return new BoltProtocolV4x3(
        server,
        chunker,
        packingConfig,
        createResponseHandler,
        log,
        onProtocolError,
        serversideRouting
      )
    case 4.4:
      return new BoltProtocolV4x4(
        server,
        chunker,
        packingConfig,
        createResponseHandler,
        log,
        onProtocolError,
        serversideRouting
      )
    default:
      throw newError('Unknown Bolt protocol version: ' + version)
  }
}
