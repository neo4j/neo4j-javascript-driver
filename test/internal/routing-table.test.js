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
import RoutingTable from "../../src/v1/internal/routing-table";
import RoundRobinArray from "../../src/v1/internal/round-robin-array";
import {int} from "../../src/v1/integer";

describe('routing-table', () => {

  it('should not be stale when has routers, readers, writers and future expiration date', () => {
    const table = createTable([1, 2], [3, 4], [5, 6], notExpired());
    expect(table.isStale()).toBeFalsy();
  });

  it('should be stale when expiration date in the past', () => {
    const table = createTable([1, 2], [1, 2], [1, 2], expired());
    expect(table.isStale()).toBeTruthy();
  });

  it('should be stale when has single router', () => {
    const table = createTable([1], [2, 3], [4, 5], notExpired());
    expect(table.isStale()).toBeTruthy();
  });

  it('should be stale when no readers', () => {
    const table = createTable([1, 2], [], [3, 4], notExpired());
    expect(table.isStale()).toBeTruthy();
  });

  it('should be stale when no writers', () => {
    const table = createTable([1, 2], [3, 4], [], notExpired());
    expect(table.isStale()).toBeTruthy();
  });

  it('should not be stale with single reader', () => {
    const table = createTable([1, 2], [3], [4, 5], notExpired());
    expect(table.isStale()).toBeFalsy();
  });

  it('should not be stale with single writer', () => {
    const table = createTable([1, 2], [3, 4], [5], notExpired());
    expect(table.isStale()).toBeFalsy();
  });

  it('should forget reader, writer but not router', () => {
    const table = createTable([1, 2], [1, 2], [1, 2], notExpired());

    table.forget(1);

    expect(table.routers.toArray()).toEqual([1, 2]);
    expect(table.readers.toArray()).toEqual([2]);
    expect(table.writers.toArray()).toEqual([2]);
  });

  it('should forget single reader', () => {
    const table = createTable([1, 2], [42], [1, 2, 3], notExpired());

    table.forget(42);

    expect(table.routers.toArray()).toEqual([1, 2]);
    expect(table.readers.toArray()).toEqual([]);
    expect(table.writers.toArray()).toEqual([1, 2, 3]);
  });

  it('should forget single writer', () => {
    const table = createTable([1, 2], [3, 4, 5], [42], notExpired());

    table.forget(42);

    expect(table.routers.toArray()).toEqual([1, 2]);
    expect(table.readers.toArray()).toEqual([3, 4, 5]);
    expect(table.writers.toArray()).toEqual([]);
  });

  it('should forget router', () => {
    const table = createTable([1, 2], [1, 3], [4, 1], notExpired());

    table.forgetRouter(1);

    expect(table.routers.toArray()).toEqual([2]);
    expect(table.readers.toArray()).toEqual([1, 3]);
    expect(table.writers.toArray()).toEqual([4, 1]);
  });

  it('should forget writer', () => {
    const table = createTable([1, 2, 3], [2, 1, 5], [5, 1], notExpired());

    table.forgetWriter(1);

    expect(table.routers.toArray()).toEqual([1, 2, 3]);
    expect(table.readers.toArray()).toEqual([2, 1, 5]);
    expect(table.writers.toArray()).toEqual([5]);
  });

  it('should return all servers in diff when other table is empty', () => {
    const oldTable = createTable([1, 2], [3, 4], [5, 6], notExpired());
    const newTable = createTable([], [], [], notExpired());

    const servers = oldTable.serversDiff(newTable);

    expect(servers).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('should no servers in diff when this table is empty', () => {
    const oldTable = createTable([], [], [], notExpired());
    const newTable = createTable([1, 2], [3, 4], [5, 6], notExpired());

    const servers = oldTable.serversDiff(newTable);

    expect(servers).toEqual([]);
  });

  it('should include different routers in servers diff', () => {
    const oldTable = createTable([1, 7, 2, 42], [3, 4], [5, 6], notExpired());
    const newTable = createTable([1, 2], [3, 4], [5, 6], notExpired());

    const servers = oldTable.serversDiff(newTable);

    expect(servers).toEqual([7, 42]);
  });

  it('should include different readers in servers diff', () => {
    const oldTable = createTable([1, 2], [3, 7, 4, 42], [5, 6], notExpired());
    const newTable = createTable([1, 2], [3, 4], [5, 6], notExpired());

    const servers = oldTable.serversDiff(newTable);

    expect(servers).toEqual([7, 42]);
  });

  it('should include different writers in servers diff', () => {
    const oldTable = createTable([1, 2], [3, 4], [5, 7, 6, 42], notExpired());
    const newTable = createTable([1, 2], [3, 4], [5, 6], notExpired());

    const servers = oldTable.serversDiff(newTable);

    expect(servers).toEqual([7, 42]);
  });

  it('should include different servers in diff', () => {
    const oldTable = createTable([1, 2, 11], [22, 3, 33, 4], [5, 44, 6], notExpired());
    const newTable = createTable([1], [2, 3, 4, 6], [5], notExpired());

    const servers = oldTable.serversDiff(newTable);

    expect(servers).toEqual([11, 22, 33, 44]);
  });

  function expired() {
    return Date.now() - 3600; // expired an hour ago
  }

  function notExpired() {
    return Date.now() + 3600; // will expire in an hour
  }

  function createTable(routers, readers, writers, expirationTime) {
    const routersArray = new RoundRobinArray(routers);
    const readersArray = new RoundRobinArray(readers);
    const writersArray = new RoundRobinArray(writers);
    const expiration = int(expirationTime);
    return new RoutingTable(routersArray, readersArray, writersArray, expiration);
  }

});
