"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.observer = exports.channel = undefined;

var _classCallCheck2 = require("babel-runtime/helpers/classCallCheck");

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require("babel-runtime/helpers/createClass");

var _createClass3 = _interopRequireDefault(_createClass2);

var _buf = require("./buf");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var observer = {
  instance: null,
  updateInstance: function updateInstance(instance) {
    observer.instance = instance;
  }
}; /**
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

var DummyChannel = function () {
  function DummyChannel(opts) {
    (0, _classCallCheck3.default)(this, DummyChannel);

    this.written = [];
  }

  (0, _createClass3.default)(DummyChannel, [{
    key: "isEncrypted",
    value: function isEncrypted() {
      return false;
    }
  }, {
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
}();

var channel = DummyChannel;

exports.channel = channel;
exports.observer = observer;