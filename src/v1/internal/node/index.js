/**
 * Copyright (c) 2002-2018 "Neo4j,"
 * Neo4j Sweden AB [http://neo4j.com]
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

import NodeBuffer from './node-buf';
import NodeChannel from './node-channel';
import NodeHostNameResolver from './node-host-name-resolver';
import utf8Codec from './node-utf8';

export const alloc = arg => new NodeBuffer(arg);
export const Channel = NodeChannel;
export const HostNameResolver = NodeHostNameResolver;
export const utf8 = utf8Codec;
