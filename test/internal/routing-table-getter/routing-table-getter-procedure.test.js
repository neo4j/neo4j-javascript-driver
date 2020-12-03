/**
 * Copyright (c) 2002-2020 "Neo4j,"
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
import ProcedureRoutingTableGetter from '../../../src/internal/routing-table-getter/routing-table-getter-procedure'
import RoutingProcedurRunner from '../../../src/internal/routing-table-getter/routing-procedure-runner'
import FakeConnection from '../fake-connection'
import {
  newError,
  SERVICE_UNAVAILABLE,
  PROTOCOL_ERROR
} from '../../../lib/error'
import ServerAddress from '../../../src/internal/server-address'
import Record from '../../../src/record'
import Integer, { int } from '../../../src/integer'
import RoutingTable from '../../../src/internal/routing-table'
import lolex from 'lolex'

const invalidRecords = [
  [],
  [newRecord(), newRecord()],
  [newRecord(), newRecord(), newRecord()]
]

const invalidAddressesFieldValues = [
  'localhost:1234',
  [{ address: 'localhost:1244' }],
  null,
  23
]

const invalidTtlValues = [null, undefined]

describe('#unit ProcedureRoutingTableGetter', () => {
  it('should call the runner with the correct params', async () => {
    const routerContext = { region: 'china' }
    const connection = new FakeConnection()
    const database = 'fake-db'
    const session = { session: 'sec' }

    const runnerCalledWith = {
      capturer (connection, database, routerContext, session) {
        this.connection = connection
        this.database = database
        this.routerContext = routerContext
        this.session = session
        return fakeResolvedResult()
      }
    }

    try {
      await callProcedureRoutingTableGetter({
        routerContext,
        connection,
        database,
        session,
        runner: new FakeRoutingProcedureRunner({
          run: runnerCalledWith.capturer.bind(runnerCalledWith)
        })
      })
    } finally {
      expect(runnerCalledWith.connection).toEqual(connection)
      expect(runnerCalledWith.database).toEqual(database)
      expect(runnerCalledWith.routerContext).toEqual(routerContext)
      expect(runnerCalledWith.session).toEqual(session)
    }
  })

  it('should return the routing table', () =>
    runWithClockAt(Date.now(), async currentTime => {
      const ttl = int(42)
      const routers = ['router:7699']
      const readers = ['reader1:7699', 'reader2:7699']
      const writers = ['writer1:7693', 'writer2:7692', 'writer3:7629']
      const database = 'db'
      const result = await callProcedureRoutingTableGetter({
        database,
        runner: new FakeRoutingProcedureRunner({
          run: () =>
            fakeResolvedResult([newRecord({ ttl, routers, readers, writers })])
        })
      })

      expect(result).toEqual(
        new RoutingTable({
          database,
          readers: readers.map(r => ServerAddress.fromUrl(r)),
          routers: routers.map(r => ServerAddress.fromUrl(r)),
          writers: writers.map(w => ServerAddress.fromUrl(w)),
          expirationTime: calculateExpirationTime(currentTime, ttl)
        })
      )
    }))

  it('should return Integer.MAX_VALUE as expirationTime when ttl overflowed', async () => {
    const ttl = int(Integer.MAX_VALUE - 2)
    const routers = ['router:7699']
    const readers = ['reader1:7699', 'reader2:7699']
    const writers = ['writer1:7693', 'writer2:7692', 'writer3:7629']
    const database = 'db'
    const result = await callProcedureRoutingTableGetter({
      database,
      runner: new FakeRoutingProcedureRunner({
        run: () =>
          fakeResolvedResult([newRecord({ ttl, routers, readers, writers })])
      })
    })
    expect(result.expirationTime).toEqual(Integer.MAX_VALUE)
  })

  it('should return Integer.MAX_VALUE as expirationTime when ttl is negative', async () => {
    const ttl = int(-2)
    const routers = ['router:7699']
    const readers = ['reader1:7699', 'reader2:7699']
    const writers = ['writer1:7693', 'writer2:7692', 'writer3:7629']
    const database = 'db'
    const result = await callProcedureRoutingTableGetter({
      database,
      runner: new FakeRoutingProcedureRunner({
        run: () =>
          fakeResolvedResult([newRecord({ ttl, routers, readers, writers })])
      })
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
        await callProcedureRoutingTableGetter({
          database,
          runner: new FakeRoutingProcedureRunner({
            run: () =>
              fakeResolvedResult([
                newRecord({ ttl, routers, readers, writers })
              ])
          })
        })
      } catch (error) {
        expect(error.code).toEqual(PROTOCOL_ERROR)
        expect(error.message).toContain('Unable to parse TTL entry from router')
      }
    })
  })

  it('should throw PROTOCOL_ERROR when ttl is not in the record', async () => {
    try {
      const database = 'db'
      await callProcedureRoutingTableGetter({
        database,
        runner: new FakeRoutingProcedureRunner({
          run: () => fakeResolvedResult([new Record(['noTtl'], ['1234'])])
        })
      })
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
        await callProcedureRoutingTableGetter({
          database,
          runner: new FakeRoutingProcedureRunner({
            run: () =>
              fakeResolvedResult([newRecord({ routers, readers, writers })])
          })
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
        await callProcedureRoutingTableGetter({
          database,
          runner: new FakeRoutingProcedureRunner({
            run: () =>
              fakeResolvedResult([newRecord({ routers, readers, writers })])
          })
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
        await callProcedureRoutingTableGetter({
          database,
          runner: new FakeRoutingProcedureRunner({
            run: () =>
              fakeResolvedResult([newRecord({ routers, readers, writers })])
          })
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
    const result = await callProcedureRoutingTableGetter({
      database,
      runner: new FakeRoutingProcedureRunner({
        run: () =>
          fakeResolvedResult([
            newRecord({ routers, readers, writers, extra: [alienRole] })
          ])
      })
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
      await callProcedureRoutingTableGetter({
        database,
        runner: new FakeRoutingProcedureRunner({
          run: () =>
            fakeResolvedResult([newRecord({ routers, readers, writers })])
        })
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
      await callProcedureRoutingTableGetter({
        database,
        runner: new FakeRoutingProcedureRunner({
          run: () =>
            fakeResolvedResult([newRecord({ routers, readers, writers })])
        })
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
    const routingTable = await callProcedureRoutingTableGetter({
      database,
      runner: new FakeRoutingProcedureRunner({
        run: () =>
          fakeResolvedResult([newRecord({ routers, readers, writers })])
      })
    })
    expect(routingTable.readers).toEqual(
      readers.map(r => ServerAddress.fromUrl(r))
    )
    expect(routingTable.routers).toEqual(
      routers.map(r => ServerAddress.fromUrl(r))
    )
    expect(routingTable.writers).toEqual(
      writers.map(r => ServerAddress.fromUrl(r))
    )
  })

  invalidRecords.forEach(records => {
    it(`should throws PROTOCOL_ERROR when records lenght is ${records.length}`, async () => {
      try {
        await callProcedureRoutingTableGetter({
          runner: new FakeRoutingProcedureRunner({
            run: () => fakeResolvedResult(records)
          })
        })
        fail('should throws an exception')
      } catch (error) {
        expect(error.code).toEqual(PROTOCOL_ERROR)
        expect(error.message).toContain('Illegal response from router')
      }
    })
  })

  it('should throws Neo.ClientError.Database.DatabaseNotFound when this error occurs while run the query', async () => {
    const expectedError = newError(
      'Some messsage',
      'Neo.ClientError.Database.DatabaseNotFound'
    )
    try {
      await callProcedureRoutingTableGetter({
        runner: new FakeRoutingProcedureRunner({
          run: () => fakeRejectedResult(expectedError)
        })
      })
      fail('Expect to throws exception')
    } catch (error) {
      expect(error).toEqual(expectedError)
    }
  })

  it('should throws SERVICE_UNAVAILABLE when Neo.ClientError.Procedure.ProcedureNotFound occurs', async () => {
    try {
      await callProcedureRoutingTableGetter({
        runner: new FakeRoutingProcedureRunner({
          run: () =>
            fakeRejectedResult(
              newError(
                'Some messsage',
                'Neo.ClientError.Procedure.ProcedureNotFound'
              )
            )
        })
      })
      fail('Expect to throws exception')
    } catch (error) {
      expect(error.code).toEqual(SERVICE_UNAVAILABLE)
    }
  })

  it('should return null when another error ocurrs', async () => {
    const result = await callProcedureRoutingTableGetter({
      runner: new FakeRoutingProcedureRunner({
        run: () =>
          fakeRejectedResult(newError('Some messsage', 'another error'))
      })
    })
    expect(result).toBeNull()
  })

  function callProcedureRoutingTableGetter ({
    routerContext = {},
    runner = new FakeRoutingProcedureRunner(),
    connection = new FakeConnection(),
    database = 'adb',
    routerAddress = 'neo4j://127.0.0.1:7687',
    session = {}
  }) {
    const getter = new ProcedureRoutingTableGetter(routerContext, runner)
    return getter.get(
      connection,
      database,
      ServerAddress.fromUrl(routerAddress),
      session
    )
  }
})

class FakeRoutingProcedureRunner extends RoutingProcedurRunner {
  constructor ({ run = shouldNotBeCalled }) {
    super()
    this._run = run
  }

  run (connection, database, routerContext, session) {
    return this._run(connection, database, routerContext, session)
  }
}

function newRecord ({
  ttl = int(42),
  routers = [],
  readers = [],
  writers = [],
  extra = []
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
  return new Record(
    ['ttl', 'servers'],
    [ttl, [...extra, routersField, readersField, writersField]]
  )
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

function fakeResolvedResult (records = null) {
  return Promise.resolve({
    records
  })
}

function fakeRejectedResult (error) {
  return Promise.reject(error)
}

function shouldNotBeCalled () {
  throw new Error('Should not be called')
}
