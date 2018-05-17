/**
 * Copyright (c) 2002-2018 "Neo4j,"
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

import neo4j from '../../src/v1';
import {READ, WRITE} from '../../src/v1/driver';
import parallelLimit from 'async/parallelLimit';
import _ from 'lodash';
import {ServerVersion, VERSION_3_2_0} from '../../src/v1/internal/server-version';
import sharedNeo4j from '../internal/shared-neo4j';

describe('stress tests', () => {

  const TEST_MODES = {
    fast: {
      commandsCount: 5000,
      parallelism: 8,
      maxRunTimeMs: 10 * 60000 // 10 minutes
    },
    extended: {
      commandsCount: 2000000,
      parallelism: 16,
      maxRunTimeMs: 60 * 60000 // 60 minutes
    }
  };

  const READ_QUERY = 'MATCH (n) RETURN n LIMIT 1';
  const WRITE_QUERY = 'CREATE (person:Person:Employee {name: {name}, salary: {salary}}) RETURN person';

  const TEST_MODE = modeFromEnvOrDefault('STRESS_TEST_MODE');
  const DATABASE_URI = fromEnvOrDefault('STRESS_TEST_DATABASE_URI', 'bolt://localhost');
  const LOGGING_ENABLED = fromEnvOrDefault('STRESS_TEST_LOGGING_ENABLED', false);

  let originalJasmineTimeout;
  let driver;

  beforeEach(done => {
    driver = neo4j.driver(DATABASE_URI, sharedNeo4j.authToken);

    cleanupDb(driver).then(() => done());
  });

  afterEach(done => {
    cleanupDb(driver).then(() => {
      driver.close();
      done();
    });
  });

  it('basic', done => {
    const context = new Context(driver, LOGGING_ENABLED);
    const commands = createCommands(context);

    console.time('Basic-stress-test');
    parallelLimit(commands, TEST_MODE.parallelism, error => {
      console.timeEnd('Basic-stress-test');

      if (error) {
        done.fail(error);
      }

      verifyServers(context)
        .then(() => verifyNodeCount(context))
        .then(() => done())
        .catch(error => done.fail(error));
    });
  }, TEST_MODE.maxRunTimeMs);

  function createCommands(context) {
    const uniqueCommands = createUniqueCommands(context);

    const commands = [];
    for (let i = 0; i < TEST_MODE.commandsCount; i++) {
      const randomCommand = _.sample(uniqueCommands);
      commands.push(randomCommand);
    }

    console.log(`Generated ${TEST_MODE.commandsCount} commands`);

    return commands;
  }

  function createUniqueCommands(context) {
    return [
      readQueryCommand(context),
      readQueryWithBookmarkCommand(context),
      readQueryInTxCommand(context),
      readQueryInTxWithBookmarkCommand(context),
      writeQueryCommand(context),
      writeQueryWithBookmarkCommand(context),
      writeQueryInTxCommand(context),
      writeQueryInTxWithBookmarkCommand(context)
    ];
  }

  function readQueryCommand(context) {
    return queryCommand(context, READ_QUERY, () => noParams(), READ, false);
  }

  function readQueryWithBookmarkCommand(context) {
    return queryCommand(context, READ_QUERY, () => noParams(), READ, true);
  }

  function readQueryInTxCommand(context) {
    return queryInTxCommand(context, READ_QUERY, () => noParams(), READ, false);
  }

  function readQueryInTxWithBookmarkCommand(context) {
    return queryInTxCommand(context, READ_QUERY, () => noParams(), READ, true);
  }

  function writeQueryCommand(context) {
    return queryCommand(context, WRITE_QUERY, () => randomParams(), WRITE, false);
  }

  function writeQueryWithBookmarkCommand(context) {
    return queryCommand(context, WRITE_QUERY, () => randomParams(), WRITE, true);
  }

  function writeQueryInTxCommand(context) {
    return queryInTxCommand(context, WRITE_QUERY, () => randomParams(), WRITE, false);
  }

  function writeQueryInTxWithBookmarkCommand(context) {
    return queryInTxCommand(context, WRITE_QUERY, () => randomParams(), WRITE, true);
  }

  function queryCommand(context, query, paramsSupplier, accessMode, useBookmark) {
    return callback => {
      const commandId = context.nextCommandId();
      const session = newSession(context, accessMode, useBookmark);
      const params = paramsSupplier();

      context.log(commandId, `About to run ${accessMode} query`);

      session.run(query, params).then(result => {
        context.queryCompleted(result, accessMode);
        context.log(commandId, `Query completed successfully`);

        session.close(() => {
          const possibleError = verifyQueryResult(result);
          callback(possibleError);
        });
      }).catch(error => {
        context.log(commandId, `Query failed with error ${JSON.stringify(error)}`);
        callback(error);
      });
    };
  }

  function queryInTxCommand(context, query, paramsSupplier, accessMode, useBookmark) {
    return callback => {
      const commandId = context.nextCommandId();
      const session = newSession(context, accessMode, useBookmark);
      const tx = session.beginTransaction();
      const params = paramsSupplier();

      context.log(commandId, `About to run ${accessMode} query in TX`);

      tx.run(query, params).then(result => {
        let commandError = verifyQueryResult(result);

        tx.commit().catch(commitError => {
          context.log(commandId, `Transaction commit failed with error ${JSON.stringify(error)}`);
          if (!commandError) {
            commandError = commitError;
          }
        }).then(() => {
          context.queryCompleted(result, accessMode, session.lastBookmark());
          context.log(commandId, `Transaction committed successfully`);

          session.close(() => {
            callback(commandError);
          });
        });

      }).catch(error => {
        context.log(commandId, `Query failed with error ${JSON.stringify(error)}`);
        callback(error);
      });
    };
  }

  function verifyQueryResult(result) {
    if (!result) {
      return new Error(`Received undefined result`);
    } else if (result.records.length === 0) {
      // it is ok to receive no nodes back for read queries at the beginning of the test
      return null;
    } else if (result.records.length === 1) {
      const record = result.records[0];
      return verifyRecord(record);
    } else {
      return new Error(`Unexpected amount of records received: ${JSON.stringify(result)}`);
    }
  }

  function verifyRecord(record) {
    const node = record.get(0);

    if (!arraysEqual(['Person', 'Employee'], node.labels)) {
      return new Error(`Unexpected labels in node: ${JSON.stringify(node)}`);
    }

    const propertyKeys = _.keys(node.properties);
    if (!_.isEmpty(propertyKeys) && !arraysEqual(['name', 'salary'], propertyKeys)) {
      return new Error(`Unexpected property keys in node: ${JSON.stringify(node)}`);
    }

    return null;
  }

  function verifyNodeCount(context) {
    const expectedNodeCount = context.createdNodesCount;

    const session = context.driver.session();
    return session.run('MATCH (n) RETURN count(n)').then(result => {
      const record = result.records[0];
      const count = record.get(0).toNumber();

      if (count !== expectedNodeCount) {
        throw new Error(`Unexpected node count: ${count}, expected: ${expectedNodeCount}`);
      }
    });
  }

  function verifyServers(context) {
    const routing = DATABASE_URI.indexOf('bolt+routing') === 0;

    if (routing) {
      return verifyCausalClusterMembers(context);
    }
    return verifySingleInstance(context);
  }

  function verifySingleInstance(context) {
    return new Promise(resolve => {
      const readServerAddresses = context.readServerAddresses();
      const writeServerAddresses = context.writeServerAddresses();

      expect(readServerAddresses.length).toEqual(1);
      expect(writeServerAddresses.length).toEqual(1);
      expect(readServerAddresses).toEqual(writeServerAddresses);

      const address = readServerAddresses[0];
      expect(context.readServersWithQueryCount[address]).toBeGreaterThan(1);
      expect(context.writeServersWithQueryCount[address]).toBeGreaterThan(1);

      resolve();
    });
  }

  function verifyCausalClusterMembers(context) {
    return fetchClusterAddresses(context).then(clusterAddresses => {
      // before 3.2.0 only read replicas serve reads
      const readsOnFollowersEnabled = context.serverVersion.compareTo(VERSION_3_2_0) >= 0;

      if (readsOnFollowersEnabled) {
        // expect all followers to serve more than zero read queries
        assertAllAddressesServedReadQueries(clusterAddresses.followers, context.readServersWithQueryCount);
      }

      // expect all read replicas to serve more than zero read queries
      assertAllAddressesServedReadQueries(clusterAddresses.readReplicas, context.readServersWithQueryCount);

      if (readsOnFollowersEnabled) {
        // expect all followers to serve same order of magnitude read queries
        assertAllAddressesServedSimilarAmountOfReadQueries(clusterAddresses.followers, context.readServersWithQueryCount);
      }

      // expect all read replicas to serve same order of magnitude read queries
      assertAllAddressesServedSimilarAmountOfReadQueries(clusterAddresses.readReplicas,
        context.readServersWithQueryCount);
    });
  }

  function fetchClusterAddresses(context) {
    const session = context.driver.session();
    return session.run('CALL dbms.cluster.overview()').then(result => {
      session.close();
      const records = result.records;

      const followers = addressesWithRole(records, 'FOLLOWER');
      const readReplicas = addressesWithRole(records, 'READ_REPLICA');

      return new ClusterAddresses(followers, readReplicas);
    });
  }

  function addressesWithRole(records, role) {
    return _.uniq(records.filter(record => record.get('role') === role)
      .map(record => record.get('addresses')[0].replace('bolt://', '')));
  }

  function assertAllAddressesServedReadQueries(addresses, readQueriesByServer) {
    addresses.forEach(address => {
      const queries = readQueriesByServer[address];
      expect(queries).toBeGreaterThan(0);
    });
  }

  function assertAllAddressesServedSimilarAmountOfReadQueries(addresses, readQueriesByServer) {
    const expectedOrderOfMagnitude = orderOfMagnitude(readQueriesByServer[addresses[0]]);

    addresses.forEach(address => {
      const queries = readQueriesByServer[address];
      const currentOrderOfMagnitude = orderOfMagnitude(queries);

      expect(currentOrderOfMagnitude).not.toBeLessThan(expectedOrderOfMagnitude - 1);
      expect(currentOrderOfMagnitude).not.toBeGreaterThan(expectedOrderOfMagnitude + 1);
    });
  }

  function orderOfMagnitude(number) {
    let result = 1;
    while (number >= 10) {
      number /= 10;
      result++;
    }
    return result;
  }

  function randomParams() {
    return {
      name: `Person-${Date.now()}`,
      salary: Date.now()
    };
  }

  function noParams() {
    return {};
  }

  function newSession(context, accessMode, useBookmark) {
    if (useBookmark) {
      return context.driver.session(accessMode, context.bookmark);
    }
    return context.driver.session(accessMode);
  }

  function modeFromEnvOrDefault(envVariableName) {
    const modeName = fromEnvOrDefault(envVariableName, 'fast');
    const mode = TEST_MODES[modeName];
    if (!mode) {
      throw new Error(`Unknown test mode: ${modeName}`);
    }
    console.log(`Selected '${modeName}' mode for the stress test`);
    return mode;
  }

  function fromEnvOrDefault(envVariableName, defaultValue) {
    if (process && process.env && process.env[envVariableName]) {
      return process.env[envVariableName];
    }
    return defaultValue;
  }

  function cleanupDb(driver) {
    const session = driver.session();
    return session.run('MATCH (n) DETACH DELETE n').then(() => {
      session.close();
    }).catch(error => {
      console.log('Error clearing the database: ', error);
    });
  }

  function arraysEqual(array1, array2) {
    return _.difference(array1, array2).length === 0;
  }

  class Context {

    constructor(driver, loggingEnabled) {
      this.driver = driver;
      this.bookmark = null;
      this.createdNodesCount = 0;
      this._commandIdCouter = 0;
      this._loggingEnabled = loggingEnabled;
      this.readServersWithQueryCount = {};
      this.writeServersWithQueryCount = {};
      this.serverVersion = null;
    }

    queryCompleted(result, accessMode, bookmark) {
      const serverInfo = result.summary.server;

      if (!this.serverVersion) {
        this.serverVersion = ServerVersion.fromString(serverInfo.version);
      }

      const serverAddress = serverInfo.address;
      if (accessMode === WRITE) {
        this.createdNodesCount++;
        this.writeServersWithQueryCount[serverAddress] = (this.writeServersWithQueryCount[serverAddress] || 0) + 1;
      } else {
        this.readServersWithQueryCount[serverAddress] = (this.readServersWithQueryCount[serverAddress] || 0) + 1;
      }

      if (bookmark) {
        this.bookmark = bookmark;
      }
    }

    nextCommandId() {
      return this._commandIdCouter++;
    }

    readServerAddresses() {
      return Object.keys(this.readServersWithQueryCount);
    }

    writeServerAddresses() {
      return Object.keys(this.writeServersWithQueryCount);
    }

    log(commandId, message) {
      if (this._loggingEnabled) {
        console.log(`Command [${commandId}]: ${message}`);
      }
    }
  }

  class ClusterAddresses {

    constructor(followers, readReplicas) {
      this.followers = followers;
      this.readReplicas = readReplicas;
    }
  }

});
