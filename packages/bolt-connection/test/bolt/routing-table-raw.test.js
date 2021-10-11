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
import RawRoutingTable from '../../src/bolt/routing-table-raw'
import { Record } from 'neo4j-driver-core'

describe('#unit RawRoutingTable', () => {
  describe('ofNull', () => {
    shouldReturnNullRawRoutingTable(() => RawRoutingTable.ofNull())
  })

  describe('ofRecord', () => {
    describe('when record is null', () => {
      shouldReturnNullRawRoutingTable(() => RawRoutingTable.ofRecord(null))
    })

    describe('when record has servers, db and ttl', () => {
      it('should return isNull equals false', () => {
        const record = newRecord({
          ttl: 123,
          servers: [{ role: 'READ', addresses: ['127.0.0.1'] }],
          db: 'homedb'
        })
        const result = RawRoutingTable.ofRecord(record)
        expect(result.isNull).toEqual(false)
      })

      it('should return the ttl', () => {
        const record = newRecord({
          ttl: 123,
          servers: [{ role: 'READ', addresses: ['127.0.0.1'] }],
          db: 'homedb'
        })
        const result = RawRoutingTable.ofRecord(record)
        expect(result.ttl).toEqual(123)
      })

      it('should return the servers', () => {
        const record = newRecord({
          ttl: 123,
          servers: [{ role: 'READ', addresses: ['127.0.0.1'] }],
          db: 'homedb'
        })
        const result = RawRoutingTable.ofRecord(record)
        expect(result.servers).toEqual([
          { role: 'READ', addresses: ['127.0.0.1'] }
        ])
      })

      it('should return the db', () => {
        const record = newRecord({
          ttl: 123,
          servers: [{ role: 'READ', addresses: ['127.0.0.1'] }],
          db: 'homedb'
        })
        const result = RawRoutingTable.ofRecord(record)
        expect(result.db).toEqual('homedb')
      })
    })

    describe('when record has servers and but no ttl', () => {
      it('should return isNull equals false', () => {
        const record = newRecord({
          noTtl: 123,
          servers: [{ role: 'READ', addresses: ['127.0.0.1'] }]
        })
        const result = RawRoutingTable.ofRecord(record)
        expect(result.isNull).toEqual(false)
      })

      it('should throws when try to get ttl', () => {
        const record = newRecord({
          noTtl: 123,
          servers: [{ role: 'READ', addresses: ['127.0.0.1'] }]
        })
        const result = RawRoutingTable.ofRecord(record)
        expect(() => result.ttl).toThrow()
      })

      it('should return the servers', () => {
        const record = newRecord({
          noTtl: 123,
          servers: [{ role: 'READ', addresses: ['127.0.0.1'] }]
        })
        const result = RawRoutingTable.ofRecord(record)
        expect(result.servers).toEqual([
          { role: 'READ', addresses: ['127.0.0.1'] }
        ])
      })
    })

    describe('when record has ttl and but no servers', () => {
      it('should return isNull equals false', () => {
        const record = newRecord({
          ttl: 123,
          noServers: [{ role: 'READ', addresses: ['127.0.0.1'] }]
        })
        const result = RawRoutingTable.ofRecord(record)
        expect(result.isNull).toEqual(false)
      })

      it('should return the ttl', () => {
        const record = newRecord({
          ttl: 123,
          noServers: [{ role: 'READ', addresses: ['127.0.0.1'] }]
        })
        const result = RawRoutingTable.ofRecord(record)
        expect(result.ttl).toEqual(123)
      })

      it('should hrows when try to get servers', () => {
        const record = newRecord({
          ttl: 123,
          noServers: [{ role: 'READ', addresses: ['127.0.0.1'] }]
        })
        const result = RawRoutingTable.ofRecord(record)
        expect(() => result.servers).toThrow()
      })
    })

    describe('when record does not have db name', () => {
      it('should return db equals null', () => {
        const record = newRecord({
          ttl: 123,
          noServers: [{ role: 'READ', addresses: ['127.0.0.1'] }]
        })
        const result = RawRoutingTable.ofRecord(record)
        expect(result.db).toEqual(null)
      })

    })
  })

  describe('ofMessageResponse', () => {
    shouldReturnNullRawRoutingTable(() =>
      RawRoutingTable.ofMessageResponse(null)
    )

    it('should return isNull equals false', () => {
      const response = newResponse({
        ttl: 123,
        servers: [{ role: 'READ', addresses: ['127.0.0.1'] }]
      })
      const result = RawRoutingTable.ofMessageResponse(response)
      expect(result.isNull).toEqual(false)
    })

    it('should return the ttl', () => {
      const response = newResponse({
        ttl: 123,
        servers: [{ role: 'READ', addresses: ['127.0.0.1'] }]
      })
      const result = RawRoutingTable.ofMessageResponse(response)
      expect(result.ttl).toEqual(123)
    })

    it('should return the servers', () => {
      const response = newResponse({
        ttl: 123,
        servers: [{ role: 'READ', addresses: ['127.0.0.1'] }]
      })
      const result = RawRoutingTable.ofMessageResponse(response)
      expect(result.servers).toEqual([
        { role: 'READ', addresses: ['127.0.0.1'] }
      ])
    })

    it('should return the db', () => {
      const response = newResponse({
        ttl: 123,
        servers: [{ role: 'READ', addresses: ['127.0.0.1'] }],
        db: 'homedb'
      })
      const result = RawRoutingTable.ofMessageResponse(response)
      expect(result.db).toEqual('homedb')
    })
  })

  function shouldReturnNullRawRoutingTable (subject) {
    it('should create a null routing table', () => {
      const result = subject()

      expect(result.isNull).toEqual(true)
    })

    it('should not implement ttl', () => {
      expect(() => {
        const ttl = subject().ttl
        fail(`it should not return ${ttl}`)
      }).toThrow(new Error('Not implemented'))
    })

    it('should not implement servers', () => {
      expect(() => {
        const servers = subject().servers
        fail(`it should not return ${servers}`)
      }).toThrow(new Error('Not implemented'))
    })

    it('should not implement db', () => {
      expect(() => {
        const db = subject().db
        fail(`it should not return ${db}`)
      }).toThrow(new Error('Not implemented'))
    })
  }

  function newRecord (params = {}) {
    return new Record(Object.keys(params), Object.values(params))
  }

  function newResponse (params = {}) {
    return {
      rt: { ...params }
    }
  }
})
