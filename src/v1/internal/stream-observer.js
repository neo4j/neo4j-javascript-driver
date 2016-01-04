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

/**
 * Handles a RUN/PULL_ALL, or RUN/DISCARD_ALL requests, maps the responses
 * in a way that a user-provided observer can see these as a clean Stream
 * of records.
 * This class will queue up incoming messages until a user-provided observer
 * for the incoming stream is registered. Thus, we keep fields around
 * for tracking head/records/tail. These are only used if there is no
 * observer registered.
 * @access private
 */
class StreamObserver {
  /**
   * @constructor
   */
  constructor() {
    this._head = null;
    this._queuedRecords = [];
    this._tail = null;
    this._error = null;
  }

  /**
   * Will be called on every record that comes in and transform a raw record
   * to a Object. If user-provided observer is present, pass transformed record
   * to it's onNext method, otherwise, push to record que.
   * @param {Array} rawRecord - An array with the raw record
   */
  onNext(rawRecord) {
    let record = {};
    for (var i = 0; i < this._head.length; i++) {
      record[this._head[i]] = rawRecord[i];
    }
    if( this._observer ) {
      this._observer.onNext( record );
    } else {
      this._queuedRecords.push( record );
    }
  }

  /**
   * TODO
   */
  onCompleted(meta) {
    if( this._head === null ) {
      // Stream header
      this._head = meta.fields;
    } else {
      // End of stream
      if( this._observer ) {
        this._observer.onCompleted( meta );
      } else {
        this._tail = meta;
      }
    }
  }

  /**
   * Will be called on errors.
   * If user-provided observer is present, pass the error
   * to it's onError method, otherwise set instance variable _error.
   * @param {Object} error - An error object
   */
  onError(error) {
    if( this._observer ) {
      if( this._observer.onError ) {
        this._observer.onError( error );
      } else {
        console.log( error );
      }
    } else {
      this._error = error;
    }
  }

  /**
   * Subscribe to events with provided observer.
   * @param {Object} observer - Observer object
   * @param {function(record: Object)} observer.onNext - Handle records, one by one.
   * @param {function(metadata: Object)} observer.onComplete - Handle stream tail, the metadata.
   * @param {function(error: Object)} observer.onError - Handle errors.
   */
  subscribe( observer ) {
    if( this._error ) {
      observer.onError(this._error);
      return;
    }
    if( this._queuedRecords.length > 0 ) {
      for (var i = 0; i < _queuedRecords.length; i++) {
        observer.onNext( _queuedRecords[i] );
      }
    }
    if( this._tail ) {
      observer.onCompleted( this._tail );
    }
    this._observer = observer;
  }
}

export default StreamObserver;
