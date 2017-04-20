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

import * as DummyChannel from '../../src/v1/internal/ch-dummy';
import {connect, Connection} from '../../src/v1/internal/connector';
import {Packer} from '../../src/v1/internal/packstream';
import {Chunker} from '../../src/v1/internal/chunking';
import {alloc} from '../../src/v1/internal/buf';
import {Neo4jError} from '../../src/v1/error';
import sharedNeo4j from '../internal/shared-neo4j';

describe('connector', () => {

  it('should read/write basic messages', done => {
    // Given
    const conn = connect("bolt://localhost");

    // When
    conn.initialize("mydriver/0.0.0", basicAuthToken(), {
      onCompleted: msg => {
        expect(msg).not.toBeNull();
        conn.close();
        done();
      },
      onError: console.log
    });
    conn.sync();

  });

  it('should retrieve stream', done => {
    // Given
    const conn = connect("bolt://localhost");

    // When
    const records = [];
    conn.initialize("mydriver/0.0.0", basicAuthToken());
    conn.run("RETURN 1.0", {});
    conn.pullAll({
      onNext: record => {
        records.push(record);
      },
      onCompleted: () => {
        expect(records[0][0]).toBe(1);
        conn.close();
        done();
      }
    });
    conn.sync();
  });

  it('should use DummyChannel to read what gets written', done => {
    // Given
    const observer = DummyChannel.observer;
    const conn = connect("bolt://localhost", {channel: DummyChannel.channel});

    // When
    conn.initialize("mydriver/0.0.0", basicAuthToken());
    conn.run("RETURN 1", {});
    conn.sync();
    expect(observer.instance.toHex()).toBe('60 60 b0 17 00 00 00 01 00 00 00 00 00 00 00 00 00 00 00 00 00 44 b2 01 8e 6d 79 64 72 69 76 65 72 2f 30 2e 30 2e 30 a3 86 73 63 68 65 6d 65 85 62 61 73 69 63 89 70 72 69 6e 63 69 70 61 6c 85 6e 65 6f 34 6a 8b 63 72 65 64 65 6e 74 69 61 6c 73 88 70 61 73 73 77 6f 72 64 00 00 00 0c b2 10 88 52 45 54 55 52 4e 20 31 a0 00 00 ');
    done();
  });

  it('should provide error message when connecting to http-port', done => {
    // Given
    const conn = connect("bolt://localhost:7474", {encrypted: false});

    // When
    conn.initialize("mydriver/0.0.0", basicAuthToken(), {
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
    conn.sync();

  });

  it('should convert failure messages to errors', done => {
    const channel = new DummyChannel.channel;
    const connection = new Connection(channel, 'bolt://localhost');

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
  }

  function basicAuthToken() {
    return {
      scheme: 'basic',
      principal: sharedNeo4j.username,
      credentials: sharedNeo4j.password
    };
  }

});
