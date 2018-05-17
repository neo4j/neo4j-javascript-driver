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
import LeastConnectedLoadBalancingStrategy from '../../src/v1/internal/least-connected-load-balancing-strategy';
import RoutingDriver from '../../src/v1/routing-driver';
import Pool from '../../src/v1/internal/pool';

describe('RoutingDriver', () => {

  it('should create least connected when nothing configured', () => {
    const strategy = createStrategy({});
    expect(strategy instanceof LeastConnectedLoadBalancingStrategy).toBeTruthy();
  });

  it('should create least connected when it is configured', () => {
    const strategy = createStrategy({loadBalancingStrategy: 'least_connected'});
    expect(strategy instanceof LeastConnectedLoadBalancingStrategy).toBeTruthy();
  });

  it('should create round robin when it is configured', () => {
    const strategy = createStrategy({loadBalancingStrategy: 'round_robin'});
    expect(strategy instanceof RoundRobinLoadBalancingStrategy).toBeTruthy();
  });

  it('should fail when unknown strategy is configured', () => {
    expect(() => createStrategy({loadBalancingStrategy: 'wrong'})).toThrow();
  });

});

function createStrategy(config) {
  return RoutingDriver._createLoadBalancingStrategy(config, new Pool());
}
