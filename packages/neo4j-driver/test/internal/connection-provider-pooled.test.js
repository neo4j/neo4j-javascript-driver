/**
 * Copyright (c) "Neo4j"
 * Neo4j Sweden AB [https://neo4j.com]
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
import PooledConnectionProvider from '../../../bolt-connection/lib/connection-provider/connection-provider-pooled'
import FakeConnection from './fake-connection'
import lolex from 'lolex'

describe('#unit PooledConnectionProvider', () => {
  it('should treat closed connections as invalid', async () => {
    const provider = new PooledConnectionProvider({
      id: 0,
      config: {}
    })

    const connectionValid = await provider._validateConnection(
      new FakeConnection().closed()
    )

    expect(connectionValid).toBeFalsy()
  })

  it('should treat not old open connections as valid', async () => {
    const provider = new PooledConnectionProvider({
      id: 0,
      config: {
        maxConnectionLifetime: 10
      }
    })

    const connection = new FakeConnection().withCreationTimestamp(12)
    const clock = lolex.install()
    try {
      clock.setSystemTime(20)
      const connectionValid = await provider._validateConnection(connection)

      expect(connectionValid).toBeTruthy()
    } finally {
      clock.uninstall()
    }
  })

  it('should treat old open connections as invalid', async () => {
    const provider = new PooledConnectionProvider({
      id: 0,
      config: {
        maxConnectionLifetime: 10
      }
    })

    const connection = new FakeConnection().withCreationTimestamp(5)
    const clock = lolex.install()
    try {
      clock.setSystemTime(20)
      const connectionValid = await provider._validateConnection(connection)

      expect(connectionValid).toBeFalsy()
    } finally {
      clock.uninstall()
    }
  })

  it('_installIdleObserverOnConnection should set connection as idle', () => {
    const connection = new FakeConnection()
    const observer = { onCompleted: () => {} }

    PooledConnectionProvider._installIdleObserverOnConnection(connection, observer)

    expect(connection._idle).toBe(true)
    expect(connection._idleObserver).toBe(observer)
  })

  it('_removeIdleObserverOnConnection should unset connection as idle', () => {
    const connection = new FakeConnection()
    const observer = { onCompleted: () => {} }

    PooledConnectionProvider._installIdleObserverOnConnection(connection, observer)

    expect(connection._idle).toBe(true)
    expect(connection._idleObserver).toBe(observer)

    PooledConnectionProvider._removeIdleObserverOnConnection(connection)

    expect(connection._idle).toBe(false)
    expect(connection._idleObserver).toBe(null)
  })
})
