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
import RoutingTable from '../../../bolt-connection/lib/rediscovery/routing-table'
import { READ, WRITE } from '../../src/driver'
import { RawRoutingTable } from '../../../bolt-connection/lib/bolt'
import { error, Integer, int, internal } from 'neo4j-driver-core'
import lolex from 'lolex'

const {
  serverAddress: { ServerAddress }
} = internal

const { PROTOCOL_ERROR } = error

const invalidAddressesFieldValues = [
  'localhost:1234',
  [{ address: 'localhost:1244' }],
  null,
  23
]

const invalidTtlValues = [null, undefined]

describe('#unit RoutingTable', () => {
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
        42,
        'myDatabase'
      )
      expect(table.toString()).toEqual(
        'RoutingTable[database=myDatabase, expirationTime=42, currentTime=4242, routers=[server1:7687,server2:7687], readers=[server3:7687,server4:7687], writers=[server5:7687,server6:7687]]'
      )
    } finally {
      Date.now = originalDateNow
    }
  })

  it('should report correct value when expired for is tested', () => {
    const originalDateNow = Date.now
    try {
      Date.now = () => 50000
      const table = createTable(
        [server1, server2, server3],
        [server2, server1, server5],
        [server5, server1],
        expired(7200)
      )

      expect(table.isStaleFor(READ)).toBeTruthy()
      expect(table.isStaleFor(WRITE)).toBeTruthy()

      expect(table.isExpiredFor(3600)).toBeTruthy()
      expect(table.isExpiredFor(10800)).toBeFalsy()
    } finally {
      Date.now = originalDateNow
    }
  })

  describe('fromRawRoutingTable', () => {
    it('should return the routing table', () =>
      runWithClockAt(Date.now(), async currentTime => {
        const ttl = int(42)
        const routers = ['router:7699']
        const readers = ['reader1:7699', 'reader2:7699']
        const writers = ['writer1:7693', 'writer2:7692', 'writer3:7629']
        const database = 'db'

        const result = routingTable({
          database,
          metadata: newMetadata({ ttl, routers, readers, writers })
        })

        expect(result).toEqual(
          new RoutingTable({
            database,
            readers: readers.map(r => ServerAddress.fromUrl(r)),
            routers: routers.map(r => ServerAddress.fromUrl(r)),
            writers: writers.map(w => ServerAddress.fromUrl(w)),
            expirationTime: calculateExpirationTime(currentTime, ttl),
            ttl
          })
        )
      }))

    it('should return Integer.MAX_VALUE as expirationTime when ttl overflowed', async () => {
      const ttl = int(Integer.MAX_VALUE - 2)
      const routers = ['router:7699']
      const readers = ['reader1:7699', 'reader2:7699']
      const writers = ['writer1:7693', 'writer2:7692', 'writer3:7629']
      const database = 'db'

      const result = routingTable({
        database,
        metadata: newMetadata({ ttl, routers, readers, writers })
      })

      expect(result.expirationTime).toEqual(Integer.MAX_VALUE)
    })
    ;[
      [undefined, undefined, null],
      [undefined, null, null],
      [undefined, 'homedb2', 'homedb2'],
      [null, undefined, null],
      [null, null, null],
      [null, 'homedb2', 'homedb2'],
      ['homedb', undefined, 'homedb'],
      ['homedb', null, 'homedb'],
      ['homedb', 'homedb2', 'homedb']
    ].forEach(([database, databaseInMetadata, expected]) => {
      it(`should return resolve correctly the database [database=${database}, databaseInMetadata=${databaseInMetadata}]`, () => {
        const routers = ['router:7699']
        const readers = ['reader1:7699', 'reader2:7699']
        const writers = ['writer1:7693', 'writer2:7692', 'writer3:7629']

        const result = RoutingTable.fromRawRoutingTable(
          database,
          ServerAddress.fromUrl('localhost:7687'),
          RawRoutingTable.ofMessageResponse(
            newMetadata({
              routers,
              readers,
              writers,
              database: databaseInMetadata
            })
          )
        )

        expect(result.database).toEqual(expected)
      })
    })

    it('should return Integer.MAX_VALUE as expirationTime when ttl is negative', async () => {
      const ttl = int(-2)
      const routers = ['router:7699']
      const readers = ['reader1:7699', 'reader2:7699']
      const writers = ['writer1:7693', 'writer2:7692', 'writer3:7629']
      const database = 'db'

      const result = routingTable({
        database,
        metadata: newMetadata({ ttl, routers, readers, writers })
      })

      expect(result.expirationTime).toEqual(Integer.MAX_VALUE)
    })

    invalidTtlValues.forEach(invalidTtlValue => {
      it(`should throw PROTOCOL_ERROR when ttl is not valid [${invalidTtlValue}]`, async () => {
        try {
          const ttl = invalidTtlValue
          const routers = ['router:7699']
          const readers = ['reader1:7699', 'reader2:7699']
          const writers = ['writer1:7693', 'writer2:7692', 'writer3:7629']
          const database = 'db'

          routingTable({
            database,
            metadata: newMetadata({ ttl, routers, readers, writers })
          })
        } catch (error) {
          expect(error.code).toEqual(PROTOCOL_ERROR)
          expect(error.message).toContain(
            'Unable to parse TTL entry from router'
          )
        }
      })
    })

    it('should throw PROTOCOL_ERROR when ttl is not in the metatadata', async () => {
      try {
        const database = 'db'

        routingTable({ database, metadata: { rt: { noTtl: 123 } } })
      } catch (error) {
        expect(error.code).toEqual(PROTOCOL_ERROR)
        expect(error.message).toContain('Unable to parse TTL entry from router')
      }
    })

    invalidAddressesFieldValues.forEach(invalidAddressFieldValue => {
      it(`should throw PROTOCOL_ERROR when routers is not valid [${invalidAddressFieldValue}]`, async () => {
        try {
          const routers = invalidAddressFieldValue
          const readers = ['reader1:7699', 'reader2:7699']
          const writers = ['writer1:7693', 'writer2:7692', 'writer3:7629']
          const database = 'db'

          routingTable({
            database,
            metadata: newMetadata({ routers, readers, writers })
          })
          fail('should not succeed')
        } catch (error) {
          expect(error.code).toEqual(PROTOCOL_ERROR)
          expect(error.message).toContain(
            'Unable to parse servers entry from router'
          )
        }
      })

      it(`should throw PROTOCOL_ERROR when readers is not valid [${invalidAddressFieldValue}]`, async () => {
        try {
          const routers = ['router:7699']
          const readers = invalidAddressFieldValue
          const writers = ['writer1:7693', 'writer2:7692', 'writer3:7629']
          const database = 'db'

          routingTable({
            database,
            metadata: newMetadata({ routers, readers, writers })
          })
          fail('should not succeed')
        } catch (error) {
          expect(error.code).toEqual(PROTOCOL_ERROR)
          expect(error.message).toContain(
            'Unable to parse servers entry from router'
          )
        }
      })

      it(`should throw PROTOCOL_ERROR when writers is not valid [${invalidAddressFieldValue}]`, async () => {
        try {
          const routers = ['router:7699']
          const readers = ['reader1:7699', 'reader2:7699']
          const writers = invalidAddressFieldValue
          const database = 'db'

          routingTable({
            database,
            metadata: newMetadata({ routers, readers, writers })
          })
          fail('should not succeed')
        } catch (error) {
          expect(error.code).toEqual(PROTOCOL_ERROR)
          expect(error.message).toContain(
            'Unable to parse servers entry from router'
          )
        }
      })
    })

    it('should return the known roles independent of the alien roles', async () => {
      const routers = ['router:7699']
      const readers = ['reader1:7699', 'reader2:7699']
      const writers = ['writer1:7693', 'writer2:7692', 'writer3:7629']
      const alienRole = {
        role: 'ALIEN_ROLE',
        addresses: ['alien:7699']
      }
      const database = 'db'

      const result = routingTable({
        database,
        metadata: newMetadata({ routers, readers, writers, extra: [alienRole] })
      })

      expect(result.readers).toEqual(readers.map(r => ServerAddress.fromUrl(r)))
      expect(result.routers).toEqual(routers.map(r => ServerAddress.fromUrl(r)))
      expect(result.writers).toEqual(writers.map(r => ServerAddress.fromUrl(r)))
    })

    it('should throw PROTOCOL_ERROR when there is no routers', async () => {
      try {
        const routers = []
        const readers = ['reader1:7699', 'reader2:7699']
        const writers = ['writer1:7693', 'writer2:7692', 'writer3:7629']
        const database = 'db'

        routingTable({
          database,
          metadata: newMetadata({ routers, readers, writers })
        })

        fail('should not succeed')
      } catch (error) {
        expect(error.code).toEqual(PROTOCOL_ERROR)
        expect(error.message).toContain('Received no')
      }
    })

    it('should throw PROTOCOL_ERROR when there is no readers', async () => {
      try {
        const routers = ['router:7699']
        const readers = []
        const writers = ['writer1:7693', 'writer2:7692', 'writer3:7629']
        const database = 'db'

        routingTable({
          database,
          metadata: newMetadata({ routers, readers, writers })
        })

        fail('should not succeed')
      } catch (error) {
        expect(error.code).toEqual(PROTOCOL_ERROR)
        expect(error.message).toContain('Received no')
      }
    })

    it('should return the routing when there is no writers', async () => {
      const routers = ['router:7699']
      const readers = ['reader1:7699', 'reader2:7699']
      const writers = []
      const database = 'db'
      const result = routingTable({
        database,
        metadata: newMetadata({ routers, readers, writers })
      })

      expect(result.readers).toEqual(readers.map(r => ServerAddress.fromUrl(r)))
      expect(result.routers).toEqual(routers.map(r => ServerAddress.fromUrl(r)))
      expect(result.writers).toEqual(writers.map(r => ServerAddress.fromUrl(r)))
    })

    function routingTable ({
      database = 'database',
      serverAddress = 'localhost:7687',
      metadata
    } = {}) {
      return RoutingTable.fromRawRoutingTable(
        database,
        ServerAddress.fromUrl(serverAddress),
        RawRoutingTable.ofMessageResponse(metadata)
      )
    }

    function newMetadata ({
      ttl = int(42),
      routers = [],
      readers = [],
      writers = [],
      extra = [],
      database = undefined
    } = {}) {
      const routersField = {
        role: 'ROUTE',
        addresses: routers
      }
      const readersField = {
        role: 'READ',
        addresses: readers
      }
      const writersField = {
        role: 'WRITE',
        addresses: writers
      }
      return {
        rt: {
          ttl,
          servers: [routersField, readersField, writersField, ...extra],
          db: database
        }
      }
    }

    async function runWithClockAt (currentTime, callback) {
      const clock = lolex.install()
      try {
        clock.setSystemTime(currentTime)
        return await callback(currentTime)
      } finally {
        clock.uninstall()
      }
    }

    function calculateExpirationTime (currentTime, ttl) {
      return int(currentTime + ttl.toNumber() * 1000)
    }
  })
  function expired (expiredFor) {
    return Date.now() - (expiredFor || 3600) // expired an hour ago
  }

  function notExpired () {
    return Date.now() + 3600 // will expire in an hour
  }

  function createTable (routers, readers, writers, expirationTime, database) {
    return new RoutingTable({
      database,
      routers,
      readers,
      writers,
      expirationTime: int(expirationTime)
    })
  }
})
