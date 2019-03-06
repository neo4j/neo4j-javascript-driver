/**
 * Copyright (c) 2002-2019 "Neo4j,"
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

import BoltProtocolV1 from '../../src/v1/internal/bolt-protocol-v1';
import RequestMessage from '../../src/v1/internal/request-message';
import Bookmark from '../../src/v1/internal/bookmark';
import TxConfig from '../../src/v1/internal/tx-config';
import {WRITE} from "../../src/v1/driver";

class MessageRecorder {

  constructor() {
    this.messages = [];
    this.observers = [];
    this.flushes = [];
  }

  write(message, observer, flush) {
    this.messages.push(message);
    this.observers.push(observer);
    this.flushes.push(flush);
  }

  verifyMessageCount(expected) {
    expect(this.messages.length).toEqual(expected);
    expect(this.observers.length).toEqual(expected);
    expect(this.flushes.length).toEqual(expected);
  }
}

describe('BoltProtocolV1', () => {

  it('should not change metadata', () => {
    const metadata = {result_available_after: 1, result_consumed_after: 2, t_first: 3, t_last: 4};
    const protocol = new BoltProtocolV1(new MessageRecorder(), null, false);

    const transformedMetadata = protocol.transformMetadata(metadata);

    expect(transformedMetadata).toEqual({result_available_after: 1, result_consumed_after: 2, t_first: 3, t_last: 4});
  });

  it('should initialize the connection', () => {
    const recorder = new MessageRecorder();
    const protocol = new BoltProtocolV1(recorder, null, false);

    const clientName = 'js-driver/1.2.3';
    const authToken = {username: 'neo4j', password: 'secret'};
    const observer = {};

    protocol.initialize(clientName, authToken, observer);

    recorder.verifyMessageCount(1);
    verifyMessage(RequestMessage.init(clientName, authToken), recorder.messages[0]);
    expect(recorder.observers).toEqual([observer]);
    expect(recorder.flushes).toEqual([true]);
  });

  it('should run a statement', () => {
    const recorder = new MessageRecorder();
    const protocol = new BoltProtocolV1(recorder, null, false);

    const statement = 'RETURN $x, $y';
    const parameters = {x: 'x', y: 'y'};
    const observer = {};

    protocol.run(statement, parameters, Bookmark.empty(), TxConfig.empty(), WRITE, observer);

    recorder.verifyMessageCount(2);

    verifyMessage(RequestMessage.run(statement, parameters), recorder.messages[0]);
    verifyMessage(RequestMessage.pullAll(), recorder.messages[1]);

    expect(recorder.observers).toEqual([observer, observer]);
    expect(recorder.flushes).toEqual([false, true]);
  });

  it('should reset the connection', () => {
    const recorder = new MessageRecorder();
    const protocol = new BoltProtocolV1(recorder, null, false);

    const observer = {};

    protocol.reset(observer);

    recorder.verifyMessageCount(1);
    verifyMessage(RequestMessage.reset(), recorder.messages[0]);
    expect(recorder.observers).toEqual([observer]);
    expect(recorder.flushes).toEqual([true]);
  });

  it('should begin a transaction', () => {
    const recorder = new MessageRecorder();
    const protocol = new BoltProtocolV1(recorder, null, false);

    const bookmark = new Bookmark('neo4j:bookmark:v1:tx42');
    const observer = {};

    protocol.beginTransaction(bookmark, TxConfig.empty(), WRITE, observer);

    recorder.verifyMessageCount(2);

    verifyMessage(RequestMessage.run('BEGIN', bookmark.asBeginTransactionParameters()), recorder.messages[0]);
    verifyMessage(RequestMessage.pullAll(), recorder.messages[1]);

    expect(recorder.observers).toEqual([observer, observer]);
    expect(recorder.flushes).toEqual([false, false]);
  });

  it('should commit a transaction', () => {
    const recorder = new MessageRecorder();
    const protocol = new BoltProtocolV1(recorder, null, false);

    const observer = {};

    protocol.commitTransaction(observer);

    recorder.verifyMessageCount(2);

    verifyMessage(RequestMessage.run('COMMIT', {}), recorder.messages[0]);
    verifyMessage(RequestMessage.pullAll(), recorder.messages[1]);

    expect(recorder.observers).toEqual([observer, observer]);
    expect(recorder.flushes).toEqual([false, true]);
  });

  it('should rollback a transaction', () => {
    const recorder = new MessageRecorder();
    const protocol = new BoltProtocolV1(recorder, null, false);

    const observer = {};

    protocol.rollbackTransaction(observer);

    recorder.verifyMessageCount(2);

    verifyMessage(RequestMessage.run('ROLLBACK', {}), recorder.messages[0]);
    verifyMessage(RequestMessage.pullAll(), recorder.messages[1]);

    expect(recorder.observers).toEqual([observer, observer]);
    expect(recorder.flushes).toEqual([false, true]);
  });

});

function verifyMessage(expected, actual) {
  expect(actual.signature).toEqual(expected.signature);
  expect(actual.fields).toEqual(expected.fields);
}
