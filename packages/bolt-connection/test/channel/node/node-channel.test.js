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
import NodeChannel from '../../../src/channel/node/node-channel'
import ChannelConfig from '../../../src/channel/channel-config'
import { error, internal, newError } from 'neo4j-driver-core'

const {
  serverAddress: { ServerAddress }
} = internal

const { SERVICE_UNAVAILABLE } = error

describe('NodeChannel', () => {
  it('should resolve close if websocket is already closed', () => {
    const address = ServerAddress.fromUrl('bolt://localhost:9999')
    const channelConfig = new ChannelConfig(address, {}, SERVICE_UNAVAILABLE)
    const channel = new NodeChannel(channelConfig)

    // Modify the connection to be closed
    channel._open = false

    return expect(channel.close()).resolves.not.toThrow()
  })

  it('should resolve close when websocket is connected', () => {
    const channel = createMockedChannel(true)

    return expect(channel.close()).resolves.not.toThrow()
  })

  describe('.close()', () => {
    it('should set _open to false before resolve the promise', async () => {
      const channel = createMockedChannel(true)

      expect(channel._open).toBe(true)

      const promise = channel.close()

      expect(channel._open).toBe(false)

      await promise
    })
  })

  describe('.setupReceiveTimeout()', () => {
    it('should not call socket.setTimeout(receiveTimeout)', () => {
      const receiveTimeout = 42
      const channel = createMockedChannel(true)

      channel.setupReceiveTimeout(receiveTimeout)

      expect(channel._conn.getCalls().setTimeout.length).toEqual(1)
    })

    it('should unsubscribe to the on connect and on timeout created on the create socket', () => {
      const receiveTimeout = 42
      const channel = createMockedChannel(true)

      channel.setupReceiveTimeout(receiveTimeout)

      expect(channel._conn.getCalls().on.slice(0, 2)).toEqual(
        channel._conn.getCalls().off
      )
    })

    it('should destroy the connection when time out', () => {
      const receiveTimeout = 42
      const channel = createMockedChannel(true)

      channel.setupReceiveTimeout(receiveTimeout)

      const [event, listener] = channel._conn.getCalls().on[2]
      expect(event).toEqual('timeout')
      listener()

      expect(channel._conn.getCalls().destroy).toEqual([
        [
          newError(
            "Connection lost. Server didn't respond in 42ms",
            SERVICE_UNAVAILABLE
          )
        ]
      ])
    })

    it('should not unsubscribe from on connect nor from on timeout if connectionTimeout is not set', () => {
      const receiveTimeout = 42
      const channel = createMockedChannel(true, { connectionTimeout: 0 })

      channel.setupReceiveTimeout(receiveTimeout)

      expect(channel._conn.getCalls().off).toEqual([])
    })
  })

  describe('.startReceiveTimeout()', () => {
    describe('receive timeout is setup', () => {
      it('should call socket.setTimeout(receiveTimeout) when called first', () => {
        const { receiveTimeout, channel } = setup()

        channel.startReceiveTimeout()

        expect(channel._conn.getCalls().setTimeout.length).toEqual(2)
        expect(channel._conn.getCalls().setTimeout[1]).toEqual([receiveTimeout])
      })

      it ('should not call socket.setTimeout(receiveTimeout) if stream already started', () => {
        const { receiveTimeout, channel } = setup()

        // setup
        channel.startReceiveTimeout()
        expect(channel._conn.getCalls().setTimeout.length).toEqual(2)
        expect(channel._conn.getCalls().setTimeout[1]).toEqual([receiveTimeout])

        // start again
        channel.startReceiveTimeout()

        expect(channel._conn.getCalls().setTimeout.length).toEqual(2)
        expect(channel._conn.getCalls().setTimeout[1]).toEqual([receiveTimeout])
      })

      it ('should call socket.setTimeout(receiveTimeout) when after stop', () => {
        const { receiveTimeout, channel } = setup()

        // setup
        channel.startReceiveTimeout()
        expect(channel._conn.getCalls().setTimeout.length).toEqual(2)
        expect(channel._conn.getCalls().setTimeout[1]).toEqual([receiveTimeout])
        channel.stopReceiveTimeout()
        expect(channel._conn.getCalls().setTimeout.length).toEqual(3)
        expect(channel._conn.getCalls().setTimeout[2]).toEqual([0])

        // start again
        channel.startReceiveTimeout()

        expect(channel._conn.getCalls().setTimeout.length).toEqual(4)
        expect(channel._conn.getCalls().setTimeout[3]).toEqual([receiveTimeout])
      })

      function setup () {
        const channel = createMockedChannel(true)
        const receiveTimeout = 42
        channel.setupReceiveTimeout(receiveTimeout)
        return {channel, receiveTimeout}
      }
    })

    describe('receive timemout is not setup', () => {
      it ('should call not socket.setTimeout(receiveTimeout) when not started', () => {
        const channel = createMockedChannel(true)

        // start again
        channel.startReceiveTimeout()

        expect(channel._conn.getCalls().setTimeout.length).toEqual(1)
      })
    })
  })

  describe('.stopReceiveTimeout()', () => {
    describe('when receive timeout is setup', () => {
      it ('should not call socket.setTimeout(0) when not started', () => {
        const { channel } = setup()

        channel.stopReceiveTimeout()

        expect(channel._conn.getCalls().setTimeout.length).toEqual(1)
      })

      it ('should call  socket.setTimeout(0) when already started', () => {
        const { channel } = setup()

        channel.startReceiveTimeout()

        channel.stopReceiveTimeout()

        expect(channel._conn.getCalls().setTimeout.length).toEqual(3)
        expect(channel._conn.getCalls().setTimeout[2]).toEqual([0])
      })

      it ('should not call socket.setTimeout(0) when already stopped', () => {
        const { channel } = setup()

        channel.startReceiveTimeout()
        channel.stopReceiveTimeout()

        channel.stopReceiveTimeout()

        expect(channel._conn.getCalls().setTimeout.length).toEqual(3)
      })

      function setup () {
        const channel = createMockedChannel(true)
        const receiveTimeout = 42
        channel.setupReceiveTimeout(receiveTimeout)
        return {channel, receiveTimeout}
      }
    })

    describe('when receive timeout is not setup', () => {
      it ('should not call socket.setTimeout(0)', () => {
        const channel = createMockedChannel(true)

        channel.startReceiveTimeout()
        channel.stopReceiveTimeout()

        expect(channel._conn.getCalls().setTimeout.length).toEqual(1)
      })
    })
  })
})

function createMockedChannel (connected, config = {}) {
  let endCallback = null
  const address = ServerAddress.fromUrl('bolt://localhost:9999')
  const channelConfig = new ChannelConfig(address, config, SERVICE_UNAVAILABLE)
  const socketFactory = () => {
    const on = []
    const off = []
    const setTimeout = []
    const destroy = []
    return {
      destroyed: false,
      destroy: () => {
        destroy.push([...arguments])
      },
      end: () => {
        channel._open = false
        endCallback()
      },
      removeListener: () => {},
      on: (key, cb) => {
        on.push([...arguments])
        if (key === 'end') {
          endCallback = cb
        }
      },
      off: () => {
        off.push([...arguments])
      },
      setTimeout: () => {
        setTimeout.push([...arguments])
      },
      getCalls: () => {
        return { on, off, setTimeout, destroy }
      }
    }
  }
  const channel = new NodeChannel(channelConfig, socketFactory)
  channel._open = connected
  return channel
}
