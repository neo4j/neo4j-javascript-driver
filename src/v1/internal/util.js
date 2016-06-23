
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

let LOCALHOST_MATCHER = /^(localhost|127(\.\d+){3})$/i;
let ENCRYPTION_ON = "ENCRYPTION_ON";
let ENCRYPTION_OFF = "ENCRYPTION_OFF";
let ENCRYPTION_NON_LOCAL = "ENCRYPTION_NON_LOCAL";

function isLocalHost(host)  {
  return LOCALHOST_MATCHER.test(host);
}

export {
 isLocalHost,
 ENCRYPTION_ON,
 ENCRYPTION_OFF,
 ENCRYPTION_NON_LOCAL
}