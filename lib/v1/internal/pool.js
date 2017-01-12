"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _classCallCheck2 = require("babel-runtime/helpers/classCallCheck");

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require("babel-runtime/helpers/createClass");

var _createClass3 = _interopRequireDefault(_createClass2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

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

var Pool = function () {
  /**
   * @param create  an allocation function that creates a new resource. It's given
   *                a single argument, a function that will return the resource to
   *                the pool if invoked, which is meant to be called on .dispose
   *                or .close or whatever mechanism the resource uses to finalize.
   * @param destroy called with the resource when it is evicted from this pool
   * @param validate called at various times (like when an instance is acquired and
   *                 when it is returned). If this returns false, the resource will
   *                 be evicted
   * @param maxIdle the max number of resources that are allowed idle in the pool at
   *                any time. If this threshold is exceeded, resources will be evicted.
   */
  function Pool(create) {
    var destroy = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : function () {
      return true;
    };
    var validate = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : function () {
      return true;
    };
    var maxIdle = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : 50;
    (0, _classCallCheck3.default)(this, Pool);

    this._create = create;
    this._destroy = destroy;
    this._validate = validate;
    this._maxIdle = maxIdle;
    this._pools = {};
    this._release = this._release.bind(this);
  }

  (0, _createClass3.default)(Pool, [{
    key: "acquire",
    value: function acquire(key) {
      var resource = void 0;
      var pool = this._pools[key];
      if (!pool) {
        pool = [];
        this._pools[key] = pool;
      }
      while (pool.length) {
        resource = pool.pop();

        if (this._validate(resource)) {
          return resource;
        } else {
          this._destroy(resource);
        }
      }

      return this._create(key, this._release);
    }
  }, {
    key: "purge",
    value: function purge(key) {
      var resource = void 0;
      var pool = this._pools[key] || [];
      while (pool.length) {
        resource = pool.pop();
        this._destroy(resource);
      }
      delete this._pools[key];
    }
  }, {
    key: "purgeAll",
    value: function purgeAll() {
      for (var key in this._pools.keys) {
        if (this._pools.hasOwnPropertykey) {
          this.purge(key);
        }
      }
    }
  }, {
    key: "has",
    value: function has(key) {
      return key in this._pools;
    }
  }, {
    key: "_release",
    value: function _release(key, resource) {
      var pool = this._pools[key];
      if (!pool) {
        //key has been purged, don't put it back
        return;
      }
      if (pool.length >= this._maxIdle || !this._validate(resource)) {
        this._destroy(resource);
      } else {
        pool.push(resource);
      }
    }
  }]);
  return Pool;
}();

exports.default = Pool;