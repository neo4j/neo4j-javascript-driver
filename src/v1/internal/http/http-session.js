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
import HttpStatementRunner from './http-statement-runner';

export default class HttpSession extends Session {

  constructor(url, authToken, config) {
    super(WRITE, null, null, config);
    this._statementRunner = new HttpStatementRunner(url, authToken);
  }

  run(statement, parameters = {}) {
    if (typeof statement === 'object' && statement.text) {
      parameters = statement.parameters || {};
      statement = statement.text;
    }
    assertCypherStatement(statement);

    return this._statementRunner.run(statement, parameters);
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
    callback();
  }
}

function throwTransactionsNotSupported() {
  throw new Neo4jError('Experimental HTTP driver does not support transactions');
}
