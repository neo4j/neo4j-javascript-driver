"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});
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

function isEmptyObjectOrNull(object) {
    if (!object) {
        return true;
    }

    for (var prop in object) {
        if (object.hasOwnProperty(prop)) {
            return false;
        }
    }

    return true;
}

exports.isEmptyObjectOrNull = isEmptyObjectOrNull;
exports.ENCRYPTION_ON = ENCRYPTION_ON;
exports.ENCRYPTION_OFF = ENCRYPTION_OFF;