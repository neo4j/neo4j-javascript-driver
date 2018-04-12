/**
 * Copyright (c) 2002-2018 "Neo Technology,"
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

import {WRITE} from '../../driver';
import Session from '../../session';
import {assertCypherStatement} from '../util';
import {Neo4jError} from '../../error';
import HttpRequestRunner from './http-request-runner';
import {EMPTY_CONNECTION_HOLDER} from '../connection-holder';
import Result from '../../result';

export default class HttpSession extends Session {

  constructor(url, authToken, config) {
    super(WRITE, null, null, config);
    this._ongoingTransactionIds = [];
    this._serverInfoSupplier = createServerInfoSupplier(url);
    this._requestRunner = new HttpRequestRunner(url, authToken);
  }

  run(statement, parameters = {}) {
    if (typeof statement === 'object' && statement.text) {
      parameters = statement.parameters || {};
      statement = statement.text;
    }
    assertCypherStatement(statement);

    return this._requestRunner.beginTransaction().then(transactionId => {
      this._ongoingTransactionIds.push(transactionId);
      const queryPromise = this._requestRunner.runQuery(transactionId, statement, parameters);

      return queryPromise.then(streamObserver => {
        if (streamObserver.hasFailed()) {
          return rollbackTransactionAfterQueryFailure(transactionId, streamObserver, this._requestRunner);
        } else {
          return commitTransactionAfterQuerySuccess(transactionId, streamObserver, this._requestRunner);
        }
      }).then(streamObserver => {
        this._ongoingTransactionIds = this._ongoingTransactionIds.filter(id => id !== transactionId);
        return new Result(streamObserver, statement, parameters, this._serverInfoSupplier, EMPTY_CONNECTION_HOLDER);
      });
    });
  }

  beginTransaction() {
    throwTransactionsNotSupported();
  }

  readTransaction() {
    throwTransactionsNotSupported();
  }

  writeTransaction() {
    throwTransactionsNotSupported();
  }

  lastBookmark() {
    throw new Neo4jError('Experimental HTTP driver does not support bookmarks and routing');
  }

  close(callback = (() => null)) {
    const rollbackAllOngoingTransactions = this._ongoingTransactionIds.map(transactionId =>
      rollbackTransactionSilently(transactionId, this._requestRunner)
    );

    Promise.all(rollbackAllOngoingTransactions).then(() => callback());
  }
}

function rollbackTransactionAfterQueryFailure(transactionId, streamObserver, requestRunner) {
  return rollbackTransactionSilently(transactionId, requestRunner).then(() => streamObserver);
}

function commitTransactionAfterQuerySuccess(transactionId, streamObserver, requestRunner) {
  return requestRunner.commitTransaction(transactionId).catch(error => {
    streamObserver.onError(error);
  }).then(() => {
    return streamObserver;
  });
}

function rollbackTransactionSilently(transactionId, requestRunner) {
  return requestRunner.rollbackTransaction(transactionId).catch(error => {
    // ignore all rollback errors
  });
}

function createServerInfoSupplier(url) {
  return () => {
    return {server: {address: url.hostAndPort}};
  };
}

function throwTransactionsNotSupported() {
  throw new Neo4jError('Experimental HTTP driver does not support transactions');
}
