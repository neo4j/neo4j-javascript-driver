'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require('babel-runtime/helpers/createClass');

var _createClass3 = _interopRequireDefault(_createClass2);

var _features = require('./features');

var _features2 = _interopRequireDefault(_features);

var _error = require('../error');

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

var ChannelConfig = function () {
  function ChannelConfig(host, port, driverConfig, connectionErrorCode) {
    (0, _classCallCheck3.default)(this, ChannelConfig);

    this.host = host;
    this.port = port;
    this.encrypted = ChannelConfig._extractEncrypted(driverConfig);
    this.trust = ChannelConfig._extractTrust(driverConfig);
    this.trustedCertificates = ChannelConfig._extractTrustedCertificates(driverConfig);
    this.knownHostsPath = ChannelConfig._extractKnownHostsPath(driverConfig);
    this.connectionErrorCode = connectionErrorCode || _error.SERVICE_UNAVAILABLE;
  }

  (0, _createClass3.default)(ChannelConfig, null, [{
    key: '_extractEncrypted',
    value: function _extractEncrypted(driverConfig) {
      // check if encryption was configured by the user, use explicit null check because we permit boolean value
      var encryptionConfigured = driverConfig.encrypted == null;
      // default to using encryption if trust-all-certificates is available
      return encryptionConfigured ? (0, _features2.default)('trust_all_certificates') : driverConfig.encrypted;
    }
  }, {
    key: '_extractTrust',
    value: function _extractTrust(driverConfig) {
      if (driverConfig.trust) {
        return driverConfig.trust;
      }
      // default to using TRUST_ALL_CERTIFICATES if it is available
      return (0, _features2.default)('trust_all_certificates') ? 'TRUST_ALL_CERTIFICATES' : 'TRUST_CUSTOM_CA_SIGNED_CERTIFICATES';
    }
  }, {
    key: '_extractTrustedCertificates',
    value: function _extractTrustedCertificates(driverConfig) {
      return driverConfig.trustedCertificates || [];
    }
  }, {
    key: '_extractKnownHostsPath',
    value: function _extractKnownHostsPath(driverConfig) {
      return driverConfig.knownHosts || null;
    }
  }]);
  return ChannelConfig;
}();

exports.default = ChannelConfig;
;