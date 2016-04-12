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

var Pool = (function () {
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
    var destroy = arguments.length <= 1 || arguments[1] === undefined ? function () {
      return true;
    } : arguments[1];
    var validate = arguments.length <= 2 || arguments[2] === undefined ? function () {
      return true;
    } : arguments[2];
    var maxIdle = arguments.length <= 3 || arguments[3] === undefined ? 50 : arguments[3];

    _classCallCheck(this, Pool);

    this._create = create;
    this._destroy = destroy;
    this._validate = validate;
    this._maxIdle = maxIdle;
    this._pool = [];
    this._release = this._release.bind(this);
  }

  _createClass(Pool, [{
    key: "acquire",
    value: function acquire() {
      if (this._pool.length > 0) {
        return this._pool.pop();
      } else {
        return this._create(this._release);
      }
    }
  }, {
    key: "_release",
    value: function _release(resource) {
      if (this._pool.length >= this._maxIdle || !this._validate(resource)) {
        this._destroy(resource);
      } else {
        this._pool.push(resource);
      }
    }
  }]);

  return Pool;
})();

exports["default"] = {
  Pool: Pool
};
module.exports = exports["default"];