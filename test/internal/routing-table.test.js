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
import RoutingTable from '../../src/v1/internal/routing-table';
import {int} from '../../src/v1/integer';
import {READ, WRITE} from '../../src/v1/driver';

describe('routing-table', () => {

  it('should not be stale when has routers, readers, writers and future expiration date', () => {
    const table = createTable([1, 2], [3, 4], [5, 6], notExpired());
    expect(table.isStaleFor(READ)).toBeFalsy();
    expect(table.isStaleFor(WRITE)).toBeFalsy();
  });

  it('should be stale when expiration date in the past', () => {
    const table = createTable([1, 2], [1, 2], [1, 2], expired());
    expect(table.isStaleFor(READ)).toBeTruthy();
    expect(table.isStaleFor(WRITE)).toBeTruthy();
  });

  it('should not be stale when has single router', () => {
    const table = createTable([1], [2, 3], [4, 5], notExpired());
    expect(table.isStaleFor(READ)).toBeFalsy();
    expect(table.isStaleFor(WRITE)).toBeFalsy();
  });

  it('should be stale for reads but not writes when no readers', () => {
    const table = createTable([1, 2], [], [3, 4], notExpired());
    expect(table.isStaleFor(READ)).toBeTruthy();
    expect(table.isStaleFor(WRITE)).toBeFalsy();
  });

  it('should be stale for writes but not reads when no writers', () => {
    const table = createTable([1, 2], [3, 4], [], notExpired());
    expect(table.isStaleFor(READ)).toBeFalsy();
    expect(table.isStaleFor(WRITE)).toBeTruthy();
  });

  it('should not be stale with single reader', () => {
    const table = createTable([1, 2], [3], [4, 5], notExpired());
    expect(table.isStaleFor(READ)).toBeFalsy();
    expect(table.isStaleFor(WRITE)).toBeFalsy();
  });

  it('should not be stale with single writer', () => {
    const table = createTable([1, 2], [3, 4], [5], notExpired());
    expect(table.isStaleFor(READ)).toBeFalsy();
    expect(table.isStaleFor(WRITE)).toBeFalsy();
  });

  it('should forget reader, writer but not router', () => {
    const table = createTable([1, 2], [1, 2], [1, 2], notExpired());

    table.forget(1);

    expect(table.routers).toEqual([1, 2]);
    expect(table.readers).toEqual([2]);
    expect(table.writers).toEqual([2]);
  });

  it('should forget single reader', () => {
    const table = createTable([1, 2], [42], [1, 2, 3], notExpired());

    table.forget(42);

    expect(table.routers).toEqual([1, 2]);
    expect(table.readers).toEqual([]);
    expect(table.writers).toEqual([1, 2, 3]);
  });

  it('should forget single writer', () => {
    const table = createTable([1, 2], [3, 4, 5], [42], notExpired());

    table.forget(42);

    expect(table.routers).toEqual([1, 2]);
    expect(table.readers).toEqual([3, 4, 5]);
    expect(table.writers).toEqual([]);
  });

  it('should forget router', () => {
    const table = createTable([1, 2], [1, 3], [4, 1], notExpired());

    table.forgetRouter(1);

    expect(table.routers).toEqual([2]);
    expect(table.readers).toEqual([1, 3]);
    expect(table.writers).toEqual([4, 1]);
  });

  it('should forget writer', () => {
    const table = createTable([1, 2, 3], [2, 1, 5], [5, 1], notExpired());

    table.forgetWriter(1);

    expect(table.routers).toEqual([1, 2, 3]);
    expect(table.readers).toEqual([2, 1, 5]);
    expect(table.writers).toEqual([5]);
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

  it('should have correct toString', () => {
    const table = createTable([1, 2], [3, 4], [5, 6], 42);
    expect(table.toString()).toEqual('RoutingTable[expirationTime=42, routers=[1,2], readers=[3,4], writers=[5,6]]');
  });

  function expired() {
    return Date.now() - 3600; // expired an hour ago
  }

  function notExpired() {
    return Date.now() + 3600; // will expire in an hour
  }

  function createTable(routers, readers, writers, expirationTime) {
    const expiration = int(expirationTime);
    return new RoutingTable(routers, readers, writers, expiration);
  }

});
