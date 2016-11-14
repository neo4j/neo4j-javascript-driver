"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
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

var LOCALHOST_MATCHER = /^(localhost|127(\.\d+){3})$/i;
var ENCRYPTION_ON = "ENCRYPTION_ON";
var ENCRYPTION_OFF = "ENCRYPTION_OFF";
var ENCRYPTION_NON_LOCAL = "ENCRYPTION_NON_LOCAL";

function isLocalHost(host) {
  return LOCALHOST_MATCHER.test(host);
}

/* Coerce an encryption setting to a definitive boolean value,
 * given a valid default and a target host. If encryption is
 * explicitly set on or off, then the mapping is a simple
 * conversion to true or false respectively. If set to
 * ENCRYPTION_NON_LOCAL then respond according to whether or
 * not the host is localhost/127.x.x.x. In all other cases
 * (including undefined) then fall back to the default and
 * re-evaluate.
 */
function shouldEncrypt(encryption, encryptionDefault, host) {
  if (encryption === ENCRYPTION_ON || encryption === true) return true;
  if (encryption === ENCRYPTION_OFF || encryption === false) return false;
  if (encryption === ENCRYPTION_NON_LOCAL) return !isLocalHost(host);
  return shouldEncrypt(encryptionDefault, ENCRYPTION_OFF, host);
}

exports.isLocalHost = isLocalHost;
exports.shouldEncrypt = shouldEncrypt;
exports.ENCRYPTION_ON = ENCRYPTION_ON;
exports.ENCRYPTION_OFF = ENCRYPTION_OFF;
exports.ENCRYPTION_NON_LOCAL = ENCRYPTION_NON_LOCAL;