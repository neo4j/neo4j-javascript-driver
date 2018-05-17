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

import * as v1 from './packstream-v1';
import * as v2 from './packstream-v2';

const PACKER_CONSTRUCTORS_BY_VERSION = [null, v1.Packer, v2.Packer];
const UNPACKER_CONSTRUCTORS_BY_VERSION = [null, v1.Unpacker, v2.Unpacker];

function createLatestPacker(chunker) {
  return createPackerForProtocolVersion(PACKER_CONSTRUCTORS_BY_VERSION.length - 1, chunker);
}

function createLatestUnpacker(disableLosslessIntegers) {
  return createUnpackerForProtocolVersion(UNPACKER_CONSTRUCTORS_BY_VERSION.length - 1, disableLosslessIntegers);
}

function createPackerForProtocolVersion(version, chunker) {
  const packerConstructor = PACKER_CONSTRUCTORS_BY_VERSION[version];
  if (!packerConstructor) {
    throw new Error(`Packer can't be created for protocol version ${version}`);
  }
  return new packerConstructor(chunker);
}

function createUnpackerForProtocolVersion(version, disableLosslessIntegers) {
  const unpackerConstructor = UNPACKER_CONSTRUCTORS_BY_VERSION[version];
  if (!unpackerConstructor) {
    throw new Error(`Unpacker can't be created for protocol version ${version}`);
  }
  return new unpackerConstructor(disableLosslessIntegers);
}

export default {
  createLatestPacker: createLatestPacker,
  createLatestUnpacker: createLatestUnpacker,
  createPackerForProtocolVersion: createPackerForProtocolVersion,
  createUnpackerForProtocolVersion: createUnpackerForProtocolVersion
};
