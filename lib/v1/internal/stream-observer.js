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

"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var _record = require("../record");

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

var StreamObserver = (function () {
  /**
   * @constructor
   */

  function StreamObserver() {
    _classCallCheck(this, StreamObserver);

    this._fieldKeys = null;
    this._fieldLookup = null;
    this._queuedRecords = [];
    this._tail = null;
    this._error = null;
    this._hasFailed = false;
  }

  /**
   * Will be called on every record that comes in and transform a raw record
   * to a Object. If user-provided observer is present, pass transformed record
   * to it's onNext method, otherwise, push to record que.
   * @param {Array} rawRecord - An array with the raw record
   */

  _createClass(StreamObserver, [{
    key: "onNext",
    value: function onNext(rawRecord) {
      var record = new _record.Record(this._fieldKeys, rawRecord, this._fieldLookup);
      if (this._observer) {
        this._observer.onNext(record);
      } else {
        this._queuedRecords.push(record);
      }
    }
  }, {
    key: "onCompleted",
    value: function onCompleted(meta) {
      if (this._fieldKeys === null) {
        // Stream header, build a name->index field lookup table
        // to be used by records. This is an optimization to make it
        // faster to look up fields in a record by name, rather than by index.
        // Since the records we get back via Bolt are just arrays of values.
        this._fieldKeys = [];
        this._fieldLookup = {};
        if (meta.fields && meta.fields.length > 0) {
          this._fieldKeys = meta.fields;
          for (var i = 0; i < meta.fields.length; i++) {
            this._fieldLookup[meta.fields[i]] = i;
          }
        }
      } else {
        // End of stream
        if (this._observer) {
          this._observer.onCompleted(meta);
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
  }, {
    key: "onError",
    value: function onError(error) {
      if (this._hasFailed) {
        return;
      }
      this._hasFailed = true;
      if (this._observer) {
        if (this._observer.onError) {
          this._observer.onError(error);
        } else {
          console.log(error);
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
  }, {
    key: "subscribe",
    value: function subscribe(observer) {
      if (this._error) {
        observer.onError(this._error);
        return;
      }
      if (this._queuedRecords.length > 0) {
        for (var i = 0; i < _queuedRecords.length; i++) {
          observer.onNext(_queuedRecords[i]);
        }
      }
      if (this._tail) {
        observer.onCompleted(this._tail);
      }
      this._observer = observer;
    }
  }]);

  return StreamObserver;
})();

exports["default"] = StreamObserver;
module.exports = exports["default"];