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

import StreamObserver from '../stream-observer';
import HttpResponseConverter from './http-response-converter';
import {Neo4jError, SERVICE_UNAVAILABLE} from '../../error';

export default class HttpRequestRunner {

  constructor(url, authToken) {
    this._url = url;
    this._authToken = authToken;
    this._converter = new HttpResponseConverter();
  }

  /**
   * Send a HTTP request to begin a transaction.
   * @return {Promise<number>} promise resolved with the transaction id or rejected with an error.
   */
  beginTransaction() {
    const url = beginTransactionUrl(this._url);
    return sendRequest('POST', url, null, this._authToken).then(responseJson => {
      const neo4jError = this._converter.extractError(responseJson);
      if (neo4jError) {
        throw neo4jError;
      }
      return this._converter.extractTransactionId(responseJson);
    });
  }

  /**
   * Send a HTTP request to commit a transaction.
   * @param {number} transactionId id of the transaction to commit.
   * @return {Promise<void>} promise resolved if transaction got committed or rejected when commit failed.
   */
  commitTransaction(transactionId) {
    const url = commitTransactionUrl(this._url, transactionId);
    return sendRequest('POST', url, null, this._authToken).then(responseJson => {
      const neo4jError = this._converter.extractError(responseJson);
      if (neo4jError) {
        throw neo4jError;
      }
    });
  }

  /**
   * Send a HTTP request to rollback a transaction.
   * @param {number} transactionId id of the transaction to rollback.
   * @return {Promise<void>} promise resolved if transaction got rolled back or rejected when rollback failed.
   */
  rollbackTransaction(transactionId) {
    const url = transactionUrl(this._url, transactionId);
    return sendRequest('DELETE', url, null, this._authToken).then(responseJson => {
      const neo4jError = this._converter.extractError(responseJson);
      if (neo4jError) {
        throw neo4jError;
      }
    });
  }

  /**
   * Send a HTTP request to execute a query in a transaction with the given id.
   * @param {number} transactionId the transaction id.
   * @param {string} statement the cypher query.
   * @param {object} parameters the cypher query parameters.
   * @return {Promise<StreamObserver>} a promise resolved with {@link StreamObserver} containing either records or error.
   */
  runQuery(transactionId, statement, parameters) {
    const streamObserver = new StreamObserver();
    const url = transactionUrl(this._url, transactionId);
    const body = createStatementJson(statement, parameters, this._converter, streamObserver);
    if (!body) {
      // unable to encode given statement and parameters, return a failed stream observer
      return Promise.resolve(streamObserver);
    }

    return sendRequest('POST', url, body, this._authToken).then(responseJson => {
      processResponseJson(responseJson, this._converter, streamObserver);
    }).catch(error => {
      streamObserver.onError(error);
    }).then(() => {
      return streamObserver;
    });
  }
}

function sendRequest(method, url, bodyString, authToken) {
  try {
    const options = {
      method: method,
      headers: createHttpHeaders(authToken),
      body: bodyString
    };

    return new Promise((resolve, reject) => {
      fetch(url, options)
        .then(response => response.json())
        .then(responseJson => resolve(responseJson))
        .catch(error => reject(new Neo4jError(error.message, SERVICE_UNAVAILABLE)));
    });
  } catch (e) {
    return Promise.reject(e);
  }
}

function createHttpHeaders(authToken) {
  const headers = new Headers();
  headers.append('Accept', 'application/json; charset=UTF-8');
  headers.append('Content-Type', 'application/json');
  headers.append('Authorization', 'Basic ' + btoa(authToken.principal + ':' + authToken.credentials));
  return headers;
}

function createStatementJson(statement, parameters, converter, streamObserver) {
  try {
    return createStatementJsonOrThrow(statement, parameters, converter);
  } catch (e) {
    streamObserver.onError(e);
    return null;
  }
}

function createStatementJsonOrThrow(statement, parameters, converter) {
  const encodedParameters = converter.encodeStatementParameters(parameters);
  return JSON.stringify({
    statements: [{
      statement: statement,
      parameters: encodedParameters,
      resultDataContents: ['row', 'graph'],
      includeStats: true
    }]
  });
}

function processResponseJson(responseJson, converter, streamObserver) {
  if (!responseJson) {
    // request failed and there is no response
    return;
  }

  try {
    processResponseJsonOrThrow(responseJson, converter, streamObserver);
  } catch (e) {
    streamObserver.onError(e);
  }
}

function processResponseJsonOrThrow(responseJson, converter, streamObserver) {
  const neo4jError = converter.extractError(responseJson);
  if (neo4jError) {
    streamObserver.onError(neo4jError);
  } else {
    const recordMetadata = converter.extractRecordMetadata(responseJson);
    streamObserver.onCompleted(recordMetadata);

    const rawRecords = converter.extractRawRecords(responseJson);
    rawRecords.forEach(rawRecord => streamObserver.onNext(rawRecord));

    const statementMetadata = converter.extractStatementMetadata(responseJson);
    streamObserver.onCompleted(statementMetadata);
  }
}

function beginTransactionUrl(baseUrl) {
  return createUrl(baseUrl, '/db/data/transaction');
}

function commitTransactionUrl(baseUrl, transactionId) {
  return transactionUrl(baseUrl, transactionId) + '/commit';
}

function transactionUrl(baseUrl, transactionId) {
  return beginTransactionUrl(baseUrl) + '/' + transactionId;
}

function createUrl(baseUrl, path) {
  return `${baseUrl.scheme}://${baseUrl.host}:${baseUrl.port}${path}`;
}
