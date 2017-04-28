"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.ENCRYPTION_OFF = exports.ENCRYPTION_ON = exports.parseRoutingContext = exports.parsePort = exports.parseHost = exports.parseUrl = exports.parseScheme = exports.assertString = exports.isEmptyObjectOrNull = undefined;

var _stringify = require("babel-runtime/core-js/json/stringify");

var _stringify2 = _interopRequireDefault(_stringify);

var _typeof2 = require("babel-runtime/helpers/typeof");

var _typeof3 = _interopRequireDefault(_typeof2);

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

var ENCRYPTION_ON = "ENCRYPTION_ON";
var ENCRYPTION_OFF = "ENCRYPTION_OFF";

var URL_REGEX = new RegExp(['([^/]+//)?', // scheme
'(([^:/?#]*)', // hostname
'(?::([0-9]+))?)', // port (optional)
'([^?]*)?', // everything else
'(\\?(.+))?' // query
].join(''));

function isEmptyObjectOrNull(obj) {
  if (obj === null) {
    return true;
  }

  if (!isObject(obj)) {
    return false;
  }

  for (var prop in obj) {
    if (obj.hasOwnProperty(prop)) {
      return false;
    }
  }

  return true;
}

function isObject(obj) {
  var type = typeof obj === "undefined" ? "undefined" : (0, _typeof3.default)(obj);
  return type === 'function' || type === 'object' && Boolean(obj);
}

function assertString(obj, objName) {
  if (!isString(obj)) {
    throw new TypeError(objName + ' expected to be string but was: ' + (0, _stringify2.default)(obj));
  }
  return obj;
}

function isString(str) {
  return Object.prototype.toString.call(str) === '[object String]';
}

function parseScheme(url) {
  assertString(url, 'URL');
  var scheme = url.match(URL_REGEX)[1] || '';
  return scheme.toLowerCase();
}

function parseUrl(url) {
  assertString(url, 'URL');
  return url.match(URL_REGEX)[2];
}

function parseHost(url) {
  assertString(url, 'URL');
  return url.match(URL_REGEX)[3];
}

function parsePort(url) {
  assertString(url, 'URL');
  return url.match(URL_REGEX)[4];
}

function parseRoutingContext(url) {
  var query = url.match(URL_REGEX)[7] || '';
  var context = {};
  if (query) {
    query.split('&').forEach(function (pair) {
      var keyValue = pair.split('=');
      if (keyValue.length !== 2) {
        throw new Error('Invalid parameters: \'' + keyValue + '\' in URL \'' + url + '\'.');
      }

      var key = trimAndVerify(keyValue[0], 'key', url);
      var value = trimAndVerify(keyValue[1], 'value', url);

      if (context[key]) {
        throw new Error("Duplicated query parameters with key '" + key + "' in URL '" + url + "'");
      }

      context[key] = value;
    });
  }
  return context;
}

function trimAndVerify(string, name, url) {
  var result = string.trim();
  if (!result) {
    throw new Error("Illegal empty " + name + " in URL query '" + url + "'");
  }
  return result;
}

exports.isEmptyObjectOrNull = isEmptyObjectOrNull;
exports.assertString = assertString;
exports.parseScheme = parseScheme;
exports.parseUrl = parseUrl;
exports.parseHost = parseHost;
exports.parsePort = parsePort;
exports.parseRoutingContext = parseRoutingContext;
exports.ENCRYPTION_ON = ENCRYPTION_ON;
exports.ENCRYPTION_OFF = ENCRYPTION_OFF;