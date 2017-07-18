"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _keys = require("babel-runtime/core-js/object/keys");

var _keys2 = _interopRequireDefault(_keys);

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
    this._activeResourceCounts = {};
    this._release = this._release.bind(this);
  }

  /**
   * Acquire and idle resource fom the pool or create a new one.
   * @param {string} key the resource key.
   * @return {object} resource that is ready to use.
   */


  (0, _createClass3.default)(Pool, [{
    key: "acquire",
    value: function acquire(key) {
      var pool = this._pools[key];
      if (!pool) {
        pool = [];
        this._pools[key] = pool;
      }
      while (pool.length) {
        var resource = pool.pop();

        if (this._validate(resource)) {
          // idle resource is valid and can be acquired
          resourceAcquired(key, this._activeResourceCounts);
          return resource;
        } else {
          this._destroy(resource);
        }
      }

      // there exist no idle valid resources, create a new one for acquisition
      resourceAcquired(key, this._activeResourceCounts);
      return this._create(key, this._release);
    }

    /**
     * Destroy all idle resources for the given key.
     * @param {string} key the resource key to purge.
     */

  }, {
    key: "purge",
    value: function purge(key) {
      var pool = this._pools[key] || [];
      while (pool.length) {
        var resource = pool.pop();
        this._destroy(resource);
      }
      delete this._pools[key];
    }

    /**
     * Destroy all idle resources in this pool.
     */

  }, {
    key: "purgeAll",
    value: function purgeAll() {
      var _this = this;

      (0, _keys2.default)(this._pools).forEach(function (key) {
        return _this.purge(key);
      });
    }

    /**
     * Check if this pool contains resources for the given key.
     * @param {string} key the resource key to check.
     * @return {boolean} <code>true</code> when pool contains entries for the given key, <code>false</code> otherwise.
     */

  }, {
    key: "has",
    value: function has(key) {
      return key in this._pools;
    }

    /**
     * Get count of active (checked out of the pool) resources for the given key.
     * @param {string} key the resource key to check.
     * @return {number} count of resources acquired by clients.
     */

  }, {
    key: "activeResourceCount",
    value: function activeResourceCount(key) {
      return this._activeResourceCounts[key] || 0;
    }
  }, {
    key: "_release",
    value: function _release(key, resource) {
      var pool = this._pools[key];

      if (pool) {
        // there exist idle connections for the given key
        if (pool.length >= this._maxIdle || !this._validate(resource)) {
          this._destroy(resource);
        } else {
          pool.push(resource);
        }
      } else {
        // key has been purged, don't put it back, just destroy the resource
        this._destroy(resource);
      }

      resourceReleased(key, this._activeResourceCounts);
    }
  }]);
  return Pool;
}();

/**
 * Increment active (checked out of the pool) resource counter.
 * @param {string} key the resource group identifier (server address for connections).
 * @param {Object.<string, number>} activeResourceCounts the object holding active counts per key.
 */


function resourceAcquired(key, activeResourceCounts) {
  var currentCount = activeResourceCounts[key] || 0;
  activeResourceCounts[key] = currentCount + 1;
}

/**
 * Decrement active (checked out of the pool) resource counter.
 * @param {string} key the resource group identifier (server address for connections).
 * @param {Object.<string, number>} activeResourceCounts the object holding active counts per key.
 */
function resourceReleased(key, activeResourceCounts) {
  var currentCount = activeResourceCounts[key] || 0;
  var nextCount = currentCount - 1;
  if (nextCount > 0) {
    activeResourceCounts[key] = nextCount;
  } else {
    delete activeResourceCounts[key];
  }
}

exports.default = Pool;