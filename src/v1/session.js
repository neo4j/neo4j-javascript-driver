/**
 * Copyright (c) 2002-2016 "Neo Technology,"
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

import StreamObserver from './internal/stream-observer';
import Result from './result';
import Transaction from './transaction';
import {Integer, int} from "./integer";
import {newError} from "./error";

/**
  * A Session instance is used for handling the connection and
  * sending statements through the connection.
  * @access public
  */

class Session {
  /**
   * @constructor
   * @param {Connection} conn - A connection to use
   * @param {function()} onClose - Function to be called on connection close
   */
  constructor( conn, onClose ) {
    this._conn = conn;
    this._onClose = onClose;
    this._hasTx = false;
  }

  isEncrypted() {
    return this._conn.isEncrypted();
  }

  /**
   * Run Cypher statement
   * Could be called with a statement object i.e.: {statement: "MATCH ...", parameters: {param: 1}}
   * or with the statement and parameters as separate arguments.
   * @param {mixed} statement - Cypher statement to execute
   * @param {Object} parameters - Map with parameters to use in statement
   * @return {Result} - New Result
   */
  run(statement, parameters = {}) {
    if(typeof statement === 'object' && statement.text) {
      parameters = statement.parameters || {};
      statement = statement.text;
    }
    let streamObserver = new _RunObserver();
    if (!this._hasTx) {
      this._conn.run(statement, parameters, streamObserver);
      this._conn.pullAll(streamObserver);
      this._conn.sync();
    } else {
      streamObserver.onError(newError("Statements cannot be run directly on a "
       + "session with an open transaction; either run from within the "
       + "transaction or use a different session."));
    }
    return new Result( streamObserver, statement, parameters, () => streamObserver.meta() );
  }

  /**
   * Begin a new transaction in this session. A session can have at most one transaction running at a time, if you
   * want to run multiple concurrent transactions, you should use multiple concurrent sessions.
   *
   * While a transaction is open the session cannot be used to run statements outside the transaction.
   *
   * @returns {Transaction} - New Transaction
   */
  beginTransaction() {
    if (this._hasTx) {
      throw new newError("You cannot begin a transaction on a session with an "
      + "open transaction; either run from within the transaction or use a "
      + "different session.")
    }

    this._hasTx = true;
    return new Transaction(this._conn, () => {this._hasTx = false});
  }

  /**
   * Close this session.
   * @param {function()} cb - Function to be called after the session has been closed
   * @return
   */
  close(cb=(()=>null)) {
    if(this._onClose) {
      try {
        this._onClose(cb);
      } finally {
        this._onClose = null;
      }
    } else {
      cb();
    }
  }
}

/** Internal stream observer used for transactional results*/
class _RunObserver extends StreamObserver {
  constructor() {
    super();
    this._meta = {};
  }

  onCompleted(meta) {
    super.onCompleted(meta);
    for(var key in meta){
      if(meta.hasOwnProperty(key)){
        this._meta[key]=meta[key];
      }
    }
  }

  meta() {
    return this._meta;
  }
}

export default Session;
