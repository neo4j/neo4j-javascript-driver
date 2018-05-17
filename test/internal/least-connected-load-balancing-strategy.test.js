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

import LeastConnectedLoadBalancingStrategy from '../../src/v1/internal/least-connected-load-balancing-strategy';
import Pool from '../../src/v1/internal/pool';

describe('LeastConnectedLoadBalancingStrategy', () => {

  it('should return null when no readers', () => {
    const knownReaders = [];
    const strategy = new LeastConnectedLoadBalancingStrategy(new DummyPool({}));

    expect(strategy.selectReader(knownReaders)).toBeNull();
  });

  it('should return null when no writers', () => {
    const knownWriters = [];
    const strategy = new LeastConnectedLoadBalancingStrategy(new DummyPool({}));

    expect(strategy.selectWriter(knownWriters)).toBeNull();
  });

  it('should return same reader when it is the only one available and has no connections', () => {
    const knownReaders = ['reader-1'];
    const strategy = new LeastConnectedLoadBalancingStrategy(new DummyPool({'reader-1': 0}));

    expect(strategy.selectReader(knownReaders)).toEqual('reader-1');
    expect(strategy.selectReader(knownReaders)).toEqual('reader-1');
    expect(strategy.selectReader(knownReaders)).toEqual('reader-1');
  });

  it('should return same writer when it is the only one available and has no connections', () => {
    const knownWriters = ['writer-1'];
    const strategy = new LeastConnectedLoadBalancingStrategy(new DummyPool({'writer-1': 0}));

    expect(strategy.selectWriter(knownWriters)).toEqual('writer-1');
    expect(strategy.selectWriter(knownWriters)).toEqual('writer-1');
    expect(strategy.selectWriter(knownWriters)).toEqual('writer-1');
  });

  it('should return same reader when it is the only one available and has active connections', () => {
    const knownReaders = ['reader-1'];
    const strategy = new LeastConnectedLoadBalancingStrategy(new DummyPool({'reader-1': 14}));

    expect(strategy.selectReader(knownReaders)).toEqual('reader-1');
    expect(strategy.selectReader(knownReaders)).toEqual('reader-1');
    expect(strategy.selectReader(knownReaders)).toEqual('reader-1');
  });

  it('should return same writer when it is the only one available and has active connections', () => {
    const knownWriters = ['writer-1'];
    const strategy = new LeastConnectedLoadBalancingStrategy(new DummyPool({'writer-1': 3}));

    expect(strategy.selectWriter(knownWriters)).toEqual('writer-1');
    expect(strategy.selectWriter(knownWriters)).toEqual('writer-1');
    expect(strategy.selectWriter(knownWriters)).toEqual('writer-1');
  });

  it('should return readers in round robin order when no active connections', () => {
    const knownReaders = ['reader-1', 'reader-2', 'reader-3'];
    const pool = new DummyPool({'reader-1': 0, 'reader-2': 0, 'reader-3': 0});
    const strategy = new LeastConnectedLoadBalancingStrategy(pool);

    expect(strategy.selectReader(knownReaders)).toEqual('reader-1');
    expect(strategy.selectReader(knownReaders)).toEqual('reader-2');
    expect(strategy.selectReader(knownReaders)).toEqual('reader-3');
    expect(strategy.selectReader(knownReaders)).toEqual('reader-1');
    expect(strategy.selectReader(knownReaders)).toEqual('reader-2');
    expect(strategy.selectReader(knownReaders)).toEqual('reader-3');
  });

  it('should return writers in round robin order when no active connections', () => {
    const knownWriters = ['writer-1', 'writer-2', 'writer-3', 'writer-4'];
    const pool = new DummyPool({'writer-1': 0, 'writer-2': 0, 'writer-3': 0, 'writer-4': 0});
    const strategy = new LeastConnectedLoadBalancingStrategy(pool);

    expect(strategy.selectWriter(knownWriters)).toEqual('writer-1');
    expect(strategy.selectWriter(knownWriters)).toEqual('writer-2');
    expect(strategy.selectWriter(knownWriters)).toEqual('writer-3');
    expect(strategy.selectWriter(knownWriters)).toEqual('writer-4');
    expect(strategy.selectWriter(knownWriters)).toEqual('writer-1');
    expect(strategy.selectWriter(knownWriters)).toEqual('writer-2');
    expect(strategy.selectWriter(knownWriters)).toEqual('writer-3');
    expect(strategy.selectWriter(knownWriters)).toEqual('writer-4');
  });

  it('should return least connected reader', () => {
    const knownReaders = ['reader-1', 'reader-2', 'reader-3'];
    const pool = new DummyPool({'reader-1': 7, 'reader-2': 3, 'reader-3': 8});
    const strategy = new LeastConnectedLoadBalancingStrategy(pool);

    expect(strategy.selectReader(knownReaders)).toEqual('reader-2');
    expect(strategy.selectReader(knownReaders)).toEqual('reader-2');
    expect(strategy.selectReader(knownReaders)).toEqual('reader-2');
  });

  it('should return least connected writer', () => {
    const knownWriters = ['writer-1', 'writer-2', 'writer-3', 'writer-4'];
    const pool = new DummyPool({'writer-1': 5, 'writer-2': 4, 'writer-3': 6, 'writer-4': 2});
    const strategy = new LeastConnectedLoadBalancingStrategy(pool);

    expect(strategy.selectWriter(knownWriters)).toEqual('writer-4');
    expect(strategy.selectWriter(knownWriters)).toEqual('writer-4');
    expect(strategy.selectWriter(knownWriters)).toEqual('writer-4');
  });

});

class DummyPool extends Pool {

  constructor(activeConnections) {
    super(() => 42);
    this._activeConnections = activeConnections;
  }

  activeResourceCount(key) {
    return this._activeConnections[key];
  }
}
