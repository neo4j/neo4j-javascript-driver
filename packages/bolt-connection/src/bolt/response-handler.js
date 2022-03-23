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
import { newError, json } from 'neo4j-driver-core'

// Signature bytes for each response message type
const SUCCESS = 0x70 // 0111 0000 // SUCCESS <metadata>
const RECORD = 0x71 // 0111 0001 // RECORD <value>
const IGNORED = 0x7e // 0111 1110 // IGNORED <metadata>
const FAILURE = 0x7f // 0111 1111 // FAILURE <metadata>

function NO_OP () {}

function NO_OP_IDENTITY (subject) {
  return subject
}

const NO_OP_OBSERVER = {
  onNext: NO_OP,
  onCompleted: NO_OP,
  onError: NO_OP
}

/**
 * Treat the protocol responses and notify the observers
 */
export default class ResponseHandler {
  /**
   * Called when something went wrong with the connectio
   * @callback ResponseHandler~Observer~OnErrorApplyTransformation
   * @param {any} error The error
   * @returns {any} The new error
   */
  /**
   * Called when something went wrong with the connectio
   * @callback ResponseHandler~Observer~OnError
   * @param {any} error The error
   */
  /**
   * Called when something went wrong with the connectio
   * @callback ResponseHandler~MetadataTransformer
   * @param {any} metadata The metadata got onSuccess
   * @returns {any} The transformed metadata
   */
  /**
   * @typedef {Object} ResponseHandler~Observer
   * @property {ResponseHandler~Observer~OnError} onError Invoke when a connection error occurs
   * @property {ResponseHandler~Observer~OnError} onFailure Invoke when a protocol failure occurs
   * @property {ResponseHandler~Observer~OnErrorApplyTransformation} onErrorApplyTransformation Invoke just after the failure occurs,
   *  before notify to respective observer. This method should transform the failure reason to the approprited one.
   */
  /**
   * Constructor
   * @param {Object} param The params
   * @param {ResponseHandler~MetadataTransformer} transformMetadata Transform metadata when the SUCCESS is received.
   * @param {Channel} channel The channel used to exchange messages
   * @param {Logger} log The logger
   * @param {ResponseHandler~Observer} observer Object which will be notified about errors
   */
  constructor ({ transformMetadata, log, observer } = {}) {
    this._pendingObservers = []
    this._log = log
    this._transformMetadata = transformMetadata || NO_OP_IDENTITY
    this._observer = Object.assign(
      {
        onPendingObserversChange: NO_OP,
        onError: NO_OP,
        onFailure: NO_OP,
        onErrorApplyTransformation: NO_OP_IDENTITY
      },
      observer
    )
  }

  get currentFailure () {
    return this._currentFailure
  }

  handleResponse (msg) {
    const payload = msg.fields[0]

    switch (msg.signature) {
      case RECORD:
        if (this._log.isDebugEnabled()) {
          this._log.debug(`S: RECORD ${json.stringify(msg)}`)
        }
        this._currentObserver.onNext(payload)
        break
      case SUCCESS:
        if (this._log.isDebugEnabled()) {
          this._log.debug(`S: SUCCESS ${json.stringify(msg)}`)
        }
        try {
          const metadata = this._transformMetadata(payload)
          this._currentObserver.onCompleted(metadata)
        } finally {
          this._updateCurrentObserver()
        }
        break
      case FAILURE:
        if (this._log.isDebugEnabled()) {
          this._log.debug(`S: FAILURE ${json.stringify(msg)}`)
        }
        try {
          const error = newError(payload.message, payload.code)
          this._currentFailure = this._observer.onErrorApplyTransformation(
            error
          )
          this._currentObserver.onError(this._currentFailure)
        } finally {
          this._updateCurrentObserver()
          // Things are now broken. Pending observers will get FAILURE messages routed until we are done handling this failure.
          this._observer.onFailure(this._currentFailure)
        }
        break
      case IGNORED:
        if (this._log.isDebugEnabled()) {
          this._log.debug(`S: IGNORED ${json.stringify(msg)}`)
        }
        try {
          if (this._currentFailure && this._currentObserver.onError) {
            this._currentObserver.onError(this._currentFailure)
          } else if (this._currentObserver.onError) {
            this._currentObserver.onError(
              newError('Ignored either because of an error or RESET')
            )
          }
        } finally {
          this._updateCurrentObserver()
        }
        break
      default:
        this._observer.onError(
          newError('Unknown Bolt protocol message: ' + msg)
        )
    }
  }

  /*
   * Pop next pending observer form the list of observers and make it current observer.
   * @protected
   */
  _updateCurrentObserver () {
    this._currentObserver = this._pendingObservers.shift()
    this._observer.onPendingObserversChange(this._pendingObservers.length)
  }

  _queueObserver (observer) {
    observer = observer || NO_OP_OBSERVER
    observer.onCompleted = observer.onCompleted || NO_OP
    observer.onError = observer.onError || NO_OP
    observer.onNext = observer.onNext || NO_OP
    if (this._currentObserver === undefined) {
      this._currentObserver = observer
    } else {
      this._pendingObservers.push(observer)
    }
    this._observer.onPendingObserversChange(this._pendingObservers.length)
    return true
  }

  _notifyErrorToObservers (error) {
    if (this._currentObserver && this._currentObserver.onError) {
      this._currentObserver.onError(error)
    }
    while (this._pendingObservers.length > 0) {
      const observer = this._pendingObservers.shift()
      if (observer && observer.onError) {
        observer.onError(error)
      }
    }
  }

  hasOngoingObservableRequests () {
    return this._currentObserver != null || this._pendingObservers.length > 0
  }

  _resetFailure () {
    this._currentFailure = null
  }

}
