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

import * as DummyChannel from '../../src/v1/internal/ch-dummy';
import {connect, Connection} from '../../src/v1/internal/connector';
import {Packer} from '../../src/v1/internal/packstream-v1';
import {Chunker} from '../../src/v1/internal/chunking';
import {alloc} from '../../src/v1/internal/buf';
import {Neo4jError, newError} from '../../src/v1/error';
import sharedNeo4j from '../internal/shared-neo4j';
import {ServerVersion} from '../../src/v1/internal/server-version';
import lolex from 'lolex';

const ILLEGAL_MESSAGE = {signature: 42, fields: []};
const SUCCESS_MESSAGE = {signature: 0x70, fields: [{}]};
const FAILURE_MESSAGE = {signature: 0x7F, fields: [newError('Hello')]};
const RECORD_MESSAGE = {signature: 0x71, fields: [{value: 'Hello'}]};

describe('connector', () => {

  let clock;
  let connection;

  afterEach(done => {
    if (clock) {
      clock.uninstall();
      clock = null;
    }

    const usedConnection = connection;
    connection = null;
    if (usedConnection) {
      usedConnection.close();
    }
    done();
  });

  it('should have correct creation timestamp', () => {
    clock = lolex.install();
    clock.setSystemTime(424242);

    connection = connect('bolt://localhost');

    expect(connection.creationTimestamp).toEqual(424242);
  });

  it('should read/write basic messages', done => {
    // Given
    connection = connect("bolt://localhost");

    // When
    connection.initialize("mydriver/0.0.0", basicAuthToken(), {
      onCompleted: msg => {
        expect(msg).not.toBeNull();
        done();
      },
      onError: console.log
    });
    connection.sync();

  });

  it('should retrieve stream', done => {
    // Given
    connection = connect("bolt://localhost");

    // When
    const records = [];
    connection.initialize("mydriver/0.0.0", basicAuthToken());
    connection.run("RETURN 1.0", {});
    connection.pullAll({
      onNext: record => {
        records.push(record);
      },
      onCompleted: () => {
        expect(records[0][0]).toBe(1);
        done();
      }
    });
    connection.sync();
  });

  it('should use DummyChannel to read what gets written', done => {
    // Given
    const observer = DummyChannel.observer;
    connection = connect('bolt://localhost', {channel: DummyChannel.channel});

    const boltMagicPreamble = '60 60 b0 17';
    const protocolVersion2 = '00 00 00 02';
    const protocolVersion1 = '00 00 00 01';
    const noProtocolVersion = '00 00 00 00';
    expect(observer.instance.toHex()).toBe(`${boltMagicPreamble} ${protocolVersion2} ${protocolVersion1} ${noProtocolVersion} ${noProtocolVersion} `);

    observer.instance.clear();

    // When
    connection.initialize('mydriver/0.0.0', basicAuthToken());
    connection.run('RETURN 1', {});
    connection.sync();
    expect(observer.instance.toHex()).toBe('00 44 b2 01 8e 6d 79 64 72 69 76 65 72 2f 30 2e 30 2e 30 a3 86 73 63 68 65 6d 65 85 62 61 73 69 63 89 70 72 69 6e 63 69 70 61 6c 85 6e 65 6f 34 6a 8b 63 72 65 64 65 6e 74 69 61 6c 73 88 70 61 73 73 77 6f 72 64 00 00 00 0c b2 10 88 52 45 54 55 52 4e 20 31 a0 00 00 ');
    done();
  });

  it('should provide error message when connecting to http-port', done => {
    // Given
    connection = connect("bolt://localhost:7474", {encrypted: false});

    // When
    connection.initialize("mydriver/0.0.0", basicAuthToken(), {
      onCompleted: msg => {
      },
      onError: err => {
        //only node gets the pretty error message
        if (require('../../lib/v1/internal/ch-node.js').available) {
          expect(err.message).toBe("Server responded HTTP. Make sure you are not trying to connect to the http endpoint " +
            "(HTTP defaults to port 7474 whereas BOLT defaults to port 7687)");
        }
        done();
      }
    });
    connection.sync();

  });

  it('should convert failure messages to errors', done => {
    const channel = new DummyChannel.channel;
    connection = new Connection(channel, 'bolt://localhost');

    const errorCode = 'Neo.ClientError.Schema.ConstraintValidationFailed';
    const errorMessage = 'Node 0 already exists with label User and property "email"=[john@doe.com]';

    connection._queueObserver({
      onError: error => {
        expectNeo4jError(error, errorCode, errorMessage);
        done();
      }
    });

    channel.onmessage(packedHandshakeMessage());
    channel.onmessage(packedFailureMessage(errorCode, errorMessage));
  });

  it('should notify when connection initialization completes', done => {
    connection = connect('bolt://localhost');

    connection.initializationCompleted().then(initializedConnection => {
      expect(initializedConnection).toBe(connection);
      done();
    });

    connection.initialize('mydriver/0.0.0', basicAuthToken());
  });

  it('should notify when connection initialization fails', done => {
    connection = connect('bolt://localhost:7474'); // wrong port

    connection.initializationCompleted().catch(error => {
      expect(error).toBeDefined();
      done();
    });

    connection.initialize('mydriver/0.0.0', basicAuthToken());
  });

  it('should notify provided observer when connection initialization completes', done => {
    connection = connect('bolt://localhost');

    connection.initialize('mydriver/0.0.0', basicAuthToken(), {
      onCompleted: metaData => {
        expect(connection.isOpen()).toBeTruthy();
        expect(metaData).toBeDefined();
        done();
      },
    });
  });

  it('should notify provided observer when connection initialization fails', done => {
    connection = connect('bolt://localhost:7474'); // wrong port

    connection.initialize('mydriver/0.0.0', basicAuthToken(), {
      onError: error => {
        expect(connection.isOpen()).toBeFalsy();
        expect(error).toBeDefined();
        done();
      },
    });
  });

  it('should have server version after connection initialization completed', done => {
    connection = connect('bolt://localhost');

    connection.initializationCompleted().then(initializedConnection => {
      const serverVersion = ServerVersion.fromString(initializedConnection.server.version);
      expect(serverVersion).toBeDefined();
      done();
    });

    connection.initialize('mydriver/0.0.0', basicAuthToken());
  });

  it('should fail all new observers after initialization error', done => {
    connection = connect('bolt://localhost:7474'); // wrong port

    connection.initialize('mydriver/0.0.0', basicAuthToken(), {
      onError: initialError => {
        expect(initialError).toBeDefined();

        connection.run('RETURN 1', {}, {
          onError: error1 => {
            expect(error1).toEqual(initialError);

            connection.initialize('mydriver/0.0.0', basicAuthToken(), {
              onError: error2 => {
                expect(error2).toEqual(initialError);

                done();
              }
            });
          }
        });
      },
    });
  });

  it('should respect connection timeout', done => {
    testConnectionTimeout(false, done);
  });

  it('should respect encrypted connection timeout', done => {
    testConnectionTimeout(true, done);
  });

  it('should not queue INIT observer when broken', () => {
    testQueueingOfObserversWithBrokenConnection(connection => connection.initialize('Hello', {}, {}));
  });

  it('should not queue RUN observer when broken', () => {
    testQueueingOfObserversWithBrokenConnection(connection => connection.run('RETURN 1', {}, {}));
  });

  it('should not queue PULL_ALL observer when broken', () => {
    testQueueingOfObserversWithBrokenConnection(connection => connection.pullAll({}));
  });

  it('should not queue DISCARD_ALL observer when broken', () => {
    testQueueingOfObserversWithBrokenConnection(connection => connection.discardAll({}));
  });

  it('should not queue RESET observer when broken', () => {
    const resetAction = connection => connection.resetAndFlush().catch(ignore => {
    });

    testQueueingOfObserversWithBrokenConnection(resetAction);
  });

  it('should not queue ACK_FAILURE observer when broken', () => {
    testQueueingOfObserversWithBrokenConnection(connection => connection._ackFailureIfNeeded());
  });

  it('should reset and flush when SUCCESS received', done => {
    connection = connect('bolt://localhost');

    connection.resetAndFlush().then(() => {
      expect(connection.isOpen()).toBeTruthy();
      done();
    }).catch(error => done.fail(error));

    connection._handleMessage(SUCCESS_MESSAGE);
  });

  it('should fail to reset and flush when FAILURE received', done => {
    connection = connect('bolt://localhost');

    connection.resetAndFlush()
      .then(() => done.fail('Should fail'))
      .catch(error => {
        expect(error.message).toEqual('Received FAILURE as a response for RESET: Neo4jError: Hello');
        expect(connection._isBroken).toBeTruthy();
        expect(connection.isOpen()).toBeFalsy();
        done();
      });

    connection._handleMessage(FAILURE_MESSAGE);
  });

  it('should fail to reset and flush when RECORD received', done => {
    connection = connect('bolt://localhost');

    connection.resetAndFlush()
      .then(() => done.fail('Should fail'))
      .catch(error => {
        expect(error.message).toEqual('Received RECORD as a response for RESET: {"value":"Hello"}');
        expect(connection._isBroken).toBeTruthy();
        expect(connection.isOpen()).toBeFalsy();
        done();
      });

    connection._handleMessage(RECORD_MESSAGE);
  });

  it('should ACK_FAILURE when SUCCESS received', () => {
    connection = connect('bolt://localhost');

    connection._currentFailure = newError('Hello');
    connection._ackFailureIfNeeded();

    connection._handleMessage(SUCCESS_MESSAGE);
    expect(connection._currentFailure).toBeNull();
  });

  it('should fail the connection when ACK_FAILURE receives FAILURE', () => {
    connection = connect('bolt://localhost');

    connection._ackFailureIfNeeded();

    connection._handleMessage(FAILURE_MESSAGE);
    expect(connection._isBroken).toBeTruthy();
    expect(connection.isOpen()).toBeFalsy();
  });

  it('should fail the connection when ACK_FAILURE receives RECORD', () => {
    connection = connect('bolt://localhost');

    connection._ackFailureIfNeeded();

    connection._handleMessage(RECORD_MESSAGE);
    expect(connection._isBroken).toBeTruthy();
    expect(connection.isOpen()).toBeFalsy();
  });

  function packedHandshakeMessage() {
    const result = alloc(4);
    result.putInt32(0, 1);
    result.reset();
    return result;
  }

  function packedFailureMessage(code, message) {
    const channel = new DummyChannel.channel;
    const chunker = new Chunker(channel);
    const packer = new Packer(chunker);
    packer.packStruct(0x7F, [packer.packable({code: code, message: message})]);
    chunker.messageBoundary();
    chunker.flush();
    const data = channel.toBuffer();
    const result = alloc(data.length);
    result.putBytes(0, data);
    return result;
  }

  function expectNeo4jError(error, expectedCode, expectedMessage) {
    expect(() => {
      throw error;
    }).toThrow(new Neo4jError(expectedMessage, expectedCode));
    expect(error.name).toBe("Neo4jError");
  }

  function basicAuthToken() {
    return {
      scheme: 'basic',
      principal: sharedNeo4j.username,
      credentials: sharedNeo4j.password
    };
  }

  function testConnectionTimeout(encrypted, done) {
    const boltUri = 'bolt://10.0.0.0'; // use non-routable IP address which never responds
    connection = connect(boltUri, {encrypted: encrypted, connectionTimeout: 1000}, 'TestErrorCode');

    connection.initialize('mydriver/0.0.0', basicAuthToken(), {
      onNext: record => {
        done.fail('Should not receive records: ' + record);
      },
      onCompleted: () => {
        done.fail('Should not be able to INIT');
      },
      onError: error => {
        expect(error.code).toEqual('TestErrorCode');

        // in some environments non-routable address results in immediate 'connection refused' error and connect
        // timeout is not fired; skip message assertion for such cases, it is important for connect attempt to not hang
        if (error.message.indexOf('Failed to establish connection') === 0) {
          expect(error.message).toEqual('Failed to establish connection in 1000ms');
        }

        done();
      }
    });
  }

  function testQueueingOfObserversWithBrokenConnection(connectionAction) {
    connection = connect('bolt://localhost');

    connection._handleMessage(ILLEGAL_MESSAGE);
    expect(connection.isOpen()).toBeFalsy();

    expect(connection._pendingObservers.length).toEqual(0);
    connectionAction(connection);
    expect(connection._pendingObservers.length).toEqual(0);
  }

});
