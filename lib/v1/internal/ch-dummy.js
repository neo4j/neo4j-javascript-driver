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

var _buf = require('./buf');

var observer = {
  instance: null,
  updateInstance: function updateInstance(instance) {
    observer.instance = instance;
  }
};

var DummyChannel = (function () {
  function DummyChannel(opts) {
    _classCallCheck(this, DummyChannel);

    this.written = [];
  }

  _createClass(DummyChannel, [{
    key: "write",
    value: function write(buf) {
      this.written.push(buf);
      observer.updateInstance(this);
    }
  }, {
    key: "toHex",
    value: function toHex() {
      var out = "";
      for (var i = 0; i < this.written.length; i++) {
        out += this.written[i].toHex();
      }
      return out;
    }
  }, {
    key: "toBuffer",
    value: function toBuffer() {
      return new _buf.CombinedBuffer(this.written);
    }
  }]);

  return DummyChannel;
})();

exports["default"] = {
  channel: DummyChannel,
  observer: observer
};
module.exports = exports["default"];