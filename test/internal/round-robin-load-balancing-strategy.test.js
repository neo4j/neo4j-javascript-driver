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
import RoundRobinLoadBalancingStrategy from '../../src/v1/internal/round-robin-load-balancing-strategy';

describe('RoundRobinLoadBalancingStrategy', () => {

  it('should return null when no readers', () => {
    const knownReaders = [];
    const strategy = new RoundRobinLoadBalancingStrategy();

    expect(strategy.selectReader(knownReaders)).toBeNull();
  });

  it('should return null when no writers', () => {
    const knownWriters = [];
    const strategy = new RoundRobinLoadBalancingStrategy();

    expect(strategy.selectWriter(knownWriters)).toBeNull();
  });

  it('should return same reader when it is the only one available', () => {
    const knownReaders = ['reader-1'];
    const strategy = new RoundRobinLoadBalancingStrategy();

    expect(strategy.selectReader(knownReaders)).toEqual('reader-1');
    expect(strategy.selectReader(knownReaders)).toEqual('reader-1');
    expect(strategy.selectReader(knownReaders)).toEqual('reader-1');
  });

  it('should return same writer when it is the only one available', () => {
    const knownWriters = ['writer-1'];
    const strategy = new RoundRobinLoadBalancingStrategy();

    expect(strategy.selectWriter(knownWriters)).toEqual('writer-1');
    expect(strategy.selectWriter(knownWriters)).toEqual('writer-1');
    expect(strategy.selectWriter(knownWriters)).toEqual('writer-1');
  });

  it('should return readers in round robin order', () => {
    const knownReaders = ['reader-1', 'reader-2', 'reader-3'];
    const strategy = new RoundRobinLoadBalancingStrategy();

    expect(strategy.selectReader(knownReaders)).toEqual('reader-1');
    expect(strategy.selectReader(knownReaders)).toEqual('reader-2');
    expect(strategy.selectReader(knownReaders)).toEqual('reader-3');
    expect(strategy.selectReader(knownReaders)).toEqual('reader-1');
    expect(strategy.selectReader(knownReaders)).toEqual('reader-2');
    expect(strategy.selectReader(knownReaders)).toEqual('reader-3');
  });

  it('should return writers in round robin order', () => {
    const knownWriters = ['writer-1', 'writer-2', 'writer-3', 'writer-4'];
    const strategy = new RoundRobinLoadBalancingStrategy();

    expect(strategy.selectWriter(knownWriters)).toEqual('writer-1');
    expect(strategy.selectWriter(knownWriters)).toEqual('writer-2');
    expect(strategy.selectWriter(knownWriters)).toEqual('writer-3');
    expect(strategy.selectWriter(knownWriters)).toEqual('writer-4');
    expect(strategy.selectWriter(knownWriters)).toEqual('writer-1');
    expect(strategy.selectWriter(knownWriters)).toEqual('writer-2');
    expect(strategy.selectWriter(knownWriters)).toEqual('writer-3');
    expect(strategy.selectWriter(knownWriters)).toEqual('writer-4');
  });

});
