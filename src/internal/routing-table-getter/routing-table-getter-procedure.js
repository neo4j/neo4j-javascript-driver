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
import { newError, PROTOCOL_ERROR } from '../../error'
import ServerAddress from '../server-address'
import RoutingTable from '../routing-table'
import Session from '../../session'
import RoutingProcedureRunner from './routing-procedure-runner'
import {
  createValidRoutingTable,
  RawRoutingTable,
  runWithExceptionTreament
} from './routing-table-factory'

/**
 * Get the routing table by running the procedure
 */
export default class ProcedureRoutingTableGetter {
  /**
   * Constructor
   * @param {Object} routingContext
   * @param {RoutingProcedureRunner} runner the procedure runner
   */
  constructor (routingContext, runner) {
    this._runner = runner
    this._routingContext = routingContext
  }

  /**
   * Get the routing table by running the routing table procedure
   *
   * @param {Connection} connection The connection use
   * @param {string} database the database
   * @param {ServerAddress} routerAddress the router address
   * @param {Session} session the session which was used to get the connection,
   *                 it will be used to get lastBookmark and other properties
   *
   * @returns {Promise<RoutingTable>} The routing table
   */
  async get (connection, database, routerAddress, session) {
    const records = await runWithExceptionTreament(routerAddress, () =>
      this._runProcedure(connection, database, session)
    )
    if (records === null) {
      return null // it should go to another layer to retry
    }

    if (records.length !== 1) {
      throw newError(
        'Illegal response from router "' +
          routerAddress +
          '". ' +
          'Received ' +
          records.length +
          ' records but expected only one.\n' +
          JSON.stringify(records),
        PROTOCOL_ERROR
      )
    }

    const record = records[0]
    const rawRoutingTable = new RecordRawRoutingTable(record)

    return createValidRoutingTable(database, routerAddress, rawRoutingTable)
  }

  /**
   * Run the routing query and fetch the records
   *
   * @param {Connection} connection the connection
   * @param {string} database the database
   * @param {Session} session the session which was used to get the connection,
   *                 it will be used to get lastBookmark and other properties
   *
   * @returns {Promise<Record[]>} the list of records fetched
   */
  async _runProcedure (connection, database, session) {
    const result = await this._runner.run(
      connection,
      database,
      this._routingContext,
      session
    )
    return result.records
  }
}

/**
 * Get the raw routing table information from the record
 */
class RecordRawRoutingTable extends RawRoutingTable {
  constructor (record) {
    super()
    this._record = record
  }

  get ttl () {
    return this._record.get('ttl')
  }

  get servers () {
    return this._record.get('servers')
  }
}
