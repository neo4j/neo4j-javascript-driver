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
import RoutingTable from '../../src/v1/internal/routing-table'
import { int } from '../../src/v1/integer'
import { READ, WRITE } from '../../src/v1/driver'
import ServerAddress from '../../src/v1/internal/server-address'

describe('routing-table', () => {
  const server1 = ServerAddress.fromUrl('server1')
  const server2 = ServerAddress.fromUrl('server2')
  const server3 = ServerAddress.fromUrl('server3')
  const server4 = ServerAddress.fromUrl('server4')
  const server5 = ServerAddress.fromUrl('server5')
  const server6 = ServerAddress.fromUrl('server6')
  const server42 = ServerAddress.fromUrl('server42')

  it('should not be stale when has routers, readers, writers and future expiration date', () => {
    const table = createTable(
      [server1, server2],
      [server3, server4],
      [server5, server6],
      notExpired()
    )
    expect(table.isStaleFor(READ)).toBeFalsy()
    expect(table.isStaleFor(WRITE)).toBeFalsy()
  })

  it('should be stale when expiration date in the past', () => {
    const table = createTable(
      [server1, server2],
      [server1, server2],
      [server1, server2],
      expired()
    )
    expect(table.isStaleFor(READ)).toBeTruthy()
    expect(table.isStaleFor(WRITE)).toBeTruthy()
  })

  it('should not be stale when has single router', () => {
    const table = createTable(
      [server1],
      [server2, server3],
      [server4, server5],
      notExpired()
    )
    expect(table.isStaleFor(READ)).toBeFalsy()
    expect(table.isStaleFor(WRITE)).toBeFalsy()
  })

  it('should be stale for reads but not writes when no readers', () => {
    const table = createTable(
      [server1, server2],
      [],
      [server3, server4],
      notExpired()
    )
    expect(table.isStaleFor(READ)).toBeTruthy()
    expect(table.isStaleFor(WRITE)).toBeFalsy()
  })

  it('should be stale for writes but not reads when no writers', () => {
    const table = createTable(
      [server1, server2],
      [server3, server4],
      [],
      notExpired()
    )
    expect(table.isStaleFor(READ)).toBeFalsy()
    expect(table.isStaleFor(WRITE)).toBeTruthy()
  })

  it('should not be stale with single reader', () => {
    const table = createTable(
      [server1, server2],
      [server3],
      [server4, server5],
      notExpired()
    )
    expect(table.isStaleFor(READ)).toBeFalsy()
    expect(table.isStaleFor(WRITE)).toBeFalsy()
  })

  it('should not be stale with single writer', () => {
    const table = createTable(
      [server1, server2],
      [server3, server4],
      [server5],
      notExpired()
    )
    expect(table.isStaleFor(READ)).toBeFalsy()
    expect(table.isStaleFor(WRITE)).toBeFalsy()
  })

  it('should forget reader, writer but not router', () => {
    const table = createTable(
      [server1, server2],
      [server1, server2],
      [server1, server2],
      notExpired()
    )

    table.forget(server1)

    expect(table.routers).toEqual([server1, server2])
    expect(table.readers).toEqual([server2])
    expect(table.writers).toEqual([server2])
  })

  it('should forget single reader', () => {
    const table = createTable(
      [server1, server2],
      [server42],
      [server1, server2, server3],
      notExpired()
    )

    table.forget(server42)

    expect(table.routers).toEqual([server1, server2])
    expect(table.readers).toEqual([])
    expect(table.writers).toEqual([server1, server2, server3])
  })

  it('should forget single writer', () => {
    const table = createTable(
      [server1, server2],
      [server3, server4, server5],
      [server42],
      notExpired()
    )

    table.forget(server42)

    expect(table.routers).toEqual([server1, server2])
    expect(table.readers).toEqual([server3, server4, server5])
    expect(table.writers).toEqual([])
  })

  it('should forget router', () => {
    const table = createTable(
      [server1, server2],
      [server1, server3],
      [server4, server1],
      notExpired()
    )

    table.forgetRouter(server1)

    expect(table.routers).toEqual([server2])
    expect(table.readers).toEqual([server1, server3])
    expect(table.writers).toEqual([server4, server1])
  })

  it('should forget writer', () => {
    const table = createTable(
      [server1, server2, server3],
      [server2, server1, server5],
      [server5, server1],
      notExpired()
    )

    table.forgetWriter(server1)

    expect(table.routers).toEqual([server1, server2, server3])
    expect(table.readers).toEqual([server2, server1, server5])
    expect(table.writers).toEqual([server5])
  })

  it('should have correct toString', () => {
    const originalDateNow = Date.now
    try {
      Date.now = () => 4242
      const table = createTable(
        [server1, server2],
        [server3, server4],
        [server5, server6],
        42
      )
      expect(table.toString()).toEqual(
        'RoutingTable[expirationTime=42, currentTime=4242, routers=[server1:7687,server2:7687], readers=[server3:7687,server4:7687], writers=[server5:7687,server6:7687]]'
      )
    } finally {
      Date.now = originalDateNow
    }
  })

  function expired () {
    return Date.now() - 3600 // expired an hour ago
  }

  function notExpired () {
    return Date.now() + 3600 // will expire in an hour
  }

  function createTable (routers, readers, writers, expirationTime) {
    const expiration = int(expirationTime)
    return new RoutingTable(routers, readers, writers, expiration)
  }
})
