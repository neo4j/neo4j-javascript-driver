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

import RoundRobinArray from './round-robin-array';
import {newError, PROTOCOL_ERROR, SERVICE_UNAVAILABLE} from '../error';
import Integer, {int} from '../integer';

const PROCEDURE_CALL = 'CALL dbms.cluster.routing.getServers';
const PROCEDURE_NOT_FOUND_CODE = 'Neo.ClientError.Procedure.ProcedureNotFound';

export default class GetServersUtil {

  callGetServers(session, routerAddress) {
    return session.run(PROCEDURE_CALL).then(result => {
      session.close();
      return result.records;
    }).catch(error => {
      if (error.code === PROCEDURE_NOT_FOUND_CODE) {
        // throw when getServers procedure not found because this is clearly a configuration issue
        throw newError('Server ' + routerAddress + ' could not perform routing. ' +
          'Make sure you are connecting to a causal cluster', SERVICE_UNAVAILABLE);
      }
      // return nothing when failed to connect because code higher in the callstack is still able to retry with a
      // different session towards a different router
      return null;
    });
  }

  parseTtl(record, routerAddress) {
    try {
      const now = int(Date.now());
      const expires = record.get('ttl').multiply(1000).add(now);
      // if the server uses a really big expire time like Long.MAX_VALUE this may have overflowed
      if (expires.lessThan(now)) {
        return Integer.MAX_VALUE;
      }
      return expires;
    } catch (error) {
      throw newError(
        'Unable to parse TTL entry from router ' + routerAddress + ' from record:\n' + JSON.stringify(record),
        PROTOCOL_ERROR);
    }
  }

  parseServers(record, routerAddress) {
    try {
      const servers = record.get('servers');

      const routers = new RoundRobinArray();
      const readers = new RoundRobinArray();
      const writers = new RoundRobinArray();

      servers.forEach(server => {
        const role = server['role'];
        const addresses = server['addresses'];

        if (role === 'ROUTE') {
          routers.pushAll(addresses);
        } else if (role === 'WRITE') {
          writers.pushAll(addresses);
        } else if (role === 'READ') {
          readers.pushAll(addresses);
        } else {
          throw newError('Unknown server role "' + role + '"', PROTOCOL_ERROR);
        }
      });

      return {
        routers: routers,
        readers: readers,
        writers: writers
      }
    } catch (ignore) {
      throw newError(
        'Unable to parse servers entry from router ' + routerAddress + ' from record:\n' + JSON.stringify(record),
        PROTOCOL_ERROR);
    }
  }
}
