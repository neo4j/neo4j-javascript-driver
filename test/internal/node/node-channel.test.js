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
import NodeChannel from '../../../src/internal/node/node-channel'
import ChannelConfig from '../../../src/internal/channel-config'
import { SERVICE_UNAVAILABLE } from '../../../src/error'
import ServerAddress from '../../../src/internal/server-address'
import { connect } from 'net'

describe('#unit NodeChannel', () => {
  it('should resolve close if websocket is already closed', () => {
    const address = ServerAddress.fromUrl('bolt://localhost:9999')
    const channelConfig = new ChannelConfig(address, {}, SERVICE_UNAVAILABLE)
    const channel = new NodeChannel(channelConfig)

    // Modify the connection to be closed
    channel._open = false

    return expectAsync(channel.close()).toBeResolved()
  })

  it('should resolve close when websocket is connected', () => {
    const channel = createMockedChannel(true)

    return expectAsync(channel.close()).toBeResolved()
  })
})

function createMockedChannel (connected) {
  let endCallback = null
  const address = ServerAddress.fromUrl('bolt://localhost:9999')
  const channelConfig = new ChannelConfig(address, {}, SERVICE_UNAVAILABLE)
  const channel = new NodeChannel(channelConfig)
  const socket = {
    destroyed: false,
    destroy: () => {},
    end: () => {
      channel._open = false
      endCallback()
    },
    removeListener: () => {},
    on: (key, cb) => {
      if (key === 'end') {
        endCallback = cb
      }
    }
  }
  channel._conn = socket
  channel._open = connected
  return channel
}
