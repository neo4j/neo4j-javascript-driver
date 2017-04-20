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

import GetServersUtil from "../../src/v1/internal/get-servers-util";
import Record from "../../src/v1/record";
import Integer, {int} from "../../src/v1/integer";
import {newError, PROTOCOL_ERROR, SERVICE_UNAVAILABLE, SESSION_EXPIRED} from "../../src/v1/error";
import lolex from "lolex";

const ROUTER_ADDRESS = 'bolt+routing://test.router.com';

describe('get-servers-util', () => {

  let clock;

  beforeAll(() => {
    clock = lolex.install();
  });

  afterAll(() => {
    clock.uninstall();
  });

  it('should return retrieved records when query succeeds', done => {
    const session = FakeSession.successful({records: ['foo', 'bar', 'baz']});

    callGetServers(session).then(records => {
      expect(records).toEqual(['foo', 'bar', 'baz']);
      done();
    }).catch(console.log);
  });

  it('should close session when query succeeds', done => {
    const session = FakeSession.successful({records: ['foo', 'bar', 'baz']});

    callGetServers(session).then(() => {
      expect(session.isClosed()).toBeTruthy();
      done();
    }).catch(console.log);
  });

  it('should not close session when query fails', done => {
    const session = FakeSession.failed(newError('Oh no!', SESSION_EXPIRED));

    callGetServers(session).then(() => {
      expect(session.isClosed()).toBeFalsy();
      done();
    }).catch(console.log);
  });

  it('should return null on connection error', done => {
    const session = FakeSession.failed(newError('Oh no!', SESSION_EXPIRED));

    callGetServers(session).then(records => {
      expect(records).toBeNull();
      done();
    }).catch(console.log);
  });

  it('should fail when procedure not found', done => {
    const session = FakeSession.failed(newError('Oh no!', 'Neo.ClientError.Procedure.ProcedureNotFound'));

    callGetServers(session).catch(error => {
      expect(error.code).toBe(SERVICE_UNAVAILABLE);
      expect(error.message).toBe('Server ' + ROUTER_ADDRESS + ' could not perform routing. ' +
        'Make sure you are connecting to a causal cluster');
      done();
    });
  });

  it('should parse valid ttl', () => {
    testValidTtlParsing(100, 5);
    testValidTtlParsing(Date.now(), 3600); // 1 hour
    testValidTtlParsing(Date.now(), 86400); // 24 hours
    testValidTtlParsing(Date.now(), 3628800); // 42 days
    testValidTtlParsing(0, 1);
    testValidTtlParsing(50, 0);
    testValidTtlParsing(Date.now(), 0);
  });

  it('should not overflow parsing huge ttl', () => {
    const record = newRecord({ttl: Integer.MAX_VALUE});
    clock.setSystemTime(42);

    const expirationTime = parseTtl(record);

    expect(expirationTime).toBe(Integer.MAX_VALUE);
  });

  it('should return valid value parsing negative ttl', () => {
    const record = newRecord({ttl: int(-42)});
    clock.setSystemTime(42);

    const expirationTime = parseTtl(record);

    expect(expirationTime).toBe(Integer.MAX_VALUE);
  });

  it('should throw when record does not have a ttl entry', done => {
    const record = new Record(["notTtl", "servers"], []);
    expectProtocolError(() => parseTtl(record), done);
  });

  it('should parse servers', () => {
    testValidServersParsing([], [], []);

    testValidServersParsing(['router1'], [], []);
    testValidServersParsing([], ['reader1'], []);
    testValidServersParsing([], [], ['writer1']);

    testValidServersParsing(['router1'], ['reader1'], []);
    testValidServersParsing(['router1'], ['reader1'], ['writer1']);
    testValidServersParsing([], ['reader1'], ['writer1']);

    testValidServersParsing(['router1'], ['reader1'], ['writer1']);
    testValidServersParsing(['router1', 'router2'], ['reader1', 'reader2'], ['writer1']);
    testValidServersParsing(['router1', 'router2'], ['reader1', 'reader2'], ['writer1', 'writer2']);
  });

  it('should fail to parse servers entry when record does not have servers', done => {
    const record = new Record(['ttl', 'notServers'], [int(42), [{"role": "READ", "addresses": ['1', '2', '3']}]]);
    expectProtocolError(() => parseServers(record), done);
  });

  it('should fail to parse servers entry without role', done => {
    const record = new Record(['ttl', 'servers'], [int(42), [{"notRole": "READ", "addresses": ['1', '2', '3']}]]);
    expectProtocolError(() => parseServers(record), done);
  });

  it('should fail to parse servers entry with illegal role', done => {
    const record = new Record(['ttl', 'servers'], [int(42), [{"role": "ARBITER", "addresses": ['1', '2', '3']}]]);
    expectProtocolError(() => parseServers(record), done);
  });

  it('should fail to parse servers entry with just ttl', done => {
    const record = new Record(['ttl', 'servers'], [int(42), [{"role": "READ"}]]);
    expectProtocolError(() => parseServers(record), done);
  });

  it('should fail to parse servers entry without addresses', done => {
    const record = new Record(['ttl', 'servers'], [int(42), [{"role": "WRITE", "notAddresses": ['1', '2', '3']}]]);
    expectProtocolError(() => parseServers(record), done);
  });

  it('should fail to parse servers entry with string addresses', done => {
    const record = new Record(['ttl', 'servers'], [int(42), [{"role": "WRITE", "addresses": ''}]]);
    expectProtocolError(() => parseServers(record), done);
  });

  it('should fail to parse servers entry with null addresses', done => {
    const record = new Record(['ttl', 'servers'], [int(42), [{"role": "WRITE", "addresses": null}]]);
    expectProtocolError(() => parseServers(record), done);
  });

  it('should fail to parse servers entry with integer addresses', done => {
    const record = new Record(['ttl', 'servers'], [int(42), [{"role": "WRITE", "addresses": 12345}]]);
    expectProtocolError(() => parseServers(record), done);
  });

  it('should fail to parse servers entry with object addresses', done => {
    const record = new Record(['ttl', 'servers'], [int(42), [{"role": "WRITE", "addresses": {key: ['localhost']}}]]);
    expectProtocolError(() => parseServers(record), done);
  });

  function testValidTtlParsing(currentTime, ttlSeconds) {
    const record = newRecord({ttl: int(ttlSeconds)});
    clock.setSystemTime(currentTime);

    const expirationTime = parseTtl(record).toNumber();

    expect(expirationTime).toEqual(currentTime + ttlSeconds * 1000);
  }

  function testValidServersParsing(routerAddresses, readerAddresses, writerAddresses) {
    const record = newRecord({routers: routerAddresses, readers: readerAddresses, writers: writerAddresses});

    const {routers, readers, writers} = parseServers(record);

    expect(routers.toArray()).toEqual(routerAddresses);
    expect(readers.toArray()).toEqual(readerAddresses);
    expect(writers.toArray()).toEqual(writerAddresses);
  }

  function callGetServers(session) {
    const util = new GetServersUtil();
    return util.callGetServers(session, ROUTER_ADDRESS);
  }

  function parseTtl(record) {
    const util = new GetServersUtil();
    return util.parseTtl(record, ROUTER_ADDRESS);
  }

  function parseServers(record) {
    const util = new GetServersUtil();
    return util.parseServers(record, ROUTER_ADDRESS);
  }

  function newRecord({ttl = int(42), routers = [], readers = [], writers = []}) {
    const routersField = {
      "role": "ROUTE",
      "addresses": routers
    };
    const readersField = {
      "role": "READ",
      "addresses": readers
    };
    const writersField = {
      "role": "WRITE",
      "addresses": writers
    };
    return new Record(["ttl", "servers"], [ttl, [routersField, readersField, writersField]]);
  }

  function expectProtocolError(action, done) {
    const promise = new Promise((resolve, reject) => {
      try {
        resolve(action());
      } catch (e) {
        reject(e);
      }
    });

    promise.catch(error => {
      expect(error.code).toBe(PROTOCOL_ERROR);
      done();
    });
  }

  class FakeSession {

    constructor(runResponses) {
      this._runResponses = runResponses;
      this._closed = false;
      this._runCounter = 0;
    }

    static successful(result) {
      return new FakeSession(Promise.resolve(result));
    }

    static failed(error) {
      return new FakeSession(Promise.reject(error));
    }

    run() {
      return this._runResponses[this._runCounter ++];
    }

    close() {
      this._closed = true;
    }

    isClosed() {
      return this._closed;
    }
  }
});
