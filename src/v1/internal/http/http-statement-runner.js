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

import xhr from 'xhr';
import StreamObserver from '../stream-observer';
import Result from '../../result';
import {EMPTY_CONNECTION_HOLDER} from '../connection-holder';
import HttpDataConverter from './http-data-converter';

export default class HttpStatementRunner {

  constructor(url, authToken) {
    this._serverInfoSupplier = createServerInfoSupplier(url);
    this._transactionCommitUrl = createTransactionCommitUrl(url);
    this._headers = createHttpHeaders(authToken);
    this._converter = new HttpDataConverter();
  }

  run(statement, parameters) {
    const streamObserver = new StreamObserver();
    sendPostRequest(statement, parameters, streamObserver, this._transactionCommitUrl, this._headers, this._converter);
    return new Result(streamObserver, statement, parameters, this._serverInfoSupplier, EMPTY_CONNECTION_HOLDER);
  }
}

function createServerInfoSupplier(url) {
  return () => {
    return {server: {address: url.hostAndPort}};
  };
}

function createTransactionCommitUrl(url) {
  return url.scheme + '://' + url.host + ':' + url.port + '/db/data/transaction/commit';
}

function createHttpHeaders(authToken) {
  const basicAuthToken = 'Basic ' + btoa(authToken.principal + ':' + authToken.credentials);
  return {
    'Accept': 'application/json; charset=UTF-8',
    'Content-Type': 'application/json',
    'Authorization': basicAuthToken
  };
}

function sendPostRequest(statement, parameters, streamObserver, transactionCommitUrl, headers, converter) {
  try {
    xhr.post(
      transactionCommitUrl,
      {
        headers: headers,
        body: createStatementJson(statement, parameters, converter)
      },
      (error, response) => processPostResponse(error, response, converter, streamObserver)
    );
  } catch (e) {
    streamObserver.onError(e);
  }
}

function createStatementJson(statement, parameters, converter, streamObserver) {
  try {
    return createStatementJsonOrThrow(statement, parameters, converter);
  } catch (e) {
    streamObserver.onError(e);
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

function processPostResponse(error, response, converter, streamObserver) {
  try {
    processPostResponseOrThrow(error, response, converter, streamObserver);
  } catch (e) {
    streamObserver.onError(e);
  }
}

function processPostResponseOrThrow(error, response, converter, streamObserver) {
  if (error) {
    const neo4jError = converter.convertNetworkError(error);
    streamObserver.onError(neo4jError);
  } else {
    const responseJson = JSON.parse(response.body);

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
}
