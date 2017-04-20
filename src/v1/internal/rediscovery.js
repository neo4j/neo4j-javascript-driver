/**
 * Copyright (c) 2002-2017 "Neo Technology,","
 * Network Engine for Objects in Lund AB [http://neotechnology.com]
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

import GetServersUtil from "./get-servers-util";
import RoutingTable from "./routing-table";
import {newError, PROTOCOL_ERROR} from "../error";

export default class Rediscovery {

  constructor(getServersUtil) {
    this._getServersUtil = getServersUtil;
  }

  lookupRoutingTableOnRouter(session, routerAddress) {
    return this._getServersUtil.callGetServers(session, routerAddress).then(records => {
      if (records === null) {
        // connection error happened, unable to retrieve routing table from this router, next one should be queried
        return null;
      }

      if (records.length !== 1) {
        throw newError('Illegal response from router "' + routerAddress + '". ' +
          'Received ' + records.length + ' records but expected only one.\n' + JSON.stringify(records),
          PROTOCOL_ERROR);
      }

      const record = records[0];

      const expirationTime = this._getServersUtil.parseTtl(record, routerAddress);
      const {routers, readers, writers} = this._getServersUtil.parseServers(record, routerAddress);

      Rediscovery._assertNonEmpty(routers, 'routers', routerAddress);
      Rediscovery._assertNonEmpty(readers, 'readers', routerAddress);
      // case with no writers is processed higher in the promise chain because only RoutingDriver knows
      // how to deal with such table and how to treat router that returned such table

      return new RoutingTable(routers, readers, writers, expirationTime);
    });
  }

  static _assertNonEmpty(serversRoundRobinArray, serversName, routerAddress) {
    if (serversRoundRobinArray.isEmpty()) {
      throw newError('Received no ' + serversName + ' from router ' + routerAddress, PROTOCOL_ERROR);
    }
  }
}
