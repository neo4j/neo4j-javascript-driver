'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.DnsHostNameResolver = exports.DummyHostNameResolver = undefined;

var _promise = require('babel-runtime/core-js/promise');

var _promise2 = _interopRequireDefault(_promise);

var _getPrototypeOf = require('babel-runtime/core-js/object/get-prototype-of');

var _getPrototypeOf2 = _interopRequireDefault(_getPrototypeOf);

var _possibleConstructorReturn2 = require('babel-runtime/helpers/possibleConstructorReturn');

var _possibleConstructorReturn3 = _interopRequireDefault(_possibleConstructorReturn2);

var _inherits2 = require('babel-runtime/helpers/inherits');

var _inherits3 = _interopRequireDefault(_inherits2);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require('babel-runtime/helpers/createClass');

var _createClass3 = _interopRequireDefault(_createClass2);

var _connector = require('./connector');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var HostNameResolver = function () {
  function HostNameResolver() {
    (0, _classCallCheck3.default)(this, HostNameResolver);
  }

  (0, _createClass3.default)(HostNameResolver, [{
    key: 'resolve',
    value: function resolve() {
      throw new Error('Abstract function');
    }
  }]);
  return HostNameResolver;
}(); /**
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

var DummyHostNameResolver = exports.DummyHostNameResolver = function (_HostNameResolver) {
  (0, _inherits3.default)(DummyHostNameResolver, _HostNameResolver);

  function DummyHostNameResolver() {
    (0, _classCallCheck3.default)(this, DummyHostNameResolver);
    return (0, _possibleConstructorReturn3.default)(this, (DummyHostNameResolver.__proto__ || (0, _getPrototypeOf2.default)(DummyHostNameResolver)).apply(this, arguments));
  }

  (0, _createClass3.default)(DummyHostNameResolver, [{
    key: 'resolve',
    value: function resolve(seedRouter) {
      return resolveToItself(seedRouter);
    }
  }]);
  return DummyHostNameResolver;
}(HostNameResolver);

var DnsHostNameResolver = exports.DnsHostNameResolver = function (_HostNameResolver2) {
  (0, _inherits3.default)(DnsHostNameResolver, _HostNameResolver2);

  function DnsHostNameResolver() {
    (0, _classCallCheck3.default)(this, DnsHostNameResolver);

    var _this2 = (0, _possibleConstructorReturn3.default)(this, (DnsHostNameResolver.__proto__ || (0, _getPrototypeOf2.default)(DnsHostNameResolver)).call(this));

    _this2._dns = require('dns');
    return _this2;
  }

  (0, _createClass3.default)(DnsHostNameResolver, [{
    key: 'resolve',
    value: function resolve(seedRouter) {
      var _this3 = this;

      var seedRouterHost = (0, _connector.parseHost)(seedRouter);
      var seedRouterPort = (0, _connector.parsePort)(seedRouter);

      return new _promise2.default(function (resolve) {
        _this3._dns.lookup(seedRouterHost, { all: true }, function (error, addresses) {
          if (error) {
            resolve(resolveToItself(seedRouter));
          } else {
            var addressesWithPorts = addresses.map(function (address) {
              return addressWithPort(address, seedRouterPort);
            });
            resolve(addressesWithPorts);
          }
        });
      });
    }
  }]);
  return DnsHostNameResolver;
}(HostNameResolver);

function resolveToItself(address) {
  return _promise2.default.resolve([address]);
}

function addressWithPort(addressObject, port) {
  var address = addressObject.address;
  if (port) {
    return address + ':' + port;
  }
  return address;
}