/**
 * Copyright (c) "Neo4j"
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

/* eslint-disable @typescript-eslint/promise-function-async */

import Transaction from './transaction'
import {
  ConnectionHolder
} from './internal/connection-holder'

import { Bookmarks } from './internal/bookmarks'
import { TxConfig } from './internal/tx-config'

/**
 * Represents a {@link Promise<Transaction>} object and a {@link Transaction} object.
 *
 * Resolving this object promise verifies the result of the transaction begin and returns the {@link Transaction} object in case of success.
 *
 * The object can still also used as {@link Transaction} for convenience. The result of begin will be checked
 * during the next API calls in the object as it is in the transaction.
 *
 * @access public
 */
class TransactionPromise extends Transaction implements Promise<Transaction> {
  [Symbol.toStringTag]: string = 'TransactionPromise'
  private _beginError?: Error
  private _beginMetadata?: any
  private _beginPromise?: Promise<Transaction>
  private _reject?: (error: Error) => void
  private _resolve?: (value: Transaction | PromiseLike<Transaction>) => void

  /**
   * @constructor
   * @param {ConnectionHolder} connectionHolder - the connection holder to get connection from.
   * @param {function()} onClose - Function to be called when transaction is committed or rolled back.
   * @param {function(bookmarks: Bookmarks)} onBookmarks callback invoked when new bookmark is produced.
   * @param {function()} onConnection - Function to be called when a connection is obtained to ensure the connection
   * is not yet released.
   * @param {boolean} reactive whether this transaction generates reactive streams
   * @param {number} fetchSize - the record fetch size in each pulling batch.
   * @param {string} impersonatedUser - The name of the user which should be impersonated for the duration of the session.
   */
  constructor ({
    connectionHolder,
    onClose,
    onBookmarks,
    onConnection,
    reactive,
    fetchSize,
    impersonatedUser,
    highRecordWatermark,
    lowRecordWatermark
  }: {
    connectionHolder: ConnectionHolder
    onClose: () => void
    onBookmarks: (bookmarks: Bookmarks) => void
    onConnection: () => void
    reactive: boolean
    fetchSize: number
    impersonatedUser?: string
    highRecordWatermark: number
    lowRecordWatermark: number
  }) {
    super({
      connectionHolder,
      onClose,
      onBookmarks,
      onConnection,
      reactive,
      fetchSize,
      impersonatedUser,
      highRecordWatermark,
      lowRecordWatermark
    })
  }

  /**
   * Waits for the begin to complete.
   *
   * @param {function(transaction: Transaction)} onFulfilled - function to be called when finished.
   * @param {function(error: {message:string, code:string})} onRejected - function to be called upon errors.
   * @return {Promise} promise.
   */
  then<TResult1 = Transaction, TResult2 = never>(
    onfulfilled?:
    ((value: Transaction) => TResult1 | PromiseLike<TResult1>)
    | null,
    onrejected?:
    ((reason: any) => TResult2 | PromiseLike<TResult2>)
    | null
  ): Promise<TResult1 | TResult2> {
    return this._getOrCreateBeginPromise().then(onfulfilled, onrejected)
  }

  /**
   * Catch errors when using promises.
   *
   * @param {function(error: Neo4jError)} onRejected - Function to be called upon errors.
   * @return {Promise} promise.
   */
  catch <TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | null): Promise<any> {
    return this._getOrCreateBeginPromise().catch(onrejected)
  }

  /**
   * Called when finally the begin is done
   *
   * @param {function()|null} onfinally - function when the promise finished
   * @return {Promise} promise.
   */
  finally (onfinally?: (() => void) | null): Promise<Transaction> {
    return this._getOrCreateBeginPromise().finally(onfinally)
  }

  private _getOrCreateBeginPromise (): Promise<Transaction> {
    if (this._beginPromise == null) {
      this._beginPromise = new Promise((resolve, reject) => {
        this._resolve = resolve
        this._reject = reject
        if (this._beginError != null) {
          reject(this._beginError)
        }
        if (this._beginMetadata != null) {
          resolve(this._toTransaction())
        }
      })
    }
    return this._beginPromise
  }

  /**
   * @access private
   */
  private _toTransaction (): Transaction {
    return {
      ...this,
      query: super.query.bind(this),
      run: super.run.bind(this),
      commit: super.commit.bind(this),
      rollback: super.rollback.bind(this),
      close: super.close.bind(this),
      isOpen: super.isOpen.bind(this),
      _begin: this._begin.bind(this)
    }
  }

  /**
   * @access private
   */
  _begin (bookmarks: string | Bookmarks | string[], txConfig: TxConfig): void {
    return super._begin(bookmarks, txConfig, {
      onError: this._onBeginError.bind(this),
      onComplete: this._onBeginMetadata.bind(this)
    })
  }

  /**
   * @access private
   * @returns {void}
   */
  private _onBeginError (error: Error): void {
    this._beginError = error
    if (this._reject != null) {
      this._reject(error)
    }
  }

  /**
   * @access private
   * @returns {void}
   */
  private _onBeginMetadata (metadata: any): void {
    this._beginMetadata = metadata ?? {}
    if (this._resolve != null) {
      this._resolve(this._toTransaction())
    }
  }
}

export default TransactionPromise
