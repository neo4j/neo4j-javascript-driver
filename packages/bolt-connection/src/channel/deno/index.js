/**
 * Copyright (c) "Neo4j"
 * Neo4j Sweden AB [https://neo4j.com]
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

import DenoChannel from './deno-channel'
import DenoHostNameResolver from './deno-host-name-resolver'
import DenoClientCertificatesLoader from './deno-client-certificates-loader'
/*

 This module exports a set of components to be used in deno environment.
 They are not compatible with NodeJS environment.
 All files import/require APIs from `node/index.js` by default.
 Such imports are replaced at build time with `deno/index.js` when building a deno bundle.

 NOTE: exports in this module should have exactly the same names/structure as exports in `node/index.js`.

  */
export const Channel = DenoChannel
export const HostNameResolver = DenoHostNameResolver
export const ClientCertificatesLoader = DenoClientCertificatesLoader
