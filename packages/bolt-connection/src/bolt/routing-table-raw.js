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
import Record from 'neo4j-driver-core'

/**
 * Represente the raw version of the routing table
 */
export default class RawRoutingTable {
  /**
   * Constructs the raw routing table for Record based result
   * @param {Record} record The record which will be used get the raw routing table
   * @returns {RawRoutingTable} The raw routing table
   */
  static ofRecord (record) {
    if (record === null) {
      return RawRoutingTable.ofNull()
    }
    return new RecordRawRoutingTable(record)
  }

  /**
   * Constructs the raw routing table for Success result for a Routing Message
   * @param {object} response The result
   * @returns {RawRoutingTable} The raw routing table
   */
  static ofMessageResponse (response) {
    if (response === null) {
      return RawRoutingTable.ofNull()
    }
    return new ResponseRawRoutingTable(response)
  }

  /**
   * Construct the raw routing table of a null response
   *
   * @returns {RawRoutingTable} the raw routing table
   */
  static ofNull () {
    return new NullRawRoutingTable()
  }

  /**
   * Get raw ttl
   *
   * @returns {number|string} ttl Time to live
   */
  get ttl () {
    throw new Error('Not implemented')
  }

  /**
   * Get raw db
   *
   * @returns {string?} The database name
   */
  get db () {
    throw new Error('Not implemented')
  }

  /**
   *
   * @typedef {Object} ServerRole
   * @property {string} role the role of the address on the cluster
   * @property {string[]} addresses the address within the role
   *
   * @return {ServerRole[]} list of servers addresses
   */
  get servers () {
    throw new Error('Not implemented')
  }

  /**
   * Indicates the result is null
   *
   * @returns {boolean} Is null
   */
  get isNull () {
    throw new Error('Not implemented')
  }
}

/**
 * Get the raw routing table information from route message response
 */
class ResponseRawRoutingTable extends RawRoutingTable {
  constructor (response) {
    super()
    this._response = response
  }

  get ttl () {
    return this._response.rt.ttl
  }

  get servers () {
    return this._response.rt.servers
  }

  get db () {
    return this._response.rt.db
  }

  get isNull () {
    return this._response === null
  }
}

/**
 * Null routing table
 */
class NullRawRoutingTable extends RawRoutingTable {
  get isNull () {
    return true
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

  get db () {
    return this._record.has('db') ? this._record.get('db') : null
  }

  get isNull () {
    return this._record === null
  }
}
