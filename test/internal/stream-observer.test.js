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

import StreamObserver from '../../src/v1/internal/stream-observer';
import FakeConnection from './fake-connection';

const NO_OP = () => {
};

describe('StreamObserver', () => {

  it('remembers resolved connection', () => {
    const streamObserver = newStreamObserver();
    const connection = new FakeConnection();

    streamObserver.resolveConnection(connection);

    expect(streamObserver._conn).toBe(connection);
  });

  it('remembers subscriber', () => {
    const streamObserver = newStreamObserver();
    const subscriber = newObserver();

    streamObserver.subscribe(subscriber);

    expect(streamObserver._observer).toBe(subscriber);
  });

  it('passes received records to the subscriber', () => {
    const streamObserver = newStreamObserver();
    const receivedRecords = [];
    const observer = newObserver(record => {
      receivedRecords.push(record);
    });

    streamObserver.subscribe(observer);
    streamObserver.onCompleted({fields: ['A', 'B', 'C']});

    streamObserver.onNext([1, 2, 3]);
    streamObserver.onNext([11, 22, 33]);
    streamObserver.onNext([111, 222, 333]);

    expect(receivedRecords.length).toEqual(3);
    expect(receivedRecords[0].toObject()).toEqual({'A': 1, 'B': 2, 'C': 3});
    expect(receivedRecords[1].toObject()).toEqual({'A': 11, 'B': 22, 'C': 33});
    expect(receivedRecords[2].toObject()).toEqual({'A': 111, 'B': 222, 'C': 333});
  });

  it('queues received record when no subscriber', () => {
    const streamObserver = newStreamObserver();

    streamObserver.onCompleted({fields: ['A', 'B', 'C']});

    streamObserver.onNext([1111, 2222, 3333]);
    streamObserver.onNext([111, 222, 333]);
    streamObserver.onNext([11, 22, 33]);
    streamObserver.onNext([1, 2, 3]);

    const queuedRecords = streamObserver._queuedRecords;

    expect(queuedRecords.length).toEqual(4);
    expect(queuedRecords[0].toObject()).toEqual({'A': 1111, 'B': 2222, 'C': 3333});
    expect(queuedRecords[1].toObject()).toEqual({'A': 111, 'B': 222, 'C': 333});
    expect(queuedRecords[2].toObject()).toEqual({'A': 11, 'B': 22, 'C': 33});
    expect(queuedRecords[3].toObject()).toEqual({'A': 1, 'B': 2, 'C': 3});
  });

  it('passes received error the subscriber', () => {
    const streamObserver = newStreamObserver();
    const error = new Error('Invalid Cypher statement');

    let receivedError = null;
    const observer = newObserver(NO_OP, error => {
      receivedError = error;
    });

    streamObserver.subscribe(observer);
    streamObserver.onError(error);

    expect(receivedError).toBe(error);
  });

  it('passes existing error to a new subscriber', () => {
    const streamObserver = newStreamObserver();
    const error = new Error('Invalid Cypher statement');

    streamObserver.onError(error);

    streamObserver.subscribe(newObserver(NO_OP, receivedError => {
      expect(receivedError).toBe(error);
    }));
  });

  it('passes queued records to a new subscriber', () => {
    const streamObserver = newStreamObserver();

    streamObserver.onCompleted({fields: ['A', 'B', 'C']});

    streamObserver.onNext([1, 2, 3]);
    streamObserver.onNext([11, 22, 33]);
    streamObserver.onNext([111, 222, 333]);

    const receivedRecords = [];
    streamObserver.subscribe(newObserver(record => {
      receivedRecords.push(record);
    }));

    expect(receivedRecords.length).toEqual(3);
    expect(receivedRecords[0].toObject()).toEqual({'A': 1, 'B': 2, 'C': 3});
    expect(receivedRecords[1].toObject()).toEqual({'A': 11, 'B': 22, 'C': 33});
    expect(receivedRecords[2].toObject()).toEqual({'A': 111, 'B': 222, 'C': 333});
  });

  it('passes existing metadata to a new subscriber', () => {
    const streamObserver = newStreamObserver();

    streamObserver.onCompleted({fields: ['Foo', 'Bar', 'Baz', 'Qux']});
    streamObserver.onCompleted({metaDataField1: 'value1', metaDataField2: 'value2'});

    let receivedMetaData = null;
    streamObserver.subscribe(newObserver(NO_OP, NO_OP, metaData => {
      receivedMetaData = metaData;
    }));

    expect(receivedMetaData).toEqual({metaDataField1: 'value1', metaDataField2: 'value2'});
  });

});

function newStreamObserver() {
  return new StreamObserver();
}

function newObserver(onNext = NO_OP, onError = NO_OP, onCompleted = NO_OP) {
  return {
    onNext: onNext,
    onError: onError,
    onCompleted: onCompleted
  };
}
