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

import ConnectionHolder, {EMPTY_CONNECTION_HOLDER} from '../../src/v1/internal/connection-holder';
import {SingleConnectionProvider} from '../../src/v1/internal/connection-providers';
import {READ} from '../../src/v1/driver';
import FakeConnection from './fake-connection';

describe('EmptyConnectionHolder', () => {

  it('should return rejected promise instead of connection', done => {
    EMPTY_CONNECTION_HOLDER.getConnection().catch(() => {
      done();
    });
  });

  it('should return resolved promise on release', done => {
    EMPTY_CONNECTION_HOLDER.releaseConnection().then(() => {
      done();
    });
  });

  it('should return resolved promise on close', done => {
    EMPTY_CONNECTION_HOLDER.close().then(() => {
      done();
    });
  });

});

describe('ConnectionHolder', () => {

  it('should acquire new connection during initialization', () => {
    const connectionProvider = new RecordingConnectionProvider([new FakeConnection()]);
    const connectionHolder = new ConnectionHolder(READ, connectionProvider);

    connectionHolder.initializeConnection();

    expect(connectionProvider.acquireConnectionInvoked).toBe(1);
  });

  it('should return acquired during initialization connection', done => {
    const connection = new FakeConnection();
    const connectionProvider = newSingleConnectionProvider(connection);
    const connectionHolder = new ConnectionHolder(READ, connectionProvider);

    connectionHolder.initializeConnection();

    connectionHolder.getConnection().then(connection => {
      expect(connection).toBe(connection);
      done();
    });
  });

  it('should release connection with single user', done => {
    const connection = new FakeConnection();
    const connectionProvider = newSingleConnectionProvider(connection);
    const connectionHolder = new ConnectionHolder(READ, connectionProvider);

    connectionHolder.initializeConnection();

    connectionHolder.releaseConnection().then(() => {
      expect(connection.isReleasedOnce()).toBeTruthy();
      done();
    });
  });

  it('should not release connection with multiple users', done => {
    const connection = new FakeConnection();
    const connectionProvider = newSingleConnectionProvider(connection);
    const connectionHolder = new ConnectionHolder(READ, connectionProvider);

    connectionHolder.initializeConnection();
    connectionHolder.initializeConnection();
    connectionHolder.initializeConnection();

    connectionHolder.releaseConnection().then(() => {
      expect(connection.isNeverReleased()).toBeTruthy();
      done();
    });
  });

  it('should release connection with multiple users when all users release', done => {
    const connection = new FakeConnection();
    const connectionProvider = newSingleConnectionProvider(connection);
    const connectionHolder = new ConnectionHolder(READ, connectionProvider);

    connectionHolder.initializeConnection();
    connectionHolder.initializeConnection();
    connectionHolder.initializeConnection();

    connectionHolder.releaseConnection().then(() => {
      connectionHolder.releaseConnection().then(() => {
        connectionHolder.releaseConnection().then(() => {
          expect(connection.isReleasedOnce()).toBeTruthy();
          done();
        });
      });
    });
  });

  it('should do nothing when closed and not initialized', done => {
    const connection = new FakeConnection();
    const connectionProvider = newSingleConnectionProvider(connection);
    const connectionHolder = new ConnectionHolder(READ, connectionProvider);

    connectionHolder.close().then(() => {
      expect(connection.isNeverReleased()).toBeTruthy();
      done();
    });
  });

  it('should close even when users exist', done => {
    const connection = new FakeConnection();
    const connectionProvider = newSingleConnectionProvider(connection);
    const connectionHolder = new ConnectionHolder(READ, connectionProvider);

    connectionHolder.initializeConnection();
    connectionHolder.initializeConnection();

    connectionHolder.close().then(() => {
      expect(connection.isReleasedOnceOnSessionClose()).toBeTruthy();
      done();
    });
  });

  it('should initialize new connection after releasing current one', done => {
    const connection1 = new FakeConnection();
    const connection2 = new FakeConnection();
    const connectionProvider = new RecordingConnectionProvider([connection1, connection2]);
    const connectionHolder = new ConnectionHolder(READ, connectionProvider);

    connectionHolder.initializeConnection();

    connectionHolder.releaseConnection().then(() => {
      expect(connection1.isReleasedOnce()).toBeTruthy();

      connectionHolder.initializeConnection();
      connectionHolder.releaseConnection().then(() => {
        expect(connection2.isReleasedOnce()).toBeTruthy();
        done();
      });
    });
  });

  it('should initialize new connection after being closed', done => {
    const connection1 = new FakeConnection();
    const connection2 = new FakeConnection();
    const connectionProvider = new RecordingConnectionProvider([connection1, connection2]);
    const connectionHolder = new ConnectionHolder(READ, connectionProvider);

    connectionHolder.initializeConnection();

    connectionHolder.close().then(() => {
      expect(connection1.isReleasedOnceOnSessionClose()).toBeTruthy();

      connectionHolder.initializeConnection();
      connectionHolder.close().then(() => {
        expect(connection2.isReleasedOnceOnSessionClose()).toBeTruthy();
        done();
      });
    });
  });
});

class RecordingConnectionProvider extends SingleConnectionProvider {

  constructor(connections) {
    super(Promise.resolve());
    this.connectionPromises = connections.map(conn => Promise.resolve(conn));
    this.acquireConnectionInvoked = 0;
  }

  acquireConnection(mode) {
    return this.connectionPromises[this.acquireConnectionInvoked++];
  }
}

function newSingleConnectionProvider(connection) {
  return new SingleConnectionProvider(Promise.resolve(connection));
}
