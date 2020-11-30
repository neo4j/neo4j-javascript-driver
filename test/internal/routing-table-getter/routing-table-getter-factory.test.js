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
import RoutingTableGetterFactory from '../../../src/internal/routing-table-getter/routing-table-getter-factory'
import ProcedureRoutingTableGetter from '../../../src/internal/routing-table-getter/routing-table-getter-procedure'
import MultiDatabaseRoutingProcedureRunner from '../../../src/internal/routing-table-getter/routing-procedure-runner-multi-database'
import SingleDatabaseRoutingProcedureRunner from '../../../src/internal/routing-table-getter/routing-procedure-runner-single-database'
import FakeConnection from '../fake-connection'

const routingTableProcedureVersions = [3, 4, 4.1, 4.2]
const singleDatabaseProcedureVersion = routingTableProcedureVersions.filter(
  version => version < 4
)
const multiDatabaseProcedureVersion = routingTableProcedureVersions.filter(
  version => version >= 4
)

describe('#unit RoutingTableGetterFactory', () => {
  routingTableProcedureVersions.forEach(version => {
    it(`should create ProcedureRoutingTableGetter when the protocol version is ${version}`, () => {
      const connection = new FakeConnection().withProtocolVersion(version)
      const routingContext = { region: 'china' }
      const getter = createRoutingTableGetter({ connection, routingContext })

      expect(getter).toEqual(jasmine.any(ProcedureRoutingTableGetter))
      expect(getter._routingContext).toEqual(routingContext)
      expect(getter._)
    })
  })

  singleDatabaseProcedureVersion.forEach(version => {
    it(`should configure SingleDatabaseRoutingProcedureRunner as the runner in the getter when the protocol version is ${version}`, () => {
      const connection = new FakeConnection().withProtocolVersion(3)
      const getter = createRoutingTableGetter({ connection })

      expect(getter._runner).toEqual(
        jasmine.any(SingleDatabaseRoutingProcedureRunner)
      )
    })
  })

  multiDatabaseProcedureVersion.forEach(version => {
    it(`should configure MultiDatabaseRoutingProcedureRunner as the runner in the getter when the protocol version is ${version}`, () => {
      const connection = new FakeConnection().withProtocolVersion(version)
      const initialAddress = 'localhost'
      const getter = createRoutingTableGetter({ connection, initialAddress })

      expect(getter._runner).toEqual(
        jasmine.any(MultiDatabaseRoutingProcedureRunner)
      )
      expect(getter._runner._initialAddress).toEqual(initialAddress)
    })
  })

  function createRoutingTableGetter ({
    connection,
    routingContext = {},
    initialAddress = '127.0.0.1'
  }) {
    const factory = new RoutingTableGetterFactory(
      routingContext,
      initialAddress
    )
    return factory.create(connection)
  }
})
